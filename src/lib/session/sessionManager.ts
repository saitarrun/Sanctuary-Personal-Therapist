/**
 * Phase 7: Session Manager
 * Handles CRUD operations for authentication sessions.
 * Manages session creation, validation, revocation, and cleanup.
 */

import { prisma } from "@/lib/db";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  TokenPayload,
  verifyToken,
} from "./tokenManager";
import { anonymizeIP } from "@/lib/rateLimit/requestUtils";

/**
 * Session creation input
 */
export interface CreateSessionInput {
  userId: string;
  email: string;
  userAgent?: string;
  ipAddress?: string;
  ipAddressFull?: string;
  deviceName?: string;
  deviceType?: string;
  country?: string;
  city?: string;
}

/**
 * Session creation result
 */
export interface CreateSessionResult {
  sessionId: string;
  accessToken: string;
  accessTokenHash: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
}

/**
 * Active session info (for listing)
 */
export interface SessionInfo {
  id: string;
  deviceName?: string;
  deviceType?: string;
  ipAddress?: string;
  country?: string;
  city?: string;
  lastActivityAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Create a new authentication session
 * Returns tokens that should be sent to client (access in memory, refresh in httpOnly cookie)
 */
export async function createSession(
  input: CreateSessionInput
): Promise<CreateSessionResult> {
  const userId = input.userId;
  const email = input.email;

  // Generate access token (15 min)
  const accessTokenResult = generateAccessToken(userId, email, "temp");
  const accessTokenHash = hashToken(accessTokenResult.token);

  // Generate refresh token (7 days)
  const refreshTokenResult = generateRefreshToken(userId, email, "temp", 7);
  const refreshTokenHash = hashToken(refreshTokenResult.token);

  // Create session in database
  const session = await prisma.authSession.create({
    data: {
      userId,
      accessTokenHash,
      refreshTokenHash,
      deviceName: input.deviceName,
      deviceType: input.deviceType,
      ipAddress: input.ipAddress ? anonymizeIP(input.ipAddress) : null,
      ipAddressFull: input.ipAddressFull, // Encrypted in production
      country: input.country,
      city: input.city,
      expiresAt: accessTokenResult.expiresAt,
      refreshExpiresAt: refreshTokenResult.expiresAt,
    },
  });

  // Update tokens with real session ID
  const accessTokenWithSession = generateAccessToken(userId, email, session.id);
  const refreshTokenWithSession = generateRefreshToken(
    userId,
    email,
    session.id,
    7
  );

  // Update session with correct token hashes
  await prisma.authSession.update({
    where: { id: session.id },
    data: {
      accessTokenHash: hashToken(accessTokenWithSession.token),
      refreshTokenHash: hashToken(refreshTokenWithSession.token),
      expiresAt: accessTokenWithSession.expiresAt,
      refreshExpiresAt: refreshTokenWithSession.expiresAt,
    },
  });

  return {
    sessionId: session.id,
    accessToken: accessTokenWithSession.token,
    accessTokenHash: hashToken(accessTokenWithSession.token),
    accessTokenExpiresAt: accessTokenWithSession.expiresAt,
    refreshToken: refreshTokenWithSession.token,
    refreshTokenHash: hashToken(refreshTokenWithSession.token),
    refreshTokenExpiresAt: refreshTokenWithSession.expiresAt,
  };
}

/**
 * Validate a session by token
 * Returns null if session invalid, expired, or revoked
 */
export async function validateSession(
  accessToken: string
): Promise<{ userId: string; sessionId: string; email: string } | null> {
  // Verify token signature and expiration
  const verify = verifyToken(accessToken);
  if (!verify.valid || !verify.payload) {
    return null;
  }

  const payload = verify.payload;

  // Check if token is in blacklist
  const isBlacklisted = await prisma.tokenBlacklist.findUnique({
    where: { tokenHash: hashToken(accessToken) },
  });

  if (isBlacklisted) {
    return null;
  }

  // Verify session exists and is not revoked
  const session = await prisma.authSession.findUnique({
    where: { id: payload.sessionId },
  });

  if (!session || session.isRevoked || session.revokedAt) {
    return null;
  }

  return {
    userId: payload.sub,
    sessionId: payload.sessionId,
    email: payload.email,
  };
}

/**
 * Refresh an access token using refresh token
 * Implements token rotation: old refresh token is invalidated
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{
  accessToken: string;
  accessTokenHash: string;
  accessTokenExpiresAt: Date;
  newRefreshToken?: string;
  newRefreshTokenHash?: string;
  newRefreshTokenExpiresAt?: Date;
} | null> {
  // Verify refresh token
  const verify = verifyToken(refreshToken);
  if (!verify.valid || !verify.payload) {
    return null;
  }

  const payload = verify.payload;

  // Check if token is blacklisted
  const isBlacklisted = await prisma.tokenBlacklist.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
  });

  if (isBlacklisted) {
    return null;
  }

  // Get session
  const session = await prisma.authSession.findUnique({
    where: { id: payload.sessionId },
  });

  if (!session || session.isRevoked || session.revokedAt) {
    return null;
  }

  // Verify session's refresh token hash matches
  if (session.refreshTokenHash !== hashToken(refreshToken)) {
    // Token mismatch - possible token reuse attack
    // Revoke entire session
    await revokeSession(session.id, "suspicious_activity");
    return null;
  }

  // Generate new access token
  const newAccessToken = generateAccessToken(
    payload.sub,
    payload.email,
    session.id
  );

  // Token rotation: issue new refresh token and invalidate old one
  const newRefreshToken = generateRefreshToken(
    payload.sub,
    payload.email,
    session.id,
    7
  );

  // Blacklist old refresh token
  await prisma.tokenBlacklist.create({
    data: {
      userId: payload.sub,
      tokenHash: hashToken(refreshToken),
      tokenType: "refresh",
      reason: "refresh_rotation",
    },
  });

  // Update session with new token hashes
  await prisma.authSession.update({
    where: { id: session.id },
    data: {
      accessTokenHash: hashToken(newAccessToken.token),
      refreshTokenHash: hashToken(newRefreshToken.token),
      expiresAt: newAccessToken.expiresAt,
      refreshExpiresAt: newRefreshToken.expiresAt,
      lastActivityAt: new Date(),
    },
  });

  return {
    accessToken: newAccessToken.token,
    accessTokenHash: hashToken(newAccessToken.token),
    accessTokenExpiresAt: newAccessToken.expiresAt,
    newRefreshToken: newRefreshToken.token,
    newRefreshTokenHash: hashToken(newRefreshToken.token),
    newRefreshTokenExpiresAt: newRefreshToken.expiresAt,
  };
}

/**
 * Update last activity timestamp
 */
export async function updateSessionActivity(
  sessionId: string
): Promise<boolean> {
  try {
    await prisma.authSession.update({
      where: { id: sessionId },
      data: {
        lastActivityAt: new Date(),
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<SessionInfo[]> {
  const sessions = await prisma.authSession.findMany({
    where: {
      userId,
      isRevoked: false,
    },
    select: {
      id: true,
      deviceName: true,
      deviceType: true,
      ipAddress: true,
      country: true,
      city: true,
      lastActivityAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: {
      lastActivityAt: "desc",
    },
  });

  return sessions as SessionInfo[];
}

/**
 * Revoke a specific session (logout from one device)
 */
export async function revokeSession(
  sessionId: string,
  reason: string = "logout"
): Promise<boolean> {
  try {
    // Find session to get user ID and tokens
    const session = await prisma.authSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return false;
    }

    // Blacklist tokens
    if (session.accessTokenHash) {
      await prisma.tokenBlacklist.create({
        data: {
          userId: session.userId,
          tokenHash: session.accessTokenHash,
          tokenType: "access",
          reason,
        },
      });
    }

    if (session.refreshTokenHash) {
      await prisma.tokenBlacklist.create({
        data: {
          userId: session.userId,
          tokenHash: session.refreshTokenHash,
          tokenType: "refresh",
          reason,
        },
      });
    }

    // Mark session as revoked
    await prisma.authSession.update({
      where: { id: sessionId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Revoke all sessions for a user (logout from all devices)
 */
export async function revokeAllUserSessions(
  userId: string,
  reason: string = "logout_all"
): Promise<number> {
  try {
    // Find all active sessions
    const sessions = await prisma.authSession.findMany({
      where: {
        userId,
        isRevoked: false,
      },
    });

    // Blacklist all tokens
    const blacklistPromises = [];
    for (const session of sessions) {
      if (session.accessTokenHash) {
        blacklistPromises.push(
          prisma.tokenBlacklist.create({
            data: {
              userId,
              tokenHash: session.accessTokenHash,
              tokenType: "access",
              reason,
            },
          })
        );
      }

      if (session.refreshTokenHash) {
        blacklistPromises.push(
          prisma.tokenBlacklist.create({
            data: {
              userId,
              tokenHash: session.refreshTokenHash,
              tokenType: "refresh",
              reason,
            },
          })
        );
      }
    }

    await Promise.all(blacklistPromises);

    // Revoke all sessions
    const result = await prisma.authSession.updateMany({
      where: {
        userId,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });

    return result.count;
  } catch {
    return 0;
  }
}

/**
 * Delete expired sessions (cleanup job)
 * Should be run daily or via cron
 */
export async function deleteExpiredSessions(): Promise<number> {
  try {
    const result = await prisma.authSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  } catch {
    return 0;
  }
}

/**
 * Delete old blacklist entries (cleanup job)
 * Keep entries for 30 days for security audit
 */
export async function cleanupTokenBlacklist(daysToKeep: number = 30): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const result = await prisma.tokenBlacklist.deleteMany({
      where: {
        revokedAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  } catch {
    return 0;
  }
}
