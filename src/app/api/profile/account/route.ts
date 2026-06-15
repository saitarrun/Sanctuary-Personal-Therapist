/**
 * DELETE /api/profile/account - Soft delete (anonymize) user account
 * Account is marked for deletion with 30-day grace period for recovery
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientIP } from "@/lib/rateLimit/requestUtils";
import { logAccountDeletion } from "@/lib/privacy/auditLog";
import { captureException } from "@sentry/nextjs";

/**
 * DELETE /api/profile/account - Request soft deletion of account
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    // TODO: Get userId from auth session (Phase 5)
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = getClientIP(req);
    const userAgent = req.headers.get("user-agent") || undefined;

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Soft delete: mark account as deleted but keep audit logs
    const softDeleteDate = new Date();
    const hardDeleteDate = new Date(softDeleteDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const deletedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: softDeleteDate,
        hardDeleteAt: hardDeleteDate,
      },
      select: {
        id: true,
        email: true,
        deletedAt: true,
        hardDeleteAt: true,
      },
    });

    // Log the deletion request
    await logAccountDeletion(userId, "soft", userId, ip, userAgent);

    return NextResponse.json({
      message: "Account scheduled for deletion",
      deletedAt: deletedUser.deletedAt,
      hardDeleteAt: deletedUser.hardDeleteAt,
      recoveryPeriodDays: 30,
      note: "Your account will be permanently deleted on the date shown above unless you cancel the deletion.",
    });
  } catch (error) {
    console.error("[api/profile/account] DELETE error:", error);
    captureException(error, { tags: { category: "account_deletion_error" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
