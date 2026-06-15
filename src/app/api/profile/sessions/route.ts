/**
 * GET /api/profile/sessions - List all active sessions for the user
 * DELETE /api/profile/sessions/:id - Revoke a specific session
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientIP } from "@/lib/rateLimit/requestUtils";
import { logAuditEntry } from "@/lib/privacy/auditLog";
import { captureException } from "@sentry/nextjs";

/**
 * GET /api/profile/sessions - List all user's sessions (devices)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // TODO: Get userId from auth session (Phase 5)
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessions = await prisma.authSession.findMany({
      where: {
        userId,
        isRevoked: false,
      },
      select: {
        id: true,
        deviceName: true,
        deviceType: true,
        country: true,
        city: true,
        // Don't expose ipAddress in API response
        lastActivityAt: true,
        createdAt: true,
      },
      orderBy: { lastActivityAt: "desc" },
    });

    return NextResponse.json({
      sessions,
      total: sessions.length,
    });
  } catch (error) {
    console.error("[api/profile/sessions] GET error:", error);
    captureException(error, { tags: { category: "sessions_get_error" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/profile/sessions/:id - Revoke a specific session
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    // TODO: Get userId from auth session (Phase 5)
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract session ID from URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const sessionId = pathParts[pathParts.length - 1];

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const ip = getClientIP(req);
    const userAgent = req.headers.get("user-agent") || undefined;

    // Verify the session belongs to the user
    const session = await prisma.authSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Revoke the session
    const revokedSession = await prisma.authSession.update({
      where: { id: sessionId },
      data: { isRevoked: true },
      select: {
        id: true,
        deviceName: true,
        revokedAt: true,
      },
    });

    // Log session revocation
    await logAuditEntry({
      userId,
      action: "SESSION_REVOKED",
      resourceType: "auth_session",
      performedBy: userId,
      ipAddress: ip,
      userAgent,
      reason: `User revoked session from ${session.deviceName || "unknown device"}`,
    });

    return NextResponse.json({
      message: "Session revoked successfully",
      sessionId: revokedSession.id,
      revokedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[api/profile/sessions] DELETE error:", error);
    captureException(error, { tags: { category: "session_revoke_error" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
