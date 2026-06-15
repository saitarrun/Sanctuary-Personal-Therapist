import { getConfig } from "@/lib/config";
import { ClaudeCliProvider } from "./claudeCli";
import { OpenRouterProvider } from "./openrouter";
import type { ChatProvider } from "./types";

let cached: ChatProvider | null = null;

/**
 * Returns the configured LLM backend. Swapping is a one-line env change
 * (LLM_PROVIDER=openrouter | claude-cli). Callers depend only on ChatProvider.
 */
export function getProvider(): ChatProvider {
  if (cached) return cached;
  const { LLM_PROVIDER } = getConfig();
  cached =
    LLM_PROVIDER === "claude-cli"
      ? new ClaudeCliProvider()
      : new OpenRouterProvider();
  return cached;
}

export type { ChatProvider, ChatMessage, ChatRequest, ChatResult } from "./types";
