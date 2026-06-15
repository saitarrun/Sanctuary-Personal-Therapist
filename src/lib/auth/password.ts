const crypto = require("crypto");

const HASH_ALGORITHM = "pbkdf2";
const HASH_ITERATIONS = 310000; // OWASP recommendation for 2024
const HASH_DIGEST = "sha256";
const SALT_LENGTH = 32;

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_PATTERNS = {
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /[0-9]/,
  special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
};

export function validatePasswordStrength(
  password: string
): ValidationResult {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`
    );
  }
  if (!PASSWORD_PATTERNS.uppercase.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!PASSWORD_PATTERNS.lowercase.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!PASSWORD_PATTERNS.number.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!PASSWORD_PATTERNS.special.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);

  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    HASH_ITERATIONS,
    64,
    HASH_DIGEST
  );

  // Store as: algorithm:iterations:digest:salt:hash
  return `${HASH_ALGORITHM}:${HASH_ITERATIONS}:${HASH_DIGEST}:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(
  password: string,
  hash: string
): boolean {
  try {
    const parts = hash.split(":");
    if (parts.length !== 5) {
      return false;
    }

    const [algorithm, iterations, digest, saltHex, hashHex] = parts;

    if (algorithm !== HASH_ALGORITHM || digest !== HASH_DIGEST) {
      return false;
    }

    const salt = Buffer.from(saltHex, "hex");
    const iterCount = parseInt(iterations, 10);

    const computedHash = crypto.pbkdf2Sync(
      password,
      salt,
      iterCount,
      64,
      digest
    );

    return computedHash.toString("hex") === hashHex;
  } catch (error) {
    console.error("[password] Verification failed:", error);
    return false;
  }
}
