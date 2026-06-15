/**
 * Message validation for abuse prevention.
 * Detects spam patterns, rapid-fire messages, and suspicious content.
 */

interface MessageValidationResult {
  valid: boolean;
  error?: string;
}

interface MessageHistory {
  content: string;
  timestamp: number;
}

// In-memory store of recent messages per session for spam detection
const messageHistory: Map<string, MessageHistory[]> = new Map();

/**
 * Validate an incoming message for common abuse patterns.
 * @param sessionId Session identifier
 * @param message The message content
 * @param maxHistoryMs Time window for checking rapid-fire messages (default: 5000ms)
 * @returns Validation result with error message if invalid
 */
export function validateMessage(
  sessionId: string,
  message: string,
  maxHistoryMs: number = 5000
): MessageValidationResult {
  // Empty or whitespace-only check
  if (!message || !message.trim()) {
    return { valid: false, error: "Message cannot be empty" };
  }

  // Length check (also enforced by schema, but redundant check here)
  if (message.length < 1) {
    return { valid: false, error: "Message is too short" };
  }
  if (message.length > 4000) {
    return { valid: false, error: "Message is too long (max 4000 characters)" };
  }

  // Rapid-fire message check: no more than 3 messages in the last 5 seconds
  const now = Date.now();
  const history = messageHistory.get(sessionId) || [];

  // Clean up old messages from history
  const recentMessages = history.filter((msg) => now - msg.timestamp < maxHistoryMs);

  // Check for rapid-fire messages
  if (recentMessages.length >= 3) {
    return {
      valid: false,
      error: "Please slow down. You're sending messages too quickly. Try again in a moment.",
    };
  }

  // Check for repeated content (spam detection)
  // Allow exact repeats only if they're part of a longer conversation
  if (recentMessages.length > 0) {
    const lastMessage = recentMessages[recentMessages.length - 1];
    if (
      lastMessage.content.toLowerCase().trim() === message.toLowerCase().trim()
    ) {
      // Check if this is a quick repeat (spam)
      if (now - lastMessage.timestamp < 2000) {
        return {
          valid: false,
          error: "Duplicate message detected. Please avoid repeating the same message.",
        };
      }
    }
  }

  // Check for excessive punctuation or special characters (spam indicator)
  const specialCharCount = (message.match(/[!?]{2,}/g) || []).length;
  if (specialCharCount > 3) {
    return {
      valid: false,
      error: "Message appears to contain excessive special characters.",
    };
  }

  // Message is valid, add to history
  recentMessages.push({ content: message, timestamp: now });
  messageHistory.set(sessionId, recentMessages);

  return { valid: true };
}

/**
 * Clear message history for a session (e.g., when session ends).
 */
export function clearMessageHistory(sessionId: string): void {
  messageHistory.delete(sessionId);
}

/**
 * Get message history for a session (for debugging/monitoring).
 */
export function getMessageHistory(sessionId: string): MessageHistory[] {
  return messageHistory.get(sessionId) || [];
}

/**
 * Clear all message history (for testing).
 */
export function clearAllMessageHistory(): void {
  messageHistory.clear();
}
