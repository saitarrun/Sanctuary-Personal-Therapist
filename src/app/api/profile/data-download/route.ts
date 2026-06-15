/**
 * GET /api/profile/data-download - Download all user data in JSON format
 * Implements GDPR/CCPA right-to-access requirement
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientIP } from "@/lib/rateLimit/requestUtils";
import { logDataExport } from "@/lib/privacy/auditLog";
import { captureException } from "@sentry/nextjs";

/**
 * GET /api/profile/data-download
 * Returns user's complete data export
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // TODO: Get userId from auth session (Phase 5)
    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = getClientIP(req);
    const userAgent = req.headers.get("user-agent") || undefined;

    // Fetch all user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userProfile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    const privacySettings = await prisma.privacySettings.findUnique({
      where: { userId },
    });

    const consentLogs = await prisma.consentLog.findMany({
      where: { userId },
      orderBy: { givenAt: "desc" },
    });

    // Fetch all sessions and messages (for chat history)
    const sessions = await prisma.session.findMany({
      include: {
        messages: {
          include: {
            sources: {
              include: {
                chunk: true,
              },
            },
          },
        },
      },
    });

    // Compile complete data export
    const dataExport = {
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        dateOfBirth: user.dateOfBirth,
        phone: user.phone,
        preferences: user.preferences,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      profile: userProfile || null,
      privacySettings: privacySettings || null,
      consentHistory: consentLogs,
      chatHistory: sessions.map((session) => ({
        sessionId: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messages: session.messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          crisisFlag: msg.crisisFlag,
          provider: msg.provider,
          model: msg.model,
          createdAt: msg.createdAt,
          sources: msg.sources.map((source) => ({
            chunkId: source.chunk.id,
            documentTitle: source.chunk.document?.title,
            content: source.chunk.content,
          })),
        })),
      })),
    };

    // Log the export
    await logDataExport(userId, userId, ip, userAgent);

    // Return as JSON file
    return new NextResponse(JSON.stringify(dataExport, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="personal-psychologist-data-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("[api/profile/data-download] GET error:", error);
    captureException(error, { tags: { category: "data_download_error" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
