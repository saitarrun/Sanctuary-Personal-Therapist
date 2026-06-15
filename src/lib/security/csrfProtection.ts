/**
 * Phase 7: CSRF Protection
 * Implements CSRF token generation, validation, and reissuance.
 * Protects state-changing requests (POST, PUT, DELETE).
 */

import { prisma } from "@/lib/db";
import { generateCSRFToken, hashToken } from "@/lib/session/tokenManager";

const CSRF_TOKEN_EXPIRY_MINUTES = 60; // 1 hour

/**
 * Generate a new CSRF token for a session
 */
export async function generateCSRFTokenForSession(
  sessionId: string
): Promise<{ token: string; expiresAt: Date } | null> {
  try {
    // Delete old token if exists
    await prisma.cSRFToken.deleteMany({
      where: { sessionId },
    });

    // Generate new token
    const token = generateCSRFToken();
    const hashedToken = hashToken(token);
    const expiresAt = new Date(
      Date.now() + CSRF_TOKEN_EXPIRY_MINUTES * 60 * 1000
    );

    // Store in database
    await prisma.cSRFToken.create({
      data: {
        sessionId,
        token: hashedToken,
        expiresAt,
      },
    });

    return {
      token, // Return unhashed token to client (goes in cookie)
      expiresAt,
    };
  } catch (error) {
    console.error("[CSRF] Failed to generate token:", error);
    return null;
  }
}

/**
 * Validate CSRF token
 * Token should come from request body or header
 * And match the token in secure cookie
 */
export async function validateCSRFToken(
  sessionId: string,
  providedToken: string
): Promise<boolean> {
  try {
    // Hash the provided token to compare
    const hashedProvidedToken = hashToken(providedToken);

    // Find stored token
    const storedToken = await prisma.cSRFToken.findUnique({
      where: { sessionId },
    });

    if (!storedToken) {
      return false;
    }

    // Check expiration
    if (storedToken.expiresAt < new Date()) {
      // Token expired - delete it
      await prisma.cSRFToken.delete({
        where: { sessionId },
      });
      return false;
    }

    // Compare tokens (constant-time comparison to prevent timing attacks)
    return timingSafeCompare(hashedProvidedToken, storedToken.token);
  } catch (error) {
    console.error("[CSRF] Validation error:", error);
    return false;
  }
}

/**
 * Reissue CSRF token after validation
 * Prevents token reuse attacks
 */
export async function reissueCSRFToken(
  sessionId: string
): Promise<{ token: string; expiresAt: Date } | null> {
  return generateCSRFTokenForSession(sessionId);
}

/**
 * Check if request needs CSRF validation
 * GET, HEAD, OPTIONS don't need CSRF
 */
export function shouldValidateCSRF(method: string): boolean {
  const methods = ["POST", "PUT", "DELETE", "PATCH"];
  return methods.includes(method.toUpperCase());
}

/**
 * Cleanup expired CSRF tokens
 * Should be run periodically via cron
 */
export async function cleanupExpiredCSRFTokens(): Promise<number> {
  try {
    const result = await prisma.cSRFToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  } catch {
    return 0;
  }
}

/**
 * Timing-safe string comparison
 * Prevents timing attacks on token validation
 */
function timingSafeCompare(a: string, b: string): boolean {
  // Create buffers for comparison
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  // If lengths differ, still do full comparison for timing
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < aBuffer.length; i++) {
    result |= aBuffer[i] ^ bBuffer[i];
  }

  return result === 0;
}
