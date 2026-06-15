import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { createVerificationToken } from "@/lib/auth/utils";
import { sendVerificationEmail } from "@/lib/email/emailService";
import {
  withErrorHandler,
  generateRequestId,
} from "@/lib/middleware/errorMiddleware";
import {
  ValidationError,
  DBError,
  APIError,
} from "@/lib/errors/errorHandler";
import { logger } from "@/lib/logging/logger";

const DISPOSABLE_EMAIL_DOMAINS = [
  "tempmail.com",
  "10minutemail.com",
  "throwaway.email",
  "trashmail.com",
  "mailinator.com",
];

const signupSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

type SignupInput = z.infer<typeof signupSchema>;

function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1];
  return DISPOSABLE_EMAIL_DOMAINS.includes(domain?.toLowerCase());
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const json = await req.json().catch(() => null);
  const parsed = signupSchema.safeParse(json);

  if (!parsed.success) {
    throw new ValidationError(
      "Invalid email or password format",
      { issues: parsed.error.issues }
    );
  }

  const { email, password, firstName, lastName } = parsed.data;

  if (isDisposableEmail(email)) {
    throw new ValidationError(
      "Disposable email addresses are not allowed"
    );
  }

  const pwValidation = validatePasswordStrength(password);
  if (!pwValidation.valid) {
    throw new ValidationError(
      "Password does not meet security requirements",
      { errors: pwValidation.errors }
    );
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ValidationError(
        "An account with this email already exists"
      );
    }
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new DBError(
      "Failed to check email availability"
    );
  }

  let user;
  try {
    const hashedPw = hashPassword(password);
    user = await prisma.user.create({
      data: {
        email,
        hashedPassword: hashedPw,
        firstName,
        lastName,
        authMethod: "EMAIL",
        emailVerified: false,
      },
    });
  } catch (error) {
    console.error("[signup] Failed to create user:", error);
    throw new DBError(
      "Failed to create account. Please try again."
    );
  }

  const verificationCode = createVerificationToken(email);

  const emailResult = await sendVerificationEmail(email, verificationCode);
  if (!emailResult.success) {
    logger.error("[signup] Failed to send verification email", new Error(emailResult.error || "Unknown error"), {
      userId: user.id,
      email,
    });
  }

  logger.trackAuthEvent("signup", user.id, { email });

  return NextResponse.json(
    {
      success: true,
      message: "Account created. Check your email for verification code.",
      user: {
        id: user.id,
        email: user.email,
        name: [firstName, lastName].filter(Boolean).join(" "),
        emailVerified: false,
      },
    },
    { status: 201 }
  );
});
