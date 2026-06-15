/**
 * GET /api/profile/privacy-settings - Get user's privacy preferences
 * PUT /api/profile/privacy-settings - Update privacy settings
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientIP } from "@/lib/rateLimit/requestUtils";
import { logDataModification } from "@/lib/privacy/auditLog";
import { captureException } from "@sentry/nextjs";

/**
 * GET /api/profile/privacy-settings
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // TODO: Get userId from auth session (Phase 5)
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let privacySettings = await prisma.privacySettings.findUnique({
      where: { userId },
    });

    // Create default privacy settings if they don't exist
    if (!privacySettings) {
      privacySettings = await prisma.privacySettings.create({
        data: {
          userId,
          dataCollectionOptIn: true,
          shareWithResearch: false,
          marketingEmails: false,
        },
      });
    }

    return NextResponse.json(privacySettings);
  } catch (error) {
    console.error("[api/profile/privacy-settings] GET error:", error);
    captureException(error, { tags: { category: "privacy_settings_get_error" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/profile/privacy-settings
 */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    // TODO: Get userId from auth session (Phase 5)
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { dataCollectionOptIn, shareWithResearch, marketingEmails } = body;

    const ip = getClientIP(req);
    const userAgent = req.headers.get("user-agent") || undefined;

    // Fetch current settings for audit log
    let currentSettings = await prisma.privacySettings.findUnique({
      where: { userId },
    });

    if (!currentSettings) {
      currentSettings = await prisma.privacySettings.create({
        data: {
          userId,
          dataCollectionOptIn: true,
          shareWithResearch: false,
          marketingEmails: false,
        },
      });
    }

    // Update privacy settings
    const updatedSettings = await prisma.privacySettings.update({
      where: { userId },
      data: {
        ...(dataCollectionOptIn !== undefined && { dataCollectionOptIn }),
        ...(shareWithResearch !== undefined && { shareWithResearch }),
        ...(marketingEmails !== undefined && { marketingEmails }),
        updatedAt: new Date(),
      },
    });

    // Log modifications
    if (dataCollectionOptIn !== undefined && dataCollectionOptIn !== currentSettings.dataCollectionOptIn) {
      await logDataModification(
        userId,
        "dataCollectionOptIn",
        String(currentSettings.dataCollectionOptIn),
        String(dataCollectionOptIn),
        userId,
        ip,
        userAgent
      );
    }

    if (shareWithResearch !== undefined && shareWithResearch !== currentSettings.shareWithResearch) {
      await logDataModification(
        userId,
        "shareWithResearch",
        String(currentSettings.shareWithResearch),
        String(shareWithResearch),
        userId,
        ip,
        userAgent
      );
    }

    if (marketingEmails !== undefined && marketingEmails !== currentSettings.marketingEmails) {
      await logDataModification(
        userId,
        "marketingEmails",
        String(currentSettings.marketingEmails),
        String(marketingEmails),
        userId,
        ip,
        userAgent
      );
    }

    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error("[api/profile/privacy-settings] PUT error:", error);
    captureException(error, { tags: { category: "privacy_settings_update_error" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
