/**
 * POST /api/profile/account/hard-delete - Permanently delete user account (after 30-day grace period)
 * This route should only be accessible if the user has a soft delete scheduled
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientIP } from "@/lib/rateLimit/requestUtils";
import { logAccountDeletion } from "@/lib/privacy/auditLog";
import { captureException } from "@sentry/nextjs";

/**
 * POST /api/profile/account/hard-delete - Permanently delete account
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // TODO: Get userId from auth session (Phase 5)
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = getClientIP(req);
    const userAgent = req.headers.get("user-agent") || undefined;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user has a soft delete scheduled
    if (!user.deletedAt) {
      return NextResponse.json(
        { error: "Account is not scheduled for deletion. Use DELETE /api/profile/account first." },
        { status: 400 }
      );
    }

    // Check if grace period has elapsed
    const now = new Date();
    const softDeleteDate = new Date(user.deletedAt);
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

    if (now.getTime() - softDeleteDate.getTime() < thirtyDaysInMs) {
      const daysRemaining = Math.ceil(
        (thirtyDaysInMs - (now.getTime() - softDeleteDate.getTime())) / (24 * 60 * 60 * 1000)
      );
      return NextResponse.json(
        {
          error: "Grace period has not elapsed",
          message: `Please wait ${daysRemaining} more day(s) before permanent deletion`,
          softDeleteDate,
          canDeleteAfter: new Date(softDeleteDate.getTime() + thirtyDaysInMs),
        },
        { status: 400 }
      );
    }

    // Log the hard deletion before actually deleting
    await logAccountDeletion(userId, "hard", userId, ip, userAgent);

    // Hard delete: remove all user data EXCEPT audit logs (required by HIPAA)
    // Cascade delete handles related records (UserProfile, PrivacySettings, etc.)
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      message: "Account permanently deleted",
      deletedAt: new Date().toISOString(),
      note: "Audit logs are retained for 6 years per HIPAA requirements",
    });
  } catch (error) {
    console.error("[api/profile/account/hard-delete] POST error:", error);
    captureException(error, { tags: { category: "hard_delete_error" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
