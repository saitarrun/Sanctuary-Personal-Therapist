import { describe, it, expect } from "vitest";
import { reconstructAbstract } from "@/lib/rag/sources/openalex";
import { getConnector, CONNECTORS } from "@/lib/rag/sources";

describe("reconstructAbstract", () => {
  it("rebuilds text from an inverted index in position order", () => {
    const index = {
      Cognitive: [0],
      behavioral: [1],
      therapy: [2],
      helps: [3],
      people: [4],
    };
    expect(reconstructAbstract(index)).toBe(
      "Cognitive behavioral therapy helps people"
    );
  });

  it("handles repeated words at multiple positions", () => {
    const index = { the: [0, 2], cat: [1], sat: [3] };
    expect(reconstructAbstract(index)).toBe("the cat the sat");
  });

  it("returns empty string for null/undefined", () => {
    expect(reconstructAbstract(null)).toBe("");
    expect(reconstructAbstract(undefined)).toBe("");
  });
});

describe("source registry", () => {
  it("registers the new Harvard, Stanford, journals and psychology sources", () => {
    for (const id of ["harvard", "stanford", "journals", "psychology"]) {
      expect(CONNECTORS[id]).toBeDefined();
      expect(getConnector(id).id).toBe(id);
    }
  });

  it("throws a helpful error for unknown sources", () => {
    expect(() => getConnector("nope")).toThrow(/Unknown source/);
  });
});
