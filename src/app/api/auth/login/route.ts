import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { generateAccessToken, generateRefreshToken } from "@/lib/auth/jwt";
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

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const json = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(json);

  if (!parsed.success) {
    throw new ValidationError(
      "Invalid email or password format"
    );
  }

  const { email, password } = parsed.data;

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { email },
    });
  } catch (error) {
    throw new DBError(
      "Failed to look up user"
    );
  }

  if (!user || !user.hashedPassword) {
    throw new NotFoundError(
      "Invalid email or password"
    );
  }

  if (!user.emailVerified) {
    throw new ValidationError(
      "Please verify your email before logging in"
    );
  }

  const passwordValid = verifyPassword(password, user.hashedPassword);
  if (!passwordValid) {
    throw new NotFoundError(
      "Invalid email or password"
    );
  }

  const accessToken = generateAccessToken(user.id, user.email);
  const refreshToken = generateRefreshToken(user.id);

  try {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.authSession.create({
      data: {
        userId: user.id,
        token: accessToken,
        expiresAt,
        deviceName: req.headers.get("user-agent")?.substring(0, 100),
        ipAddress: getClientIP(req),
      },
    });
  } catch (error) {
    console.error("[login] Failed to create session:", error);
    throw new DBError(
      "Failed to create session"
    );
  }

  const response = NextResponse.json(
    {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: [user.firstName, user.lastName].filter(Boolean).join(" "),
        emailVerified: user.emailVerified,
      },
      accessToken,
      refreshToken,
      expiresIn: 15 * 60,
    },
    { status: 200 }
  );

  response.headers.set(
    "Set-Cookie",
    createAuthCookie(accessToken, 15 * 60)
  );

  logger.trackAuthEvent("login", user.id, { email });

  return response;
});

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-real-ip") ||
    "unknown"
  ).trim();
}
