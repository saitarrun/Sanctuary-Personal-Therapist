import { PrismaClient } from "@prisma/client";
import { getMonitor } from "@/lib/performance/monitor";
import { encrypt, decrypt } from "./privacy/encryption";

// Reuse a single PrismaClient across hot reloads in dev to avoid exhausting
// database connections.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Database connection pooling configuration
const dbConfig = {
  maxPoolSize: parseInt(process.env.DATABASE_URL_POOL_SIZE ?? "10", 10),
  minPoolSize: 2,
};

/**
 * Sensitive fields that should be encrypted at rest
 * Maps model names to field names that need encryption
 * Phase 6: Encryption of PII (phone, dateOfBirth)
 */
const ENCRYPTED_FIELDS: Record<string, string[]> = {
  User: ["phone", "dateOfBirth"],
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// Phase 6: Encryption middleware for sensitive PII
// Automatically encrypts/decrypts sensitive fields before/after database operations
prisma.$use(async (params, next) => {
  // Encrypt before write operations
  if (
    (params.action === "create" || params.action === "update" || params.action === "upsert") &&
    params.args.data
  ) {
    const fieldsToEncrypt = ENCRYPTED_FIELDS[params.model];
    if (fieldsToEncrypt) {
      for (const field of fieldsToEncrypt) {
        if (params.args.data[field]) {
          params.args.data[field] = encrypt(params.args.data[field]);
        }
      }
    }
  }

  // Execute database operation
  const result = await next(params);

  // Decrypt after read operations
  if (
    (params.action === "findUnique" ||
      params.action === "findMany" ||
      params.action === "findFirst" ||
      params.action === "findUniqueOrThrow" ||
      params.action === "findFirstOrThrow") &&
    result
  ) {
    const fieldsToDecrypt = ENCRYPTED_FIELDS[params.model];
    if (fieldsToDecrypt) {
      if (Array.isArray(result)) {
        result.forEach((item) => {
          for (const field of fieldsToDecrypt) {
            if (item && item[field]) {
              try {
                item[field] = decrypt(item[field]);
              } catch (error) {
                console.error(
                  `[db] Failed to decrypt ${field} for ${params.model}:`,
                  error
                );
              }
            }
          }
        });
      } else {
        for (const field of fieldsToDecrypt) {
          if (result[field]) {
            try {
              result[field] = decrypt(result[field]);
            } catch (error) {
              console.error(
                `[db] Failed to decrypt ${field} for ${params.model}:`,
                error
              );
            }
          }
        }
      }
    }
  }

  return result;
});

// Middleware to track slow queries (> 500ms)
// Note: Prisma $on hook requires additional setup and will be configured in Phase 2 with Sentry
// if (process.env.NODE_ENV !== "production") {
//   prisma.$on("query", (e) => {
//     if (e.duration > 500) {
//       console.warn(
//         `[db] Slow query (${e.duration}ms): ${e.query.substring(0, 100)}...`
//       );
//     }
//     getMonitor().recordDatabaseQueryTime(e.duration);
//   });
// }

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Check if a Prisma error is due to a transient connection issue
 * (can be retried safely).
 */
export function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  const code = (error as any).code;

  // Prisma-specific transient error codes
  const transientCodes = [
    "ECONNREFUSED", // Connection refused
    "ENOTFOUND", // DNS lookup failed
    "ETIMEDOUT", // Connection timeout
    "EHOSTUNREACH", // Host unreachable
    "P1001", // Can't reach the database server
    "P1002", // The database server was reached but timed out
    "P1008", // Operations timed out
    "P1017", // Server closed the connection
  ];

  return (
    transientCodes.includes(code) ||
    message.includes("econnrefused") ||
    message.includes("timeout") ||
    message.includes("connection") ||
    message.includes("network")
  );
}

/**
 * Circuit breaker state for tracking failing database connections.
 */
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailureTime: 0,
  isOpen: false,
};

const CIRCUIT_BREAKER_THRESHOLD = 5; // Open after 5 failures
const CIRCUIT_BREAKER_TIMEOUT = 30000; // Try again after 30 seconds

/**
 * Circuit breaker pattern implementation for database queries.
 * Prevents cascading failures when the database is down.
 */
export function updateCircuitBreaker(error: boolean): void {
  const now = Date.now();

  if (error) {
    circuitBreaker.failures++;
    circuitBreaker.lastFailureTime = now;

    if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      circuitBreaker.isOpen = true;
      console.error(
        `[Circuit Breaker] Database circuit opened after ${circuitBreaker.failures} failures`
      );
    }
  } else {
    // Reset on success
    if (circuitBreaker.failures > 0) {
      console.log("[Circuit Breaker] Database circuit closed, resetting failures");
    }
    circuitBreaker.failures = 0;
    circuitBreaker.isOpen = false;
  }
}

/**
 * Check if the circuit breaker is allowing requests.
 */
export function isCircuitBreakerOpen(): boolean {
  if (!circuitBreaker.isOpen) return false;

  // Check if timeout has elapsed to retry
  const now = Date.now();
  if (now - circuitBreaker.lastFailureTime > CIRCUIT_BREAKER_TIMEOUT) {
    console.log("[Circuit Breaker] Attempting to close circuit");
    circuitBreaker.isOpen = false;
    circuitBreaker.failures = 0;
    return false;
  }

  return true;
}
