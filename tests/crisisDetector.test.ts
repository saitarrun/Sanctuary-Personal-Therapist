import { describe, it, expect } from "vitest";
import { detectCrisis } from "@/lib/safety/crisisDetector";

describe("detectCrisis", () => {
  it("fires on suicidal ideation", () => {
    expect(detectCrisis("I just want to die").triggered).toBe(true);
    expect(detectCrisis("sometimes I think about killing myself").triggered).toBe(
      true
    );
    expect(detectCrisis("I feel suicidal lately").triggered).toBe(true);
  });

  it("fires on self-harm and abuse", () => {
    expect(detectCrisis("I keep cutting myself").triggered).toBe(true);
    expect(detectCrisis("my partner hits me, he hits me every day").triggered).toBe(
      true
    );
  });

  it("does not fire on benign idioms", () => {
    expect(detectCrisis("I want to kill this presentation tomorrow").triggered).toBe(
      false
    );
    expect(detectCrisis("that workout was killer").triggered).toBe(false);
    expect(detectCrisis("I'm feeling a bit stressed about work").triggered).toBe(
      false
    );
  });

  it("returns the matched phrases", () => {
    const r = detectCrisis("I want to die and I might hurt myself");
    expect(r.triggered).toBe(true);
    expect(r.matched.length).toBeGreaterThanOrEqual(2);
  });

  it("handles empty input", () => {
    expect(detectCrisis("").triggered).toBe(false);
  });
});
