export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  /** Full system prompt (coaching instructions + retrieved reference block). */
  system: string;
  /** Prior conversation history plus the new user message. No system role here. */
  messages: ChatMessage[];
  maxTokens?: number;
}

export interface ChatResult {
  content: string;
  /** Resolved model id actually used. */
  model: string;
  provider: ProviderName;
}

export type ProviderName = "openrouter" | "claude-cli";

export interface ChatProvider {
  readonly name: ProviderName;
  chat(req: ChatRequest): Promise<ChatResult>;
}
