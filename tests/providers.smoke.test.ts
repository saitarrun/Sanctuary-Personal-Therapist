import { describe, it, expect, beforeEach, vi } from "vitest";

// The provider selector reads env via the cached config module, so reset module
// state between cases and set env before each dynamic import.
beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/test";
  delete process.env.LLM_PROVIDER;
  delete process.env.OPENROUTER_API_KEY;
});

describe("getProvider", () => {
  it("defaults to openrouter", async () => {
    const { getProvider } = await import("@/lib/llm");
    expect(getProvider().name).toBe("openrouter");
  });

  it("selects claude-cli when configured", async () => {
    process.env.LLM_PROVIDER = "claude-cli";
    const { getProvider } = await import("@/lib/llm");
    expect(getProvider().name).toBe("claude-cli");
  });
});

describe("OpenRouterProvider.chat", () => {
  it("sends a well-formed request and parses the reply", async () => {
    process.env.LLM_PROVIDER = "openrouter";
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "anthropic/claude-sonnet-4.6",
        choices: [{ message: { content: "Hello there." } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getProvider } = await import("@/lib/llm");
    const result = await getProvider().chat({
      system: "SYS",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result.content).toBe("Hello there.");
    expect(result.provider).toBe("openrouter");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("openrouter.ai");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("anthropic/claude-sonnet-4.6");
    expect(body.messages[0]).toEqual({ role: "system", content: "SYS" });
    expect(body.messages[1]).toEqual({ role: "user", content: "hi" });
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-key"
    );
  });

  it("throws when the API key is missing", async () => {
    process.env.LLM_PROVIDER = "openrouter";
    const { getProvider } = await import("@/lib/llm");
    await expect(
      getProvider().chat({ system: "s", messages: [{ role: "user", content: "x" }] })
    ).rejects.toThrow(/OPENROUTER_API_KEY/);
  });
});
