import { describe, it, expect } from "vitest";

import { estimateCost, findModel, findProvider } from "@/lib/ai/catalog";

describe("cost estimate", () => {
  it("prices tokens against a model's list prices", () => {
    const m = findModel("openai", "gpt-4o");
    // 1000 input + 1000 output tokens = 0.005 + 0.015 = 0.02
    expect(estimateCost(m, 1000, 1000)).toBeCloseTo(0.02, 6);
  });

  it("returns null when the model has no price (demo/custom)", () => {
    expect(estimateCost(findModel("demo", "demo"), 1000, 1000)).toBeNull();
    expect(estimateCost(findModel("openai-compatible", "custom"), 500, 500)).toBeNull();
  });

  it("returns null for an unknown model", () => {
    expect(estimateCost(findModel("openai", "nope"), 100, 100)).toBeNull();
  });

  it("knows the built-in providers", () => {
    expect(findProvider("openai")?.requiresKey).toBe(true);
    expect(findProvider("demo")?.requiresKey).toBe(false);
    expect(findProvider("nonexistent")).toBeNull();
  });
});
