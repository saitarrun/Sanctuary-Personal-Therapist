/**
 * Sliding window rate limiter using token bucket algorithm.
 * Supports multiple limit types: per-session, per-IP, per-endpoint.
 * Uses in-memory store (can be upgraded to Redis).
 */

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional: key prefix for grouping limits */
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number; // Unix timestamp in milliseconds
  retryAfter?: number; // Seconds to wait before retrying (only when not allowed)
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

class RateLimiter {
  private store: Map<string, TokenBucket> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request should be allowed based on the rate limit.
   * @param key Unique identifier (IP, sessionId, endpoint, etc)
   * @returns Rate limit result with allowed flag and metadata
   */
  check(key: string): RateLimitResult {
    const prefixedKey = this.config.keyPrefix
      ? `${this.config.keyPrefix}:${key}`
      : key;

    const now = Date.now();
    let bucket = this.store.get(prefixedKey);

    // Initialize new bucket
    if (!bucket) {
      bucket = {
        tokens: this.config.maxRequests - 1, // Consume one token for this request
        lastRefill: now,
      };
      this.store.set(prefixedKey, bucket);
      return {
        allowed: true,
        remaining: bucket.tokens,
        resetTime: now + this.config.windowMs,
      };
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const refillRate = this.config.maxRequests / this.config.windowMs;
    const tokensToAdd = elapsed * refillRate;

    bucket.tokens = Math.min(
      this.config.maxRequests,
      bucket.tokens + tokensToAdd
    );
    bucket.lastRefill = now;

    // Check if request is allowed
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        resetTime: now + this.config.windowMs,
      };
    }

    // Request denied
    const resetTime = bucket.lastRefill + this.config.windowMs;
    const retryAfter = Math.ceil((resetTime - now) / 1000); // Convert to seconds

    return {
      allowed: false,
      remaining: 0,
      resetTime,
      retryAfter,
    };
  }

  /**
   * Reset the rate limit for a specific key (useful for testing or admin actions).
   */
  reset(key: string): void {
    const prefixedKey = this.config.keyPrefix
      ? `${this.config.keyPrefix}:${key}`
      : key;
    this.store.delete(prefixedKey);
  }

  /**
   * Clear all stored limits (useful for testing).
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get current bucket state for a key (for monitoring/debugging).
   */
  getState(key: string): TokenBucket | null {
    const prefixedKey = this.config.keyPrefix
      ? `${this.config.keyPrefix}:${key}`
      : key;
    return this.store.get(prefixedKey) ?? null;
  }

  /**
   * Get all keys with active limits (for monitoring).
   */
  getAllKeys(): string[] {
    return Array.from(this.store.keys());
  }
}

/**
 * Pre-configured limiters for common use cases.
 * These are lazy-initialized singletons.
 */
let messageLimiter: RateLimiter | null = null;
let sessionLimiter: RateLimiter | null = null;
let ipLimiter: RateLimiter | null = null;
let chatEndpointLimiter: RateLimiter | null = null;
let sessionEndpointLimiter: RateLimiter | null = null;

export function getMessageLimiter(): RateLimiter {
  if (!messageLimiter) {
    messageLimiter = new RateLimiter({
      maxRequests: parseInt(process.env.RATE_LIMIT_MESSAGE_PER_MIN || "20"),
      windowMs: 60 * 1000, // 1 minute
      keyPrefix: "msg",
    });
  }
  return messageLimiter;
}

export function getSessionLimiter(): RateLimiter {
  if (!sessionLimiter) {
    sessionLimiter = new RateLimiter({
      maxRequests: parseInt(process.env.RATE_LIMIT_SESSION_PER_HOUR || "10"),
      windowMs: 60 * 60 * 1000, // 1 hour
      keyPrefix: "sess",
    });
  }
  return sessionLimiter;
}

export function getIpLimiter(): RateLimiter {
  if (!ipLimiter) {
    ipLimiter = new RateLimiter({
      maxRequests: parseInt(process.env.RATE_LIMIT_IP_PER_HOUR || "100"),
      windowMs: 60 * 60 * 1000, // 1 hour
      keyPrefix: "ip",
    });
  }
  return ipLimiter;
}

export function getChatEndpointLimiter(): RateLimiter {
  if (!chatEndpointLimiter) {
    chatEndpointLimiter = new RateLimiter({
      maxRequests: 50,
      windowMs: 60 * 1000, // 1 minute
      keyPrefix: "chat",
    });
  }
  return chatEndpointLimiter;
}

export function getSessionEndpointLimiter(): RateLimiter {
  if (!sessionEndpointLimiter) {
    sessionEndpointLimiter = new RateLimiter({
      maxRequests: 10,
      windowMs: 60 * 1000, // 1 minute
      keyPrefix: "sessions",
    });
  }
  return sessionEndpointLimiter;
}

/**
 * For testing only: reset all limiters
 */
export function resetAllLimiters(): void {
  messageLimiter?.clear();
  sessionLimiter?.clear();
  ipLimiter?.clear();
  chatEndpointLimiter?.clear();
  sessionEndpointLimiter?.clear();
}
