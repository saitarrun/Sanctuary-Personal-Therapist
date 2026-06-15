/**
 * Phase 7: Session Cleanup & Maintenance
 * Periodic cleanup jobs for expired sessions and tokens.
 * Should be run via cron job or scheduled task.
 */

import { prisma } from "@/lib/db";
import * as Sentry from "@sentry/nextjs";

/**
 * Result of cleanup operation
 */
export interface CleanupResult {
  expiredSessions: number;
  revokedSessions: number;
  oldBlacklistTokens: number;
  expiredCSRFTokens: number;
  totalCleaned: number;
  duration: number; // ms
}

/**
 * Run all cleanup tasks
 * Call this once daily via cron job
 */
export async function runSessionCleanup(): Promise<CleanupResult> {
  const startTime = Date.now();
  let totalCleaned = 0;

  try {
    // Delete expired sessions (older than 7 days)
    const expiredSessions = await deleteExpiredSessions(7);
    totalCleaned += expiredSessions;

    // Delete revoked sessions (older than 7 days, can be deleted faster)
    const revokedSessions = await deleteRevokedSessions(7);
    totalCleaned += revokedSessions;

    // Delete old blacklist entries (keep for 30 days)
    const oldBlacklistTokens = await cleanupOldTokenBlacklist(30);
    totalCleaned += oldBlacklistTokens;

    // Delete expired CSRF tokens
    const expiredCSRFTokens = await cleanupExpiredCSRFTokens();
    totalCleaned += expiredCSRFTokens;

    const duration = Date.now() - startTime;

    const result: CleanupResult = {
      expiredSessions,
      revokedSessions,
      oldBlacklistTokens,
      expiredCSRFTokens,
      totalCleaned,
      duration,
    };

    // Log to Sentry
    Sentry.captureMessage("Session cleanup completed", "info", {
      extra: result,
      tags: {
        component: "session-cleanup",
      },
    });

    return result;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: "session-cleanup" },
    });
    throw error;
  }
}

/**
 * Delete expired sessions (older than specified days)
 * These sessions are past their absolute timeout
 */
export async function deleteExpiredSessions(daysOld: number = 7): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await prisma.authSession.deleteMany({
      where: {
        expiresAt: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`[cleanup] Deleted ${result.count} expired sessions`);
    return result.count;
  } catch (error) {
    console.error("[cleanup] Error deleting expired sessions:", error);
    return 0;
  }
}

/**
 * Delete revoked sessions (older than specified days)
 * Sessions that were explicitly logged out can be deleted sooner
 */
export async function deleteRevokedSessions(daysOld: number = 7): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await prisma.authSession.deleteMany({
      where: {
        isRevoked: true,
        revokedAt: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`[cleanup] Deleted ${result.count} revoked sessions`);
    return result.count;
  } catch (error) {
    console.error("[cleanup] Error deleting revoked sessions:", error);
    return 0;
  }
}

/**
 * Clean up old token blacklist entries
 * Keep entries for audit trail (default 30 days)
 */
export async function cleanupOldTokenBlacklist(daysToKeep: number = 30): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const result = await prisma.tokenBlacklist.deleteMany({
      where: {
        revokedAt: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`[cleanup] Deleted ${result.count} old blacklist entries`);
    return result.count;
  } catch (error) {
    console.error("[cleanup] Error cleaning blacklist:", error);
    return 0;
  }
}

/**
 * Clean up expired CSRF tokens
 */
export async function cleanupExpiredCSRFTokens(): Promise<number> {
  try {
    const result = await prisma.cSRFToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    console.log(`[cleanup] Deleted ${result.count} expired CSRF tokens`);
    return result.count;
  } catch (error) {
    console.error("[cleanup] Error cleaning CSRF tokens:", error);
    return 0;
  }
}

/**
 * Get statistics about sessions
 * Useful for monitoring
 */
export async function getSessionStatistics() {
  try {
    const activeSessions = await prisma.authSession.count({
      where: {
        isRevoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    const expiredSessions = await prisma.authSession.count({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    const revokedSessions = await prisma.authSession.count({
      where: {
        isRevoked: true,
      },
    });

    const blacklistedTokens = await prisma.tokenBlacklist.count();

    const csrfTokens = await prisma.cSRFToken.count();

    return {
      activeSessions,
      expiredSessions,
      revokedSessions,
      blacklistedTokens,
      csrfTokens,
      totalSessions: activeSessions + expiredSessions + revokedSessions,
    };
  } catch (error) {
    console.error("[cleanup] Error getting statistics:", error);
    return null;
  }
}

/**
 * Detect and log suspicious activity
 * Called periodically to identify patterns
 */
export async function detectSuspiciousActivity(): Promise<{
  unusualLogouts: number;
  unusualRefreshes: number;
  multipleNewSessions: number;
} | null> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Find users with many revoked sessions in last hour
    const unusualLogouts = await prisma.authSession.count({
      where: {
        revokedAt: {
          gte: oneHourAgo,
        },
        revokeReason: "logout",
      },
    });

    // Find users with many session creations in last hour
    const unusualRefreshes = await prisma.authSession.count({
      where: {
        createdAt: {
          gte: oneHourAgo,
        },
      },
    });

    // Group by user to find those with multiple new sessions
    const result = await prisma.authSession.groupBy({
      by: ["userId"],
      where: {
        createdAt: {
          gte: oneHourAgo,
        },
      },
      _count: true,
      having: {
        id: {
          _gt: 3, // More than 3 new sessions
        },
      },
    });

    const multipleNewSessions = result.length;

    if (unusualLogouts > 50 || unusualRefreshes > 100 || multipleNewSessions > 10) {
      Sentry.captureMessage("Suspicious session activity detected", "warning", {
        extra: {
          unusualLogouts,
          unusualRefreshes,
          multipleNewSessions,
        },
        tags: {
          component: "session-security",
        },
      });
    }

    return {
      unusualLogouts,
      unusualRefreshes,
      multipleNewSessions,
    };
  } catch (error) {
    console.error("[cleanup] Error detecting suspicious activity:", error);
    return null;
  }
}
