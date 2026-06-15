import { NextRequest, NextResponse } from "next/server";
import { getGoogleOAuthUrl } from "@/lib/auth/oauth";

export async function GET(req: NextRequest) {
  try {
    const { url, state } = getGoogleOAuthUrl();

    const response = NextResponse.redirect(url);
    response.cookies.set("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (error) {
    console.error("[google-oauth] Error:", error);
    return NextResponse.json(
      { error: "Failed to initialize Google authentication" },
      { status: 500 }
    );
  }
}
