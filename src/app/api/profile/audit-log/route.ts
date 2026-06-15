/**
 * GET /api/profile/audit-log - View user's account access history (anonymized)
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserAuditLog, logAuditEntry } from "@/lib/privacy/auditLog";
import { getClientIP } from "@/lib/rateLimit/requestUtils";
import { captureException } from "@sentry/nextjs";

/**
 * GET /api/profile/audit-log
 * Returns sanitized audit log (no sensitive values)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // TODO: Get userId from auth session (Phase 5)
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters for pagination
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const action = url.searchParams.get("action") || undefined;

    const ip = getClientIP(req);
    const userAgent = req.headers.get("user-agent") || undefined;

    // Log the audit log access itself (for compliance)
    await logAuditEntry({
      userId,
      action: "DATA_ACCESS",
      resourceType: "audit_log",
      performedBy: userId,
      ipAddress: ip,
      userAgent,
      reason: "User viewed their audit log",
    });

    // Fetch sanitized audit log
    const auditLogs = await getUserAuditLog(userId, { action, limit, offset });

    return NextResponse.json({
      logs: auditLogs,
      pagination: {
        limit,
        offset,
        total: auditLogs.length,
      },
    });
  } catch (error) {
    console.error("[api/profile/audit-log] GET error:", error);
    captureException(error, { tags: { category: "audit_log_get_error" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
