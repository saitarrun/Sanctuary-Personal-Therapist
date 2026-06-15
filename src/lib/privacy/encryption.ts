/**
 * AES-256-GCM encryption for sensitive PII (phone, dateOfBirth, etc.)
 * Uses ENCRYPTION_KEY from environment variables.
 * Supports key versioning for rotation.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const AUTH_TAG_LENGTH = 16; // 128 bits
const IV_LENGTH = 12; // 96 bits (recommended for GCM)

interface EncryptedData {
  iv: string;
  authTag: string;
  encryptedData: string;
  keyVersion: number; // For key rotation support
}

/**
 * Get encryption key from environment
 * Format: base64-encoded 32-byte key
 * If not provided, uses a development-only key (NEVER use in production)
 */
function getEncryptionKey(): Buffer {
  const keyEnv = process.env.ENCRYPTION_KEY;

  if (!keyEnv) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ENCRYPTION_KEY environment variable is required in production"
      );
    }
    // Development fallback — generates a consistent key for local testing
    // WARNING: This is NOT secure; only use for development
    console.warn(
      "[SECURITY WARNING] Using development encryption key. Set ENCRYPTION_KEY in production."
    );
    return crypto
      .createHash("sha256")
      .update("dev-key-not-for-production")
      .digest();
  }

  try {
    const keyBuffer = Buffer.from(keyEnv, "base64");
    if (keyBuffer.length !== 32) {
      throw new Error("Encryption key must be exactly 32 bytes (256 bits)");
    }
    return keyBuffer;
  } catch (error) {
    throw new Error(
      `Failed to decode ENCRYPTION_KEY: ${error instanceof Error ? error.message : "unknown error"}`
    );
  }
}

/**
 * Encrypt sensitive data using AES-256-GCM
 * Returns JSON with iv, authTag, and encryptedData (all base64-encoded)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return plaintext;
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const encryptedData: EncryptedData = {
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    encryptedData: encrypted.toString("base64"),
    keyVersion: 1, // For future key rotation
  };

  return JSON.stringify(encryptedData);
}

/**
 * Decrypt sensitive data that was encrypted with encrypt()
 */
export function decrypt(encryptedJson: string): string {
  if (!encryptedJson) {
    return encryptedJson;
  }

  try {
    const key = getEncryptionKey();
    const encryptedData: EncryptedData = JSON.parse(encryptedJson);

    const iv = Buffer.from(encryptedData.iv, "base64");
    const authTag = Buffer.from(encryptedData.authTag, "base64");
    const encrypted = Buffer.from(encryptedData.encryptedData, "base64");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    console.error("[ENCRYPTION] Decryption failed:", error);
    // Return encrypted data as-is if decryption fails
    // This prevents data loss but logs the issue
    return encryptedJson;
  }
}

/**
 * Hash sensitive data for audit logs (one-way, can't be reversed)
 * Used for logging old/new values without storing plaintext
 */
export function hashValue(value: string): string {
  if (!value) {
    return value;
  }
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Anonymize IP address by zeroing the last octet
 * e.g., 192.168.1.42 -> 192.168.1.0
 */
export function anonymizeIP(ip: string): string {
  if (!ip) {
    return "";
  }

  const parts = ip.split(".");
  if (parts.length === 4) {
    // IPv4
    parts[3] = "0";
    return parts.join(".");
  }

  if (ip.includes(":")) {
    // IPv6 — zero last 64 bits
    const colonParts = ip.split(":");
    if (colonParts.length >= 4) {
      // Zero the last 4 parts (64 bits)
      colonParts[colonParts.length - 1] = "0";
      colonParts[colonParts.length - 2] = "0";
      colonParts[colonParts.length - 3] = "0";
      colonParts[colonParts.length - 4] = "0";
      return colonParts.join(":");
    }
  }

  // If neither IPv4 nor IPv6, return as-is
  return ip;
}

/**
 * Generate a new encryption key (for key rotation)
 * Returns base64-encoded 32-byte key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("base64");
}

/**
 * Test encryption/decryption (for unit tests)
 */
export function testEncryption(): boolean {
  try {
    const testData = "sensitive-data-12345";
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted);
    return decrypted === testData;
  } catch (error) {
    console.error("[ENCRYPTION] Test failed:", error);
    return false;
  }
}
