import { getConfig } from "@/lib/config";
import type { ChatProvider, ChatRequest, ChatResult } from "./types";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Default provider. Talks to OpenRouter's OpenAI-compatible chat-completions API.
 * Works in deployment (pure HTTP, key stays server-side).
 */
export class OpenRouterProvider implements ChatProvider {
  readonly name = "openrouter" as const;

  async chat(req: ChatRequest): Promise<ChatResult> {
    const cfg = getConfig();
    if (!cfg.OPENROUTER_API_KEY) {
      throw new Error(
        "OPENROUTER_API_KEY is not set but LLM_PROVIDER=openrouter."
      );
    }

    const body = {
      model: cfg.OPENROUTER_MODEL,
      max_tokens: req.maxTokens ?? 1024,
      messages: [
        { role: "system", content: req.system },
        ...req.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    };

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": cfg.OPENROUTER_APP_URL,
        "X-Title": cfg.OPENROUTER_APP_NAME,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `OpenRouter request failed (${res.status}): ${detail.slice(0, 500)}`
      );
    }

    const data = (await res.json()) as {
      model?: string;
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("OpenRouter returned an empty completion.");
    }

    return {
      content,
      model: data.model ?? cfg.OPENROUTER_MODEL,
      provider: this.name,
    };
  }
}
