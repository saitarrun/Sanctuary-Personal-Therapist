import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
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

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const json = await req.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(json);

  if (!parsed.success) {
    throw new ValidationError("Invalid request");
  }

  const { token, newPassword } = parsed.data;

  const pwValidation = validatePasswordStrength(newPassword);
  if (!pwValidation.valid) {
    throw new ValidationError(
      "Password does not meet security requirements",
      { errors: pwValidation.errors }
    );
  }

  const tokenResult = verifyToken(token, "reset");
  if (!tokenResult.valid || !tokenResult.email) {
    throw new ValidationError("Invalid or expired reset token");
  }

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { email: tokenResult.email },
    });
  } catch (error) {
    throw new DBError("Failed to look up user");
  }

  if (!user) {
    throw new NotFoundError("User not found");
  }

  try {
    const hashedPw = hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { hashedPassword: hashedPw },
    });

    // Revoke all active sessions after password reset
    await prisma.authSession.updateMany({
      where: {
        userId: user.id,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokeReason: "password_reset",
      },
    });

    consumeToken(token);

    logger.trackAuthEvent("password_reset_completed", user.id, {
      email: user.email,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Password reset successfully. Please log in with your new password.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[reset-password] Error:", error);
    throw new DBError("Failed to reset password");
  }
});
