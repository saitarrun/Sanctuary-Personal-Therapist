import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyToken, consumeToken } from "@/lib/auth/utils";
import {
  withErrorHandler,
} from "@/lib/middleware/errorMiddleware";
import {
  ValidationError,
  DBError,
  NotFoundError,
} from "@/lib/errors/errorHandler";
import { logger } from "@/lib/logging/logger";

const verifyEmailSchema = z.object({
  email: z.string().email().toLowerCase(),
  code: z.string().length(6).regex(/^\d+$/),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const json = await req.json().catch(() => null);
  const parsed = verifyEmailSchema.safeParse(json);

  if (!parsed.success) {
    throw new ValidationError(
      "Invalid email or verification code"
    );
  }

  const { email, code } = parsed.data;

  const tokenResult = verifyToken(code, "verification");
  if (!tokenResult.valid || tokenResult.email !== email) {
    throw new ValidationError(
      "Invalid or expired verification code"
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundError(
        "User not found"
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    consumeToken(code);

    logger.trackAuthEvent("email_verified", user.id, { email });

    return NextResponse.json(
      {
        success: true,
        message: "Email verified successfully",
        user: {
          id: user.id,
          email: user.email,
          emailVerified: true,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof (ValidationError || NotFoundError)) throw error;
    throw new DBError(
      "Failed to verify email. Please try again."
    );
  }
});
