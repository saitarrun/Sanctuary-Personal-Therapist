/**
 * Next.js middleware for rate limiting and abuse prevention.
 * Runs before API route handlers.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getClientIP,
  getSessionId,
  createEndpointKey,
  createSessionKey,
  anonymizeIP,
} from "@/lib/rateLimit/requestUtils";
import {
  getIpLimiter,
  getChatEndpointLimiter,
  getSessionEndpointLimiter,
  getMessageLimiter,
} from "@/lib/rateLimit/limiter";

// Rate limiting is enabled by default; can be disabled via environment variable
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== "false";

// API routes that should NOT be rate-limited (e.g., health checks, public endpoints)
const EXCLUDED_ROUTES = [
  "/api/health",
  "/api/status",
];

// GET requests are considered read-only and not rate-limited for general IP limits
// (though session-based limits still apply if there's a sessionId)
const RATE_LIMIT_WRITE_ONLY = true;

/**
 * Middleware function that runs for all API requests.
 */
export async function middleware(req: NextRequest) {
  // Skip rate limiting if disabled
  if (!RATE_LIMIT_ENABLED) {
    return NextResponse.next();
  }

  // Skip excluded routes
  const pathname = req.nextUrl.pathname;
  if (EXCLUDED_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Skip rate limiting for read-only requests (GET, HEAD, OPTIONS)
  if (RATE_LIMIT_WRITE_ONLY && ["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return NextResponse.next();
  }

  try {
    const ip = getClientIP(req);
    const sessionId = await getSessionId(req);
    const endpoint = new URL(req.url).pathname;

    // Check IP-based rate limit (prevents DDoS from single IP)
    const ipResult = getIpLimiter().check(ip);
    if (!ipResult.allowed) {
      console.warn(
        `[rate-limit] IP ${anonymizeIP(ip)} exceeded rate limit for endpoint ${endpoint}`
      );
      return createRateLimitResponse(ipResult.retryAfter!);
    }

    // Check endpoint-specific rate limits
    const endpointKey = createEndpointKey(ip, endpoint);
    let endpointResult;

    if (endpoint === "/api/chat") {
      endpointResult = getChatEndpointLimiter().check(endpointKey);
    } else if (endpoint === "/api/sessions") {
      endpointResult = getSessionEndpointLimiter().check(endpointKey);
    }

    if (endpointResult && !endpointResult.allowed) {
      console.warn(
        `[rate-limit] IP ${anonymizeIP(ip)} exceeded rate limit for endpoint ${endpoint}`
      );
      return createRateLimitResponse(endpointResult.retryAfter!);
    }

    // Check session-based rate limit (prevents single session from spamming)
    if (sessionId) {
      const sessionKey = createSessionKey(sessionId);
      const sessionResult = getMessageLimiter().check(sessionKey);
      if (!sessionResult.allowed) {
        console.warn(
          `[rate-limit] Session ${sessionId} exceeded message rate limit`
        );
        return createRateLimitResponse(sessionResult.retryAfter!);
      }
    }

    // All rate limits passed; continue to route handler
    return NextResponse.next();
  } catch (error) {
    // Fail-safe: if rate limiting logic fails, allow the request
    console.error("[rate-limit] middleware error:", error);
    return NextResponse.next();
  }
}

/**
 * Create a 429 Too Many Requests response.
 */
function createRateLimitResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests. Please slow down and try again later.",
      retryAfter: retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Reset": String(Date.now() + retryAfterSeconds * 1000),
      },
    }
  );
}

/**
 * Configure which routes the middleware should run on.
 * Apply to all API routes; exclude other paths.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/static (static files)
     * - _next/static (next.js internals)
     * - favicon.ico (favicon)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
