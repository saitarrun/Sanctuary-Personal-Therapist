/**
 * Phase 7: Secure Cookie Manager
 * Handles setting and validating secure httpOnly cookies.
 * Prevents XSS/CSRF attacks through proper cookie flags.
 */

import { NextResponse, NextRequest } from "next/server";

/**
 * Cookie configuration for refresh token
 * httpOnly: Prevent XSS access to token
 * Secure: Only send over HTTPS
 * SameSite: Prevent CSRF attacks
 */
export interface CookieOptions {
  name: string;
  value: string;
  maxAge?: number; // In seconds
  expires?: Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "strict" | "lax" | "none";
}

const PROD = process.env.NODE_ENV === "production";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

/**
 * Get secure cookie options for refresh token
 * Secure defaults: httpOnly, Secure (HTTPS only), SameSite=Strict
 */
export function getRefreshTokenCookieOptions(
  refreshToken: string,
  expiresAt: Date
): CookieOptions {
  return {
    name: "refreshToken",
    value: refreshToken,
    expires: expiresAt,
    path: "/",
    domain: COOKIE_DOMAIN,
    secure: PROD, // Only HTTPS in production
    httpOnly: true, // Prevent XSS access
    sameSite: "strict", // Prevent CSRF
  };
}

/**
 * Get secure cookie options for CSRF token
 * Stored in regular (non-httpOnly) cookie so JS can read it
 */
export function getCSRFTokenCookieOptions(
  csrfToken: string,
  expiresAt: Date
): CookieOptions {
  return {
    name: "csrfToken",
    value: csrfToken,
    expires: expiresAt,
    path: "/",
    domain: COOKIE_DOMAIN,
    secure: PROD,
    httpOnly: false, // JS needs to read this
    sameSite: "strict",
  };
}

/**
 * Set a cookie on response
 */
export function setCookie(
  response: NextResponse,
  options: CookieOptions
): NextResponse {
  response.cookies.set(options.name, options.value, {
    path: options.path || "/",
    domain: options.domain,
    secure: options.secure !== false,
    httpOnly: options.httpOnly !== false,
    sameSite: options.sameSite || "lax",
    maxAge: options.maxAge,
    expires: options.expires,
  });

  return response;
}

/**
 * Clear a cookie (set to empty with past expiration)
 */
export function clearCookie(
  response: NextResponse,
  name: string,
  path: string = "/"
): NextResponse {
  response.cookies.set(name, "", {
    path,
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}

/**
 * Get a cookie value from request
 */
export function getCookie(req: NextRequest, name: string): string | undefined {
  return req.cookies.get(name)?.value;
}

/**
 * Get refresh token from request cookies
 */
export function getRefreshTokenCookie(req: NextRequest): string | null {
  return getCookie(req, "refreshToken") || null;
}

/**
 * Get CSRF token from request cookies
 */
export function getCSRFTokenCookie(req: NextRequest): string | null {
  return getCookie(req, "csrfToken") || null;
}

/**
 * Validate CSRF token from request
 * Token can come from header or body
 */
export function getCSRFTokenFromRequest(
  req: NextRequest,
  body?: Record<string, unknown>
): string | null {
  // Try header first (X-CSRF-Token)
  const headerToken = req.headers.get("x-csrf-token");
  if (headerToken) {
    return headerToken;
  }

  // Try body if provided
  if (body && typeof body.csrfToken === "string") {
    return body.csrfToken;
  }

  return null;
}

/**
 * Create Set-Cookie header string manually (for streaming responses)
 */
export function createSetCookieHeader(options: CookieOptions): string {
  let header = `${options.name}=${encodeURIComponent(options.value)}`;

  if (options.expires) {
    header += `; Expires=${options.expires.toUTCString()}`;
  }

  if (options.maxAge) {
    header += `; Max-Age=${options.maxAge}`;
  }

  if (options.path) {
    header += `; Path=${options.path}`;
  }

  if (options.domain) {
    header += `; Domain=${options.domain}`;
  }

  if (options.secure) {
    header += "; Secure";
  }

  if (options.httpOnly) {
    header += "; HttpOnly";
  }

  if (options.sameSite) {
    header += `; SameSite=${options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1)}`;
  }

  return header;
}

/**
 * Validate cookie size (browsers have 4KB limit per cookie)
 * Returns true if size is acceptable
 */
export function isValidCookieSize(value: string, maxSize: number = 4000): boolean {
  return Buffer.byteLength(value, "utf8") <= maxSize;
}
