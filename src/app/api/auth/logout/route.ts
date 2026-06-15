import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  withErrorHandler,
} from "@/lib/middleware/errorMiddleware";
import { clearAuthCookie } from "@/lib/auth/middleware";
import { verifyToken } from "@/lib/auth/jwt";
import { logger } from "@/lib/logging/logger";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const cookie = req.cookies.get("auth_token");
  const token = cookie?.value;

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      try {
        await prisma.authSession.updateMany({
          where: {
            userId: payload.sub,
            isRevoked: false,
          },
          data: {
            isRevoked: true,
            revokedAt: new Date(),
            revokeReason: "logout",
          },
        });

        logger.trackAuthEvent("logout", payload.sub, {});
      } catch (error) {
        console.error("[logout] Failed to revoke sessions:", error);
      }
    }
  }

  const response = NextResponse.json(
    {
      success: true,
      message: "Logged out successfully",
    },
    { status: 200 }
  );

  response.headers.set("Set-Cookie", clearAuthCookie());

  return response;
});
