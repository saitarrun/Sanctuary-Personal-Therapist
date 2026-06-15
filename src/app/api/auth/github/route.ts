import { NextRequest, NextResponse } from "next/server";
import { getGitHubOAuthUrl } from "@/lib/auth/oauth";

export async function GET(req: NextRequest) {
  try {
    const { url, state } = getGitHubOAuthUrl();

    const response = NextResponse.redirect(url);
    response.cookies.set("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (error) {
    console.error("[github-oauth] Error:", error);
    return NextResponse.json(
      { error: "Failed to initialize GitHub authentication" },
      { status: 500 }
    );
  }
}
