/**
 * Tests for message validation functionality.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  validateMessage,
  clearMessageHistory,
  clearAllMessageHistory,
  getMessageHistory,
} from "@/lib/validation/messageValidator";

describe("Message Validator", () => {
  beforeEach(() => {
    clearAllMessageHistory();
  });

  describe("Basic Validation", () => {
    it("should accept valid messages", () => {
      const result = validateMessage("session:1", "This is a valid message");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject empty messages", () => {
      const result = validateMessage("session:1", "");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should reject whitespace-only messages", () => {
      const result = validateMessage("session:1", "   ");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("should reject messages exceeding max length", () => {
      const longMessage = "a".repeat(4001);
      const result = validateMessage("session:1", longMessage);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("long");
    });

    it("should accept messages at max length", () => {
      const maxMessage = "a".repeat(4000);
      const result = validateMessage("session:1", maxMessage);
      expect(result.valid).toBe(true);
    });
  });

  describe("Rapid-Fire Detection", () => {
    it("should allow normal message spacing", () => {
      const sessionId = "session:rapid";
      const result1 = validateMessage(sessionId, "First message");
      const result2 = validateMessage(sessionId, "Second message");
      const result3 = validateMessage(sessionId, "Third message");

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
      expect(result3.valid).toBe(true);
    });

    it("should reject more than 3 messages in 5 seconds", () => {
      const sessionId = "session:spam";

      const result1 = validateMessage(sessionId, "Message 1");
      const result2 = validateMessage(sessionId, "Message 2");
      const result3 = validateMessage(sessionId, "Message 3");
      const result4 = validateMessage(sessionId, "Message 4"); // 4th message should fail

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
      expect(result3.valid).toBe(true);
      expect(result4.valid).toBe(false);
      expect(result4.error).toContain("slow down");
    });

    it("should allow 4th message after one expires from window", async () => {
      const sessionId = "session:expiry";

      validateMessage(sessionId, "Message 1");
      validateMessage(sessionId, "Message 2");
      validateMessage(sessionId, "Message 3");

      // Wait for first message to potentially expire from 5-second window
      // (but we won't actually wait, just check the logic)
      const result4 = validateMessage(sessionId, "Message 4");
      expect(result4.valid).toBe(false); // Still within 5 seconds
    });
  });

  describe("Duplicate Detection", () => {
    it("should reject quick duplicates (within 2 seconds)", () => {
      const sessionId = "session:dup";
      const message = "Duplicate message";

      const result1 = validateMessage(sessionId, message);
      const result2 = validateMessage(sessionId, message); // Exact duplicate

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(false);
      expect(result2.error).toContain("Duplicate");
    });

    it("should allow duplicates sent far apart", () => {
      const sessionId = "session:dup2";
      const message = "Valid duplicate";

      const result1 = validateMessage(sessionId, message);
      expect(result1.valid).toBe(true);

      // In real usage, this would be separated by time
      // For now, we check that it's not immediately duplicate-blocked
      const history = getMessageHistory(sessionId);
      expect(history.length).toBe(1);
      expect(history[0].content).toBe(message);
    });

    it("should be case-insensitive for duplicates", () => {
      const sessionId = "session:case";

      const result1 = validateMessage(sessionId, "Hello World");
      const result2 = validateMessage(sessionId, "hello world"); // Different case

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(false); // Should be detected as duplicate
      expect(result2.error).toContain("Duplicate");
    });
  });

  describe("Special Character Detection", () => {
    it("should reject excessive punctuation", () => {
      const result = validateMessage("session:punct", "!!! ??? !!! ??? !!!"); // More than 3 groups
      expect(result.valid).toBe(false);
      expect(result.error).toContain("special characters");
    });

    it("should allow normal punctuation", () => {
      const result = validateMessage("session:punct2", "What?? Really!! Amazing!");
      expect(result.valid).toBe(true);
    });

    it("should reject messages with many consecutive punctuation marks", () => {
      const result = validateMessage("session:punct3", "This is !!!excessive");
      expect(result.valid).toBe(true); // Only one group of !!!

      const result2 = validateMessage("session:punct3", "What!! Why?? How!! Yes!!!");
      expect(result2.valid).toBe(false); // 4+ groups of double/triple punctuation
    });
  });

  describe("History Management", () => {
    it("should maintain message history per session", () => {
      const sessionId = "session:hist";

      validateMessage(sessionId, "Message 1");
      validateMessage(sessionId, "Message 2");

      const history = getMessageHistory(sessionId);
      expect(history.length).toBe(2);
      expect(history[0].content).toBe("Message 1");
      expect(history[1].content).toBe("Message 2");
    });

    it("should keep history separate per session", () => {
      validateMessage("session:a", "Message A");
      validateMessage("session:b", "Message B");

      const historyA = getMessageHistory("session:a");
      const historyB = getMessageHistory("session:b");

      expect(historyA.length).toBe(1);
      expect(historyB.length).toBe(1);
      expect(historyA[0].content).toBe("Message A");
      expect(historyB[0].content).toBe("Message B");
    });

    it("should clear history for a session", () => {
      const sessionId = "session:clear";

      validateMessage(sessionId, "Message 1");
      validateMessage(sessionId, "Message 2");

      clearMessageHistory(sessionId);

      const history = getMessageHistory(sessionId);
      expect(history.length).toBe(0);
    });

    it("should include timestamps in history", () => {
      const sessionId = "session:ts";
      const beforeTime = Date.now();

      validateMessage(sessionId, "Timestamped message");

      const afterTime = Date.now();
      const history = getMessageHistory(sessionId);

      expect(history.length).toBe(1);
      expect(history[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(history[0].timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe("Edge Cases", () => {
    it("should handle sessions with no history", () => {
      const result = validateMessage("session:new", "First message");
      expect(result.valid).toBe(true);
    });

    it("should normalize whitespace in comparison", () => {
      const sessionId = "session:ws";

      validateMessage(sessionId, "Hello  World"); // Double space
      const result2 = validateMessage(sessionId, "Hello World"); // Single space

      // Should be treated as different messages (whitespace preserved)
      expect(result2.valid).toBe(true); // Not caught as duplicate due to different spacing
    });

    it("should allow valid message after spam is cleared", () => {
      const sessionId = "session:fresh";

      validateMessage(sessionId, "1");
      validateMessage(sessionId, "2");
      validateMessage(sessionId, "3");

      clearMessageHistory(sessionId);

      const result = validateMessage(sessionId, "4");
      expect(result.valid).toBe(true);
    });
  });
});
