import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getProvider } from "@/lib/llm";
import type { ChatMessage } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompt/systemPrompt";
import { CRISIS_RESOURCES } from "@/lib/prompt/crisisResources";
import { detectCrisis } from "@/lib/safety/crisisDetector";
import { retrieve, formatReferenceBlock } from "@/lib/rag/retrieve";

export const runtime = "nodejs";

const HISTORY_LIMIT = 30;

const bodySchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().trim().min(1).max(4000),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
  const { sessionId, message } = parsed.data;

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // 1. Safety heuristic on the incoming transcript (before the model runs).
  const crisis = detectCrisis(message);

  // 2. Persist the user's message.
  await prisma.message.create({
    data: {
      sessionId,
      role: "user",
      content: message,
      crisisFlag: crisis.triggered,
    },
  });

  // 3. Retrieve grounding passages (degrades to none if corpus is empty).
  const chunks = await retrieve(message);

  // 4. Assemble prompt + recent history.
  const system = buildSystemPrompt({
    referenceBlock: formatReferenceBlock(chunks),
    crisis: crisis.triggered,
  });

  const history = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: { role: true, content: true },
  });
  const messages: ChatMessage[] = history
    .reverse()
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // 5. Generate the spoken reply.
  let reply: string;
  let providerName: string;
  let model: string;
  try {
    const result = await getProvider().chat({ system, messages });
    reply = result.content;
    providerName = result.provider;
    model = result.model;
  } catch (err) {
    console.error("[chat] provider error:", err);
    return NextResponse.json(
      { error: "The coach is unavailable right now. Please try again." },
      { status: 502 }
    );
  }

  // 6. Persist the assistant reply + which chunks grounded it.
  const assistant = await prisma.message.create({
    data: {
      sessionId,
      role: "assistant",
      content: reply,
      provider: providerName,
      model,
      sources: {
        create: chunks.map((c) => ({ chunkId: c.chunkId })),
      },
    },
  });

  // 7. Title the session from the first user message, and bump updatedAt.
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      updatedAt: new Date(),
      ...(session.title ? {} : { title: deriveTitle(message) }),
    },
  });

  return NextResponse.json({
    messageId: assistant.id,
    reply,
    crisis: crisis.triggered,
    resources: crisis.triggered ? CRISIS_RESOURCES : undefined,
    sources: chunks.map((c) => ({
      title: c.title,
      authors: c.authors,
      url: c.url,
      source: c.source,
      similarity: Number(c.similarity?.toFixed?.(3) ?? c.similarity),
    })),
  });
}

function deriveTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= 60 ? clean : `${clean.slice(0, 57)}…`;
}
