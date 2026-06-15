/**
 * Utility functions for extracting client IP and session ID from requests.
 * Used by rate limiting middleware and API routes.
 */

import { NextRequest } from "next/server";

/**
 * Extract client IP address from request.
 * Handles X-Forwarded-For header (cloud deployments) and direct connection.
 * @param req NextRequest object
 * @returns Client IP address
 */
export function getClientIP(req: NextRequest): string {
  // Check X-Forwarded-For header (set by proxies, load balancers, CDNs)
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs; take the first one
    return forwarded.split(",")[0].trim();
  }

  // Check X-Real-IP header (alternative, sometimes used)
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Check CF-Connecting-IP (Cloudflare)
  const cfIP = req.headers.get("cf-connecting-ip");
  if (cfIP) {
    return cfIP;
  }

  // Fallback to localhost (NextRequest doesn't have direct IP property)
  return "127.0.0.1";
}

/**
 * Extract session ID from request.
 * Checks request body (POST) and cookies.
 * @param req NextRequest object
 * @returns Session ID or null if not found
 */
export async function getSessionId(
  req: NextRequest
): Promise<string | null> {
  // Try to get from request body (POST requests)
  try {
    if (req.method === "POST") {
      const contentType = req.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        // Clone the request to read the body (can only be read once)
        const clonedReq = req.clone();
        const body = await clonedReq.json().catch(() => null);
        if (body?.sessionId && typeof body.sessionId === "string") {
          return body.sessionId;
        }
      }
    }
  } catch {
    // Silently fail; session ID might be in cookie instead
  }

  // Try to get from cookies
  const sessionCookie = req.cookies.get("sessionId");
  if (sessionCookie?.value) {
    return sessionCookie.value;
  }

  return null;
}

/**
 * Create a rate limit key for an IP + endpoint combination.
 * @param ip Client IP address
 * @param endpoint API endpoint (e.g., "/api/chat", "/api/sessions")
 * @returns Rate limit key
 */
export function createEndpointKey(ip: string, endpoint: string): string {
  return `${ip}:${endpoint}`;
}

/**
 * Create a rate limit key for a session.
 * @param sessionId Session identifier
 * @returns Rate limit key
 */
export function createSessionKey(sessionId: string): string {
  return sessionId;
}

/**
 * Anonymize IP for logging/monitoring (GDPR-friendly).
 * @param ip Full IP address
 * @returns Anonymized IP (e.g., "192.168.1.xxx")
 */
export function anonymizeIP(ip: string): string {
  if (ip.includes(":")) {
    // IPv6: keep first 3 segments
    return ip.split(":").slice(0, 3).join(":") + ":xxx";
  }
  // IPv4: replace last octet
  return ip.split(".").slice(0, 3).join(".") + ".xxx";
}
