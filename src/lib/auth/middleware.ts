import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";

export async function withAuth(req: NextRequest) {
  try {
    const cookie = req.cookies.get("auth_token");
    const token = cookie?.value;

    if (!token) {
      return {
        authenticated: false,
        userId: null,
        email: null,
        error: "No authentication token provided",
      };
    }

    const payload = verifyToken(token);
    if (!payload) {
      return {
        authenticated: false,
        userId: null,
        email: null,
        error: "Invalid or expired token",
      };
    }

    return {
      authenticated: true,
      userId: payload.sub,
      email: payload.email,
      error: null,
    };
  } catch (error) {
    console.error("[auth-middleware] Error:", error);
    return {
      authenticated: false,
      userId: null,
      email: null,
      error: "Authentication check failed",
    };
  }
}

export function createAuthCookie(token: string, expiresIn: number = 15 * 60): string {
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  return `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${expiresAt.toUTCString()}`;
}

export function clearAuthCookie(): string {
  return `auth_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
