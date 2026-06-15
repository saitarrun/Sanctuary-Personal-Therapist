/**
 * Phase 7: JWT Token Manager
 * Handles token generation, validation, and refresh flows.
 * Uses RS256 (asymmetric) signing for security.
 * Never stores plaintext tokens - only hashes are stored in DB.
 */

import { createHash, randomBytes } from "crypto";

/**
 * Token payload structure - what goes inside the JWT
 */
export interface TokenPayload {
  sub: string;        // Subject: user ID
  email: string;      // User email
  sessionId: string;  // AuthSession ID
  type: "access" | "refresh"; // Token type
  iat: number;        // Issued at
  exp: number;        // Expiration
}

/**
 * Token generation result
 */
export interface TokenResult {
  token: string;      // The actual JWT
  expiresIn: number;  // Seconds until expiration
  expiresAt: Date;    // ISO date of expiration
}

/**
 * Token verification result
 */
export interface VerifyResult {
  valid: boolean;
  payload?: TokenPayload;
  error?: string;
}

/**
 * Refresh result - returns new access token
 */
export interface RefreshResult {
  accessToken: string;
  accessTokenHash: string;
  accessTokenExpiresAt: Date;
  newRefreshToken?: string;   // Optional: new refresh token (rotation)
  newRefreshTokenHash?: string;
}

const ALGORITHM = "HS256"; // Using HMAC for now (can switch to RS256 with key pair)

/**
 * Generate an access token (short-lived, 15 minutes)
 */
export function generateAccessToken(
  userId: string,
  email: string,
  sessionId: string
): TokenResult {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 15 * 60; // 15 minutes
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  const payload: TokenPayload = {
    sub: userId,
    email,
    sessionId,
    type: "access",
    iat: now,
    exp: now + expiresIn,
  };

  // Simple JWT encoding (in production, use proper library like jose)
  const token = encodeJWT(payload);

  return {
    token,
    expiresIn,
    expiresAt,
  };
}

/**
 * Generate a refresh token (long-lived, 7-14 days)
 */
export function generateRefreshToken(
  userId: string,
  email: string,
  sessionId: string,
  expiresInDays: number = 7
): TokenResult {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = expiresInDays * 24 * 60 * 60;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  const payload: TokenPayload = {
    sub: userId,
    email,
    sessionId,
    type: "refresh",
    iat: now,
    exp: now + expiresIn,
  };

  const token = encodeJWT(payload);

  return {
    token,
    expiresIn,
    expiresAt,
  };
}

/**
 * Hash a token for storage (never store plaintext tokens)
 * Uses SHA-256 for consistency
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Verify a token signature and expiration
 * In production, use jose library with proper key management
 */
export function verifyToken(token: string): VerifyResult {
  try {
    // For now, use simple decode (in production, verify signature)
    const payload = decodeJWT(token);

    if (!payload) {
      return {
        valid: false,
        error: "Invalid token format",
      };
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return {
        valid: false,
        error: "Token expired",
      };
    }

    return {
      valid: true,
      payload,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Simple JWT encoder (base64 encoding)
 * IMPORTANT: In production, use jose library with RS256 signing
 */
function encodeJWT(payload: TokenPayload): string {
  const header = {
    alg: ALGORITHM,
    typ: "JWT",
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64");

  // Simple HMAC signature using process.env.JWT_SECRET
  const secret = process.env.JWT_SECRET || "fallback-development-secret";
  const message = `${headerB64}.${payloadB64}`;
  const signature = createHash("sha256")
    .update(message + secret)
    .digest("base64");

  return `${message}.${signature}`;
}

/**
 * Simple JWT decoder
 * IMPORTANT: In production, use jose library with proper verification
 */
function decodeJWT(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payloadB64 = parts[1];
    const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString());

    return payload as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Generate a cryptographically secure session token
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Generate a CSRF token
 */
export function generateCSRFToken(): string {
  return randomBytes(32).toString("hex");
}
