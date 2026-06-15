import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getProvider } from "@/lib/llm";
import type { ChatMessage } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompt/systemPrompt";
import { CRISIS_RESOURCES } from "@/lib/prompt/crisisResources";
import { detectCrisis } from "@/lib/safety/crisisDetector";
import { retrieve, formatReferenceBlock } from "@/lib/rag/retrieve";
import {
  withErrorHandler,
  handleStreamError,
  generateRequestId,
} from "@/lib/middleware/errorMiddleware";
import {
  ValidationError,
  NotFoundError,
  APIError,
  DBError,
} from "@/lib/errors/errorHandler";
import { getMonitor } from "@/lib/performance/monitor";
import { sessionMetadataCache } from "@/lib/rag/cache";
import { validateMessage } from "@/lib/validation/messageValidator";
import {
  getClientIP,
  anonymizeIP,
  createSessionKey,
} from "@/lib/rateLimit/requestUtils";
import { getMessageLimiter } from "@/lib/rateLimit/limiter";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";

// Configurable message history limit (min 10, max 30, default 30)
const MAX_MESSAGE_HISTORY = Math.min(
  Math.max(parseInt(process.env.MAX_MESSAGE_HISTORY ?? "30", 10), 10),
  30
);

const bodySchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().trim().min(1).max(4000),
});

export const POST = withErrorHandler(async (req: NextRequest, requestId: string) => {
  const startTime = Date.now();
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError(
      "Invalid request body. Please provide a valid sessionId and message.",
      { issues: parsed.error.issues },
      requestId
    );
  }
  const { sessionId, message } = parsed.data;

  // Rate limiting: check session-based message limits
  const sessionKey = createSessionKey(sessionId);
  const messageLimitResult = getMessageLimiter().check(sessionKey);
  if (!messageLimitResult.allowed) {
    const retryAfter = messageLimitResult.retryAfter || 60;
    throw new ValidationError(
      `Too many messages. You've reached your rate limit. Please wait ${retryAfter} seconds before sending another message.`,
      { retryAfter },
      requestId
    );
  }

  // Message validation: check for spam patterns and rapid-fire messages
  const validationResult = validateMessage(sessionId, message);
  if (!validationResult.valid) {
    throw new ValidationError(
      validationResult.error || "Invalid message",
      { sessionId },
      requestId
    );
  }

  // 1. Verify session exists (with error handling).
  let session;
  try {
    session = await prisma.session.findUnique({ where: { id: sessionId } });
  } catch (error) {
    throw new DBError(
      "Failed to retrieve session. Please try again.",
      { originalError: String(error) },
      requestId
    );
  }

  if (!session) {
    throw new NotFoundError(
      `Session ${sessionId} does not exist. Please create a new session.`,
      { sessionId },
      requestId
    );
  }

  // 2. Safety heuristic on the incoming message.
  const crisis = detectCrisis(message);
  if (crisis.triggered) {
    logger.trackCrisisDetection(true, crisis.matched?.[0] || "Unknown");
  }

  // 3. Persist the user's message (with error handling).
  try {
    await prisma.message.create({
      data: {
        sessionId,
        role: "user",
        content: message,
        crisisFlag: crisis.triggered,
      },
    });
  } catch (error) {
    throw new DBError(
      "Failed to save your message. Please try again.",
      { originalError: String(error), sessionId },
      requestId
    );
  }

  // 4. Retrieve grounding passages (graceful fallback if RAG unavailable).
  let chunks: any[] = [];
  const ragStartTime = Date.now();
  try {
    chunks = await retrieve(message);
    const ragDuration = Date.now() - ragStartTime;
    logger.trackRagRetrieval(message, chunks.length, ragDuration);
  } catch (error) {
    // Log RAG failure but continue with generic response
    const ragDuration = Date.now() - ragStartTime;
    logger.error("[chat] RAG retrieval failed", error as Error, {
      sessionId,
      message_length: message.length,
      duration_ms: ragDuration,
    });
    chunks = [];
  }

  // 5. Assemble prompt + recent history.
  let system = buildSystemPrompt({
    referenceBlock: formatReferenceBlock(chunks),
    crisis: crisis.triggered,
  });

  let history: ChatMessage[] = [];
  try {
    // Check cache for session history first (5-minute TTL)
    const cachedHistory = sessionMetadataCache.get(`history:${sessionId}`);
    if (cachedHistory) {
      history = cachedHistory as ChatMessage[];
    } else {
      // Fetch only needed fields for better performance
      const dbHistory = await prisma.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: "desc" },
        take: MAX_MESSAGE_HISTORY,
        select: { role: true, content: true }, // Only fetch needed fields
      });
      history = dbHistory
        .reverse()
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      // Cache the history
      sessionMetadataCache.set(`history:${sessionId}`, history);
    }
  } catch (error) {
    // Log history fetch failure but continue with current message only
    console.warn(
      "[chat] Failed to retrieve history, continuing with current message only",
      error
    );
    history = [];
  }

  // 6. Initialize the stream from the provider.
  let stream;
  try {
    stream = await getProvider().stream({ system, messages: history });
  } catch (error) {
    throw new APIError(
      "The coach is unavailable right now. Please try again.",
      502,
      { originalError: String(error) },
      requestId
    );
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
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

        try {
          controller.enqueue(encoder.encode(JSON.stringify(meta) + "\n"));
        } catch (encodeError) {
          handleStreamError(controller, encodeError, requestId);
          return;
        }

        let fullContent = "";
        try {
          for await (const chunk of stream.iterator) {
            fullContent += chunk;
            try {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({ type: "chunk", content: chunk }) + "\n"
                )
              );
            } catch (encodeError) {
              console.error("[chat] Stream encoding error:", encodeError);
              handleStreamError(controller, encodeError, requestId);
              return;
            }
          }
        } catch (streamError) {
          console.error("[chat] Stream iteration error:", streamError);
          handleStreamError(controller, streamError, requestId);
          return;
        }

        // 7. Finalize: Persist assistant reply + session updates.
        try {
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
        } catch (dbError) {
          console.error(
            "[chat] Failed to persist assistant message:",
            dbError
          );
          // Don't fail the stream, message was sent to user
        }

        try {
          await prisma.session.update({
            where: { id: sessionId },
            data: {
              updatedAt: new Date(),
              ...(session.title ? {} : { title: deriveTitle(message) }),
            },
          });
        } catch (updateError) {
          console.error("[chat] Failed to update session:", updateError);
          // Don't fail the stream, session state is preserved
        }

        try {
          controller.close();
        } catch (closeError) {
          console.error("[chat] Error closing stream:", closeError);
        }
      } catch (error) {
        handleStreamError(controller, error, requestId);
      }
    },
  });

  // Include rate limit headers in response
  const remainingLimit = messageLimitResult.remaining;
  const resetTime = messageLimitResult.resetTime;

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "RateLimit-Limit": "20", // Default limit per minute
      "RateLimit-Remaining": String(Math.max(0, remainingLimit)),
      "RateLimit-Reset": String(Math.floor(resetTime / 1000)), // Unix timestamp in seconds
    },
  });
});

function deriveTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= 60 ? clean : `${clean.slice(0, 57)}…`;
}
