import crypto from "crypto";

const VERIFICATION_TOKEN_EXPIRY = 15 * 60 * 1000; // 15 minutes
const PASSWORD_RESET_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour
const TOKEN_CLEANUP_INTERVAL = 60 * 1000; // Clean every minute

interface StoredToken {
  token: string;
  email: string;
  expiresAt: number;
  type: "verification" | "reset";
}

const tokenStore = new Map<string, StoredToken>();

// Cleanup expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, stored] of tokenStore.entries()) {
    if (stored.expiresAt < now) {
      tokenStore.delete(key);
    }
  }
}, TOKEN_CLEANUP_INTERVAL);

export function createVerificationToken(email: string): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const now = Date.now();
  const expiresAt = now + VERIFICATION_TOKEN_EXPIRY;

  tokenStore.set(code, {
    token: code,
    email: email.toLowerCase(),
    expiresAt,
    type: "verification",
  });

  return code;
}

export function createPasswordResetToken(email: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const expiresAt = now + PASSWORD_RESET_TOKEN_EXPIRY;

  tokenStore.set(token, {
    token,
    email: email.toLowerCase(),
    expiresAt,
    type: "reset",
  });

  return token;
}

export function verifyToken(
  token: string,
  type: "verification" | "reset"
): { valid: boolean; email?: string } {
  const stored = tokenStore.get(token);

  if (!stored) {
    return { valid: false };
  }

  if (stored.type !== type) {
    return { valid: false };
  }

  if (stored.expiresAt < Date.now()) {
    tokenStore.delete(token);
    return { valid: false };
  }

  return { valid: true, email: stored.email };
}

export function consumeToken(token: string): boolean {
  return tokenStore.delete(token);
}

export function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [key, stored] of tokenStore.entries()) {
    if (stored.expiresAt < now) {
      tokenStore.delete(key);
    }
  }
}
