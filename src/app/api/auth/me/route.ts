import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withErrorHandler } from "@/lib/middleware/errorMiddleware";
import { ValidationError, DBError } from "@/lib/errors/errorHandler";
import { withAuth } from "@/lib/auth/middleware";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await withAuth(req);

  if (!auth.authenticated || !auth.userId) {
    throw new ValidationError("Unauthorized");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new ValidationError("User not found");
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          ...user,
          name: [user.firstName, user.lastName].filter(Boolean).join(" "),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new DBError("Failed to fetch user");
  }
});
