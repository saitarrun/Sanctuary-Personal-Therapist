import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  withErrorHandler,
  retryWithExponentialBackoff,
  generateRequestId,
} from "@/lib/middleware/errorMiddleware";
import { DBError, ValidationError } from "@/lib/errors/errorHandler";
import {
  getClientIP,
  anonymizeIP,
  createSessionKey,
} from "@/lib/rateLimit/requestUtils";
import { getSessionLimiter } from "@/lib/rateLimit/limiter";

export const runtime = "nodejs";

// GET /api/sessions — list sessions, newest first (for the sidebar).
export async function GET() {
  try {
    const sessions = await prisma.session.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, updatedAt: true },
    });
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[sessions] Failed to fetch sessions:", error);
    // Return empty list with friendly error response instead of failing
    return NextResponse.json(
      { sessions: [], error: "Unable to load sessions at this time" },
      { status: 200 }
    );
  }
}

// POST /api/sessions — create a new session with retry logic and rate limiting.
export const POST = withErrorHandler(
  async (req: NextRequest, requestId: string) => {
    // Rate limiting: prevent session creation spam from a single IP
    const ip = getClientIP(req);
    const sessionKey = createSessionKey(ip);
    const sessionLimitResult = getSessionLimiter().check(sessionKey);

    if (!sessionLimitResult.allowed) {
      const retryAfter = sessionLimitResult.retryAfter || 3600;
      throw new ValidationError(
        `Too many session creation attempts. Please try again in ${retryAfter} seconds.`,
        { retryAfter, ip: anonymizeIP(ip) },
        requestId
      );
    }

    try {
      // Retry session creation with exponential backoff for transient failures
      const session = await retryWithExponentialBackoff(
        () => prisma.session.create({ data: {} }),
        3,
        100
      );

      // Include rate limit headers in response
      return NextResponse.json({ id: session.id }, {
        status: 201,
        headers: {
          "RateLimit-Limit": "10", // Default limit per hour
          "RateLimit-Remaining": String(Math.max(0, sessionLimitResult.remaining)),
          "RateLimit-Reset": String(Math.floor(sessionLimitResult.resetTime / 1000)), // Unix timestamp in seconds
        },
      });
    } catch (error) {
      throw new DBError(
        "Failed to create a new session. Please try again.",
        { originalError: String(error) },
        requestId
      );
    }
  }
);

