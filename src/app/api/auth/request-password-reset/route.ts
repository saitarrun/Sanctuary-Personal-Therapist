import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createPasswordResetToken } from "@/lib/auth/utils";
import { sendPasswordResetEmail } from "@/lib/email/emailService";
import {
  withErrorHandler,
} from "@/lib/middleware/errorMiddleware";
import {
  ValidationError,
  DBError,
  NotFoundError,
} from "@/lib/errors/errorHandler";
import { logger } from "@/lib/logging/logger";

const resetRequestSchema = z.object({
  email: z.string().email().toLowerCase(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const json = await req.json().catch(() => null);
  const parsed = resetRequestSchema.safeParse(json);

  if (!parsed.success) {
    throw new ValidationError("Invalid email format");
  }

  const { email } = parsed.data;

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { email },
    });
  } catch (error) {
    throw new DBError("Failed to look up user");
  }

  if (!user) {
    // Don't reveal if email exists (security best practice)
    return NextResponse.json(
      {
        success: true,
        message: "If an account exists, a password reset link has been sent",
      },
      { status: 200 }
    );
  }

  const resetToken = createPasswordResetToken(email);
  const emailResult = await sendPasswordResetEmail(
    email,
    resetToken,
    req.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000"
  );

  if (!emailResult.success) {
    logger.error("[password-reset] Failed to send reset email", new Error(emailResult.error || "Unknown"), {
      userId: user.id,
      email,
    });
  }

  logger.trackAuthEvent("password_reset_requested", user.id, { email });

  return NextResponse.json(
    {
      success: true,
      message: "If an account exists, a password reset link has been sent",
    },
    { status: 200 }
  );
});
