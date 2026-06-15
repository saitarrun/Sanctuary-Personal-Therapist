import { createSign, createVerify } from "crypto";

interface TokenPayload {
  sub: string; // userId
  email: string;
  type: "access" | "refresh";
  iat: number;
  exp: number;
}

const ALGORITHM = "RS256";
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes in seconds
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

function getPrivateKey(): string {
  const key = process.env.JWT_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "JWT_PRIVATE_KEY environment variable is not set"
    );
  }
  return key.replace(/\\n/g, "\n");
}

function getPublicKey(): string {
  const key = process.env.JWT_PUBLIC_KEY;
  if (!key) {
    throw new Error(
      "JWT_PUBLIC_KEY environment variable is not set"
    );
  }
  return key.replace(/\\n/g, "\n");
}

export function generateAccessToken(
  userId: string,
  email: string
): string {
  const payload: TokenPayload = {
    sub: userId,
    email,
    type: "access",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRY,
  };

  const privateKey = getPrivateKey();
  const signer = createSign(ALGORITHM);
  signer.update(JSON.stringify(payload));

  return signer.sign(privateKey, "base64");
}

export function generateRefreshToken(userId: string): string {
  const payload: TokenPayload = {
    sub: userId,
    email: "", // Refresh tokens don't need email
    type: "refresh",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + REFRESH_TOKEN_EXPIRY,
  };

  const privateKey = getPrivateKey();
  const signer = createSign(ALGORITHM);
  signer.update(JSON.stringify(payload));

  return signer.sign(privateKey, "base64");
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const publicKey = getPublicKey();
    const verifier = createVerify(ALGORITHM);
    verifier.update(token.split(".").slice(0, 2).join("."));

    // For simple RS256 validation, we need to parse the token manually
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString()
    ) as TokenPayload;

    // Verify signature
    const signature = Buffer.from(parts[2], "base64");
    const isValid = verifier.verify(
      publicKey,
      signature,
      parts[0] + "." + parts[1]
    );

    if (!isValid) {
      return null;
    }

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error("[jwt] Token verification failed:", error);
    return null;
  }
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    return JSON.parse(
      Buffer.from(parts[1], "base64").toString()
    ) as TokenPayload;
  } catch (error) {
    return null;
  }
}

export function getTokenExpiry(token: string): number | null {
  const payload = decodeToken(token);
  return payload?.exp || null;
}

export function isTokenExpired(token: string): boolean {
  const expiry = getTokenExpiry(token);
  if (!expiry) return true;
  return expiry < Math.floor(Date.now() / 1000);
}
