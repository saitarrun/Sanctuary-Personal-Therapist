import { prisma } from "@/lib/db";
import crypto from "crypto";

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface OAuthToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface OAuthUser {
  id: string;
  email: string;
  name?: string;
}

const STATE_STORE = new Map<string, { state: string; expiresAt: number }>();

function getOAuthConfig(provider: "google" | "github"): OAuthConfig {
  if (provider === "google") {
    return {
      clientId: process.env.OAUTH_GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET || "",
      redirectUri:
        process.env.OAUTH_GOOGLE_REDIRECT_URI ||
        "http://localhost:3000/api/auth/google/callback",
    };
  } else {
    return {
      clientId: process.env.OAUTH_GITHUB_CLIENT_ID || "",
      clientSecret: process.env.OAUTH_GITHUB_CLIENT_SECRET || "",
      redirectUri:
        process.env.OAUTH_GITHUB_REDIRECT_URI ||
        "http://localhost:3000/api/auth/github/callback",
    };
  }
}

function generateState(): string {
  const state = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  STATE_STORE.set(state, { state, expiresAt });
  return state;
}

function verifyState(state: string): boolean {
  const stored = STATE_STORE.get(state);
  if (!stored || stored.expiresAt < Date.now()) {
    STATE_STORE.delete(state);
    return false;
  }
  STATE_STORE.delete(state);
  return true;
}

export function getGoogleOAuthUrl(): { url: string; state: string } {
  const config = getOAuthConfig("google");
  const state = generateState();

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
  });

  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    state,
  };
}

export function getGitHubOAuthUrl(): { url: string; state: string } {
  const config = getOAuthConfig("github");
  const state = generateState();

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: "user:email",
    state,
    allow_signup: "true",
  });

  return {
    url: `https://github.com/login/oauth/authorize?${params.toString()}`,
    state,
  };
}

async function exchangeCodeForToken(
  provider: "google" | "github",
  code: string
): Promise<OAuthToken> {
  const config = getOAuthConfig(provider);

  if (provider === "google") {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error("Failed to exchange Google auth code");
    }

    return response.json();
  } else {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error("Failed to exchange GitHub auth code");
    }

    return response.json();
  }
}

async function getGoogleUserInfo(accessToken: string): Promise<OAuthUser> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Google user info");
  }

  const data = await response.json();
  return {
    id: data.sub,
    email: data.email,
    name: data.name,
  };
}

async function getGitHubUserInfo(accessToken: string): Promise<OAuthUser> {
  const response = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch GitHub user info");
  }

  const userData = await response.json();

  // Get email if not in user profile
  let email = userData.email;
  if (!email) {
    const emailResponse = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (emailResponse.ok) {
      const emails = await emailResponse.json();
      const primaryEmail = emails.find(
        (e: { email: string; primary: boolean }) => e.primary
      );
      email = primaryEmail?.email || emails[0]?.email;
    }
  }

  return {
    id: userData.id.toString(),
    email: email || `user${userData.id}@github.local`,
    name: userData.name || userData.login,
  };
}

export async function handleOAuthCallback(
  provider: "google" | "github",
  code: string,
  state: string
): Promise<{
  userId: string;
  email: string;
  name?: string;
  isNewUser: boolean;
}> {
  if (!verifyState(state)) {
    throw new Error("Invalid OAuth state");
  }

  const token = await exchangeCodeForToken(provider, code);
  const userInfo =
    provider === "google"
      ? await getGoogleUserInfo(token.access_token)
      : await getGitHubUserInfo(token.access_token);

  let user = await prisma.user.findUnique({
    where: { email: userInfo.email },
  });

  const isNewUser = !user;

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: userInfo.email,
        firstName: userInfo.name?.split(" ")[0],
        lastName: userInfo.name?.split(" ").slice(1).join(" "),
        emailVerified: true,
        authMethod: provider === "google" ? "GOOGLE" : "GITHUB",
      },
    });
  }

  // Create or update OAuth account
  await prisma.oAuthAccount.upsert({
    where: {
      provider_providerUserId: {
        provider,
        providerUserId: userInfo.id,
      },
    },
    create: {
      userId: user.id,
      provider,
      providerUserId: userInfo.id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token || null,
      expiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : null,
    },
    update: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || undefined,
      expiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : undefined,
    },
  });

  return {
    userId: user.id,
    email: user.email,
    name: userInfo.name,
    isNewUser,
  };
}
