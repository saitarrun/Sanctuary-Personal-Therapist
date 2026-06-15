/**
 * GET /api/profile/consent-history - Get user's consent agreement history
 * POST /api/profile/consent-history - Record new consent
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientIP } from "@/lib/rateLimit/requestUtils";
import {
  recordConsent,
  getConsentHistory,
  getPoliciesNeedingReconsent,
  getConsentSummary,
  ConsentTypeValues,
} from "@/lib/privacy/consent";
import { captureException } from "@sentry/nextjs";

/**
 * GET /api/profile/consent-history
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // TODO: Get userId from auth session (Phase 5)
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const history = await getConsentHistory(userId);
    const summary = await getConsentSummary(userId);
    const policiesNeedingReconsent = await getPoliciesNeedingReconsent(userId);

    return NextResponse.json({
      history,
      summary,
      policiesNeedingReconsent,
    });
  } catch (error) {
    console.error("[api/profile/consent-history] GET error:", error);
    captureException(error, { tags: { category: "consent_history_get_error" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/profile/consent-history - Record new consent
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // TODO: Get userId from auth session (Phase 5)
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { consentType, consented } = body;

    if (!consentType) {
      return NextResponse.json(
        { error: "consentType is required" },
        { status: 400 }
      );
    }

    const ip = getClientIP(req);
    const userAgent = req.headers.get("user-agent") || undefined;

    const success = await recordConsent(
      userId,
      consentType as ConsentTypeValues,
      consented,
      ip,
      userAgent
    );

    if (!success) {
      return NextResponse.json(
        { error: "Failed to record consent" },
        { status: 500 }
      );
    }

    const updatedSummary = await getConsentSummary(userId);

    return NextResponse.json({
      success: true,
      summary: updatedSummary,
    });
  } catch (error) {
    console.error("[api/profile/consent-history] POST error:", error);
    captureException(error, { tags: { category: "consent_recording_error" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
