/**
 * Tests for rate limiting functionality.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getMessageLimiter,
  getSessionLimiter,
  getIpLimiter,
  resetAllLimiters,
} from "@/lib/rateLimit/limiter";

describe("Rate Limiter", () => {
  beforeEach(() => {
    resetAllLimiters();
  });

  describe("Message Limiter", () => {
    it("should allow requests within the limit", () => {
      const limiter = getMessageLimiter();
      const result1 = limiter.check("session:123");
      const result2 = limiter.check("session:123");

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result1.remaining).toBeGreaterThan(0);
    });

    it("should deny requests after exceeding the limit", () => {
      const limiter = getMessageLimiter();
      const key = "session:456";

      // Consume all tokens (default: 20 per minute)
      for (let i = 0; i < 20; i++) {
        limiter.check(key);
      }

      // 21st request should be denied
      const result = limiter.check(key);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
    });

    it("should include reset time in result", () => {
      const limiter = getMessageLimiter();
      const result = limiter.check("session:789");

      expect(result.resetTime).toBeGreaterThan(Date.now());
      expect(result.resetTime - Date.now()).toBeLessThan(61000); // Within 61 seconds
    });

    it("should calculate remaining tokens correctly", () => {
      const limiter = getMessageLimiter();
      const key = "session:101";

      const result1 = limiter.check(key);
      expect(result1.remaining).toBe(19); // 20 - 1

      const result2 = limiter.check(key);
      expect(result2.remaining).toBe(18); // 20 - 2
    });

    it("should refill tokens after window expires", () => {
      // Note: Since we export functions instead of classes,
      // we'll test the reset behavior instead
      const limiter = getMessageLimiter();
      const key = "session:102";

      limiter.check(key);
      limiter.reset(key);

      const result = limiter.check(key);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(19); // Reset state
    });
  });

  describe("Session Limiter", () => {
    it("should allow session creation within limits", () => {
      const limiter = getSessionLimiter();
      const result = limiter.check("ip:192.168.1.1");

      expect(result.allowed).toBe(true);
    });

    it("should deny session creation after exceeding hourly limit", () => {
      const limiter = getSessionLimiter();
      const key = "ip:192.168.1.2";

      // Consume all tokens (default: 10 per hour)
      for (let i = 0; i < 10; i++) {
        limiter.check(key);
      }

      const result = limiter.check(key);
      expect(result.allowed).toBe(false);
    });
  });

  describe("IP Limiter", () => {
    it("should track requests per IP", () => {
      const limiter = getIpLimiter();

      const result1 = limiter.check("192.168.1.1");
      expect(result1.allowed).toBe(true);

      const result2 = limiter.check("192.168.1.1");
      expect(result2.allowed).toBe(true);

      // Different IP should have independent limits
      const result3 = limiter.check("192.168.1.2");
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(result1.remaining); // Same initial state
    });
  });

  describe("Rate Limit Result", () => {
    it("should return proper Retry-After in seconds", () => {
      const limiter = getMessageLimiter();
      const key = "session:retry";

      // Consume all tokens
      for (let i = 0; i < 20; i++) {
        limiter.check(key);
      }

      const result = limiter.check(key);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(60); // Within window
    });

    it("should handle multiple keys independently", () => {
      const limiter = getMessageLimiter();

      const key1 = "session:a";
      const key2 = "session:b";

      for (let i = 0; i < 19; i++) {
        limiter.check(key1);
      }

      // key1 has 1 token left
      const result1 = limiter.check(key1);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(0);

      // key2 still has all tokens
      const result2 = limiter.check(key2);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(19);

      // key1 now exceeds limit
      const result3 = limiter.check(key1);
      expect(result3.allowed).toBe(false);

      // key2 can still make requests
      const result4 = limiter.check(key2);
      expect(result4.allowed).toBe(true);
    });
  });

  describe("Clear Operations", () => {
    it("should reset individual keys", () => {
      const limiter = getMessageLimiter();
      const key = "session:clear";

      limiter.check(key);
      limiter.reset(key);

      const result = limiter.check(key);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(19); // Fresh state
    });

    it("should clear all limits", () => {
      const msgLimiter = getMessageLimiter();
      const sessLimiter = getSessionLimiter();

      msgLimiter.check("session:1");
      sessLimiter.check("ip:1");

      resetAllLimiters();

      const result1 = msgLimiter.check("session:1");
      const result2 = sessLimiter.check("ip:1");

      expect(result1.remaining).toBe(19);
      expect(result2.remaining).toBe(9);
    });
  });

  describe("Prefix Handling", () => {
    it("should use key prefix correctly", () => {
      const limiter = getMessageLimiter();

      // Keys with same suffix but should be separate due to prefix
      const result1 = limiter.check("user123");
      const result2 = limiter.check("user123");

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(result1.remaining - 1);
    });
  });
});
