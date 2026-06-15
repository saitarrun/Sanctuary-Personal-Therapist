import { getConfig } from "@/lib/config";
import type { ChatProvider, ChatRequest, ChatResult, ChatStream } from "./types";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Default provider. Talks to OpenRouter's OpenAI-compatible chat-completions API.
 * Works in deployment (pure HTTP, key stays server-side).
 */
export class OpenRouterProvider implements ChatProvider {
  readonly name = "openrouter" as const;

  async chat(req: ChatRequest): Promise<ChatResult> {
    const cfg = getConfig();
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: this.getHeaders(cfg),
      body: JSON.stringify(this.getBody(cfg, req, false)),
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

  async stream(req: ChatRequest): Promise<ChatStream> {
    const cfg = getConfig();
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: this.getHeaders(cfg),
      body: JSON.stringify(this.getBody(cfg, req, true)),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `OpenRouter streaming failed (${res.status}): ${detail.slice(0, 500)}`
      );
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable.");
    }

    const iterator = (async function* () {
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last partial line in the buffer.
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === "[DONE]") return;

          try {
            const json = JSON.parse(dataStr) as {
              choices?: { delta?: { content?: string } }[];
            };
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            // Partial or malformed JSON — usually safe to skip in SSE.
          }
        }
      }
    })();

    return {
      iterator,
      model: cfg.OPENROUTER_MODEL,
      provider: this.name,
    };
  }

  private getHeaders(cfg: ReturnType<typeof getConfig>) {
    if (!cfg.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not set.");
    }
    return {
      Authorization: `Bearer ${cfg.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": cfg.OPENROUTER_APP_URL,
      "X-Title": cfg.OPENROUTER_APP_NAME,
    };
  }

  private getBody(
    cfg: ReturnType<typeof getConfig>,
    req: ChatRequest,
    stream: boolean
  ) {
    return {
      model: cfg.OPENROUTER_MODEL,
      max_tokens: req.maxTokens ?? 1024,
      stream,
      messages: [
        { role: "system", content: req.system },
        ...req.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    };
  }
}
