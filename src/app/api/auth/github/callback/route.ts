import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleOAuthCallback } from "@/lib/auth/oauth";
import {
  generateAccessToken,
  generateRefreshToken,
} from "@/lib/auth/jwt";
import { createAuthCookie } from "@/lib/auth/middleware";
import { logger } from "@/lib/logging/logger";
import { sendWelcomeEmail } from "@/lib/email/emailService";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const storedState = req.cookies.get("oauth_state")?.value;

    if (!code || !state || state !== storedState) {
      return NextResponse.redirect(
        `/auth/login?error=${encodeURIComponent("OAuth authentication failed")}`
      );
    }

    const oauthUser = await handleOAuthCallback("github", code, state);

    const user = await prisma.user.findUnique({
      where: { id: oauthUser.userId },
    });

    if (!user) {
      return NextResponse.redirect(
        `/auth/login?error=${encodeURIComponent("User creation failed")}`
      );
    }

    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.authSession.create({
      data: {
        userId: user.id,
        token: accessToken,
        expiresAt,
        ipAddress: getClientIP(req),
        deviceName: req.headers.get("user-agent")?.substring(0, 100),
      },
    });

    if (oauthUser.isNewUser) {
      await sendWelcomeEmail(user.email, user.firstName || undefined);
      logger.trackAuthEvent("signup_oauth", user.id, {
        provider: "github",
        email: user.email,
      });
    } else {
      logger.trackAuthEvent("login_oauth", user.id, {
        provider: "github",
        email: user.email,
      });
    }

    const response = NextResponse.redirect(
      `/auth/success?token=${encodeURIComponent(accessToken)}&refresh=${encodeURIComponent(refreshToken)}`
    );

    response.cookies.delete("oauth_state");
    response.headers.set(
      "Set-Cookie",
      createAuthCookie(accessToken, 15 * 60)
    );

    return response;
  } catch (error) {
    console.error("[github-callback] Error:", error);
    return NextResponse.redirect(
      `/auth/login?error=${encodeURIComponent("Authentication failed")}`
    );
  }
}

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-real-ip") ||
    "unknown"
  ).trim();
}
