/**
 * GET /api/profile - Get current user profile
 * PUT /api/profile - Update profile (firstName, lastName, preferences)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientIP } from "@/lib/rateLimit/requestUtils";
import { logAuditEntry, logDataModification } from "@/lib/privacy/auditLog";
import { captureException } from "@sentry/nextjs";

/**
 * GET /api/profile - Retrieve user's profile
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // TODO: Get userId from auth session (Phase 5)
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Log data access
    const ip = getClientIP(req);
    const userAgent = req.headers.get("user-agent") || undefined;
    await logAuditEntry({
      userId,
      action: "DATA_ACCESS",
      resourceType: "profile",
      performedBy: userId,
      ipAddress: ip,
      userAgent,
      reason: "User accessed own profile",
    });

    // Fetch user profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        preferences: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userProfile = await prisma.userProfile.findUnique({
      where: { userId },
      select: {
        bio: true,
        avatar: true,
        privacyLevel: true,
      },
    });

    return NextResponse.json({
      ...user,
      profile: userProfile || {},
    });
  } catch (error) {
    console.error("[api/profile] GET error:", error);
    captureException(error, { tags: { category: "profile_get_error" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/profile - Update user profile
 */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    // TODO: Get userId from auth session (Phase 5)
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { firstName, lastName, preferences } = body;

    const ip = getClientIP(req);
    const userAgent = req.headers.get("user-agent") || undefined;

    // Fetch current user data for audit log
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        preferences: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(preferences !== undefined && { preferences }),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        preferences: true,
        updatedAt: true,
      },
    });

    // Log modifications
    if (firstName !== undefined && firstName !== currentUser.firstName) {
      await logDataModification(
        userId,
        "firstName",
        currentUser.firstName || "",
        firstName,
        userId,
        ip,
        userAgent
      );
    }

    if (lastName !== undefined && lastName !== currentUser.lastName) {
      await logDataModification(
        userId,
        "lastName",
        currentUser.lastName || "",
        lastName,
        userId,
        ip,
        userAgent
      );
    }

    if (preferences !== undefined && JSON.stringify(preferences) !== JSON.stringify(currentUser.preferences)) {
      await logDataModification(
        userId,
        "preferences",
        JSON.stringify(currentUser.preferences),
        JSON.stringify(preferences),
        userId,
        ip,
        userAgent
      );
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("[api/profile] PUT error:", error);
    captureException(error, { tags: { category: "profile_update_error" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
