import { describe, it, expect } from "vitest";
import { formatReferenceBlock, type RetrievedChunk } from "@/lib/rag/retrieve";

function chunk(content: string): RetrievedChunk {
  return {
    chunkId: "c",
    content,
    documentId: "d",
    title: "T",
    authors: null,
    source: "europepmc",
    url: null,
    license: "CC-BY",
    similarity: 0.9,
  };
}

describe("formatReferenceBlock", () => {
  it("returns empty string when there are no chunks", () => {
    expect(formatReferenceBlock([])).toBe("");
  });

  it("numbers each passage for the model's bookkeeping", () => {
    const block = formatReferenceBlock([chunk("first"), chunk("second")]);
    expect(block).toContain("[1] first");
    expect(block).toContain("[2] second");
  });
});
