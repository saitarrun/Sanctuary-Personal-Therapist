import { describe, it, expect } from "vitest";
import { chunkText } from "@/lib/rag/chunk";

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    const chunks = chunkText("A short sentence about coping with stress.");
    expect(chunks).toHaveLength(1);
  });

  it("splits long text into multiple overlapping chunks", () => {
    const word = "psychology ";
    const long = word.repeat(2000); // ~22k chars
    const chunks = chunkText(long, { targetTokens: 200, overlapTokens: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk should be within a reasonable bound of the target char size.
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(200 * 4 + 10);
    }
  });

  it("creates overlap between consecutive chunks", () => {
    const text = Array.from({ length: 500 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkText(text, { targetTokens: 50, overlapTokens: 10 });
    expect(chunks.length).toBeGreaterThan(1);
    // The tail of one chunk should reappear at the head of the next.
    const firstTailWord = chunks[0].split(" ").slice(-1)[0];
    expect(chunks[1].includes(firstTailWord)).toBe(true);
  });

  it("returns nothing for empty/whitespace input", () => {
    expect(chunkText("   ")).toEqual([]);
  });
});
