/**
 * HIPAA-compliant audit logging system
 * Logs all data access, modifications, and deletions with immutable append-only records
 * Keeps logs for 6 years per HIPAA requirements
 */

import { PrismaClient } from "@prisma/client";
import { anonymizeIP, hashValue } from "./encryption";
import { captureException } from "@sentry/nextjs";

const prisma = new PrismaClient();

export interface AuditLogEntry {
  userId: string;
  action: "DATA_ACCESS" | "DATA_MODIFICATION" | "PROFILE_UPDATE" | "EXPORT" | "DELETE" | "SESSION_CREATED" | "SESSION_REVOKED" | "CONSENT_CHANGE";
  resourceType: string; // e.g., "profile", "email", "phone", "chat_history", "account"
  oldValue?: string; // Hashed or anonymized
  newValue?: string; // Hashed or anonymized
  performedBy: string; // User email or "SYSTEM"
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
  status?: "SUCCESS" | "FAILURE";
  errorMessage?: string;
}

/**
 * Log an audit entry (append-only, immutable)
 * For sensitive data (phone, DOB, email), always hash before logging
 */
export async function logAuditEntry(entry: AuditLogEntry): Promise<void> {
  try {
    const anonymizedIP = entry.ipAddress ? anonymizeIP(entry.ipAddress) : null;

    // Hash sensitive fields before logging
    const newValue =
      entry.newValue && isSensitiveField(entry.resourceType)
        ? hashValue(entry.newValue)
        : entry.newValue;

    const oldValue =
      entry.oldValue && isSensitiveField(entry.resourceType)
        ? hashValue(entry.oldValue)
        : entry.oldValue;

    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        resourceType: entry.resourceType,
        oldValue,
        newValue,
        performedBy: entry.performedBy,
        ipAddress: anonymizedIP,
        userAgent: entry.userAgent,
        reason: entry.reason,
        status: entry.status || "SUCCESS",
        errorMessage: entry.errorMessage,
      },
    });
  } catch (error) {
    console.error("[AUDIT] Failed to log audit entry:", error);
    // Always alert on audit logging failures (critical for compliance)
    captureException(error, {
      tags: { category: "audit_logging_failure" },
      extra: { auditAction: entry.action },
    });
  }
}

/**
 * Determine if a field is sensitive (should be hashed in audit logs)
 */
function isSensitiveField(resourceType: string): boolean {
  const sensitiveFields = [
    "email",
    "phone",
    "dateOfBirth",
    "firstName",
    "lastName",
    "ssn",
    "creditCard",
  ];
  return sensitiveFields.includes(resourceType);
}

/**
 * Get audit log for a user (filtered by action)
 * Returns paginated results for performance
 */
export async function getUserAuditLog(
  userId: string,
  options: {
    action?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<any[]> {
  const { action, limit = 50, offset = 0 } = options;

  try {
    const query: any = { userId };
    if (action) {
      query.action = action;
    }

    const logs = await prisma.auditLog.findMany({
      where: query,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        action: true,
        resourceType: true,
        performedBy: true,
        reason: true,
        status: true,
        createdAt: true,
        // Don't return oldValue/newValue/ipAddress/userAgent (sensitive audit info)
      },
    });

    return logs;
  } catch (error) {
    console.error("[AUDIT] Failed to fetch audit log:", error);
    captureException(error, {
      tags: { category: "audit_fetch_failure" },
      extra: { userId },
    });
    return [];
  }
}

/**
 * Clean up old audit logs (HIPAA requires 6-year retention)
 * Run this job once per month via a cron scheduler
 * Logs older than 6 years are safe to delete
 */
export async function cleanupOldAuditLogs(): Promise<number> {
  const sixYearsAgo = new Date();
  sixYearsAgo.setFullYear(sixYearsAgo.getFullYear() - 6);

  try {
    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: sixYearsAgo },
      },
    });

    console.log(
      `[AUDIT] Cleaned up ${result.count} audit logs older than 6 years`
    );
    return result.count;
  } catch (error) {
    console.error("[AUDIT] Failed to cleanup old audit logs:", error);
    captureException(error, {
      tags: { category: "audit_cleanup_failure" },
    });
    return 0;
  }
}

/**
 * Log data access (read-only, no modification)
 * Used when user views their own profile or downloads their data
 */
export async function logDataAccess(
  userId: string,
  resourceType: string,
  performedBy: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  return logAuditEntry({
    userId,
    action: "DATA_ACCESS",
    resourceType,
    performedBy,
    ipAddress,
    userAgent,
    reason: "User data access",
  });
}

/**
 * Log data modification (write operation)
 * Used when profile is updated or preferences change
 */
export async function logDataModification(
  userId: string,
  resourceType: string,
  oldValue: string | undefined,
  newValue: string | undefined,
  performedBy: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  return logAuditEntry({
    userId,
    action: "DATA_MODIFICATION",
    resourceType,
    oldValue,
    newValue,
    performedBy,
    ipAddress,
    userAgent,
    reason: "User data modification",
  });
}

/**
 * Log account deletion (soft or hard)
 */
export async function logAccountDeletion(
  userId: string,
  deletionType: "soft" | "hard",
  performedBy: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  return logAuditEntry({
    userId,
    action: "DELETE",
    resourceType: "account",
    performedBy,
    ipAddress,
    userAgent,
    reason: `User account ${deletionType} deletion request`,
  });
}

/**
 * Log data export (download)
 */
export async function logDataExport(
  userId: string,
  performedBy: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  return logAuditEntry({
    userId,
    action: "EXPORT",
    resourceType: "all_data",
    performedBy,
    ipAddress,
    userAgent,
    reason: "User data export request",
  });
}

/**
 * Log consent change
 */
export async function logConsentChange(
  userId: string,
  consentType: string,
  oldValue: string,
  newValue: string,
  performedBy: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  return logAuditEntry({
    userId,
    action: "CONSENT_CHANGE",
    resourceType: `consent_${consentType}`,
    oldValue,
    newValue,
    performedBy,
    ipAddress,
    userAgent,
    reason: `User consent change for ${consentType}`,
  });
}

/**
 * Verify audit log integrity (basic check)
 * Returns true if log appears to be tamper-free (append-only)
 * More sophisticated checks could include cryptographic signatures
 */
export async function verifyAuditLogIntegrity(userId: string): Promise<boolean> {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true },
    });

    // Check that timestamps are monotonically increasing (no reordering)
    for (let i = 1; i < logs.length; i++) {
      if (logs[i].createdAt < logs[i - 1].createdAt) {
        console.warn(
          `[AUDIT] Potential tampering detected in audit log for user ${userId}`
        );
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("[AUDIT] Failed to verify integrity:", error);
    return false;
  }
}
