import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} from "@/lib/auth/jwt";
import {
  withErrorHandler,
} from "@/lib/middleware/errorMiddleware";
import {
  ValidationError,
  DBError,
  NotFoundError,
} from "@/lib/errors/errorHandler";
import { logger } from "@/lib/logging/logger";
import { createAuthCookie } from "@/lib/auth/middleware";

const refreshSchema = z.object({
  refreshToken: z.string(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const json = await req.json().catch(() => null);
  const parsed = refreshSchema.safeParse(json);

  if (!parsed.success) {
    throw new ValidationError(
      "Invalid refresh token"
    );
  }

  const { refreshToken } = parsed.data;
  const payload = verifyToken(refreshToken);

  if (!payload || payload.type !== "refresh") {
    throw new ValidationError(
      "Invalid or expired refresh token"
    );
  }

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });
  } catch (error) {
    throw new DBError(
      "Failed to look up user"
    );
  }

  if (!user) {
    throw new NotFoundError(
      "User not found"
    );
  }

  const newAccessToken = generateAccessToken(user.id, user.email);
  const newRefreshToken = generateRefreshToken(user.id);

  try {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const existingSession = await prisma.authSession.findFirst({
      where: {
        userId: user.id,
        isRevoked: false,
      },
    });

    if (existingSession) {
      await prisma.authSession.update({
        where: { id: existingSession.id },
        data: {
          token: newAccessToken,
          expiresAt,
          lastActivityAt: new Date(),
        },
      });
    } else {
      await prisma.authSession.create({
        data: {
          userId: user.id,
          token: newAccessToken,
          expiresAt,
          ipAddress: getClientIP(req),
        },
      });
    }
  } catch (error) {
    console.error("[refresh] Failed to update session:", error);
    throw new DBError(
      "Failed to refresh token"
    );
  }

  const response = NextResponse.json(
    {
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 15 * 60,
    },
    { status: 200 }
  );

  response.headers.set(
    "Set-Cookie",
    createAuthCookie(newAccessToken, 15 * 60)
  );

  logger.trackAuthEvent("token_refresh", user.id, {});

  return response;
});

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-real-ip") ||
    "unknown"
  ).trim();
}
