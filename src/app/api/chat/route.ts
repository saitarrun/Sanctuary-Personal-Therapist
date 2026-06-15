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

  // 1. Safety heuristic on the incoming transcript.
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

  // 3. Retrieve grounding passages.
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

  // 5. Initialize the stream from the provider.
  try {
    const stream = await getProvider().stream({ system, messages });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        // Send initial metadata (sources, crisis flag).
        const meta = {
          type: "metadata",
          crisis: crisis.triggered,
          resources: crisis.triggered ? CRISIS_RESOURCES : undefined,
          sources: chunks.map((c) => ({
            title: c.title,
            authors: c.authors,
            url: c.url,
            source: c.source,
            similarity: Number(c.similarity?.toFixed?.(3) ?? c.similarity),
          })),
        };
        controller.enqueue(encoder.encode(JSON.stringify(meta) + "\n"));

        let fullContent = "";
        for await (const chunk of stream.iterator) {
          fullContent += chunk;
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: "chunk", content: chunk }) + "\n")
          );
        }

        // 6. Finalize: Persist assistant reply + session updates.
        // We do this inside the stream completion so it's consistent.
        await prisma.message.create({
          data: {
            sessionId,
            role: "assistant",
            content: fullContent,
            provider: stream.provider,
            model: stream.model,
            sources: {
              create: chunks.map((c) => ({ chunkId: c.chunkId })),
            },
          },
        });

        await prisma.session.update({
          where: { id: sessionId },
          data: {
            updatedAt: new Date(),
            ...(session.title ? {} : { title: deriveTitle(message) }),
          },
        });

        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("[chat] provider error:", err);
    return NextResponse.json(
      { error: "The coach is unavailable right now. Please try again." },
      { status: 502 }
    );
  }
}

function deriveTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= 60 ? clean : `${clean.slice(0, 57)}…`;
}
