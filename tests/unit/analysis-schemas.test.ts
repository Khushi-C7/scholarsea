import { describe, it, expect } from "vitest";

import { PaperSource } from "@/generated/prisma/enums"; // value import to trigger nothing server-only
import {
  CLAIM_TYPES,
  readerOutputSchema,
  analyzerOutputSchema,
  terminologyOutputSchema,
  knowledgeOutputSchema,
  synthesizerOutputSchema,
  comparatorOutputSchema,
} from "@/lib/validation/analysis";

// Silence unused import (kept to assert the test env can load generated enums).
void PaperSource;

describe("readerOutputSchema", () => {
  it("accepts a valid object and defaults sectionsDetected", () => {
    const r = readerOutputSchema.safeParse({
      documentType: "research paper",
      summary: "This is a sufficiently long summary of the document.",
      keyPoints: ["point one"],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.sectionsDetected).toEqual([]);
  });
  it("rejects empty keyPoints", () => {
    expect(
      readerOutputSchema.safeParse({
        documentType: "x",
        summary: "long enough summary here yes indeed.",
        keyPoints: [],
      }).success
    ).toBe(false);
  });
  it("rejects a too-short summary", () => {
    expect(
      readerOutputSchema.safeParse({
        documentType: "x",
        summary: "short",
        keyPoints: ["a"],
      }).success
    ).toBe(false);
  });
});

describe("analyzerOutputSchema", () => {
  const base = { researchProblem: "problem", methodology: "method" };
  it("accepts valid input and defaults arrays", () => {
    const r = analyzerOutputSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.results).toEqual([]);
      expect(r.data.claims).toEqual([]);
    }
  });
  it("rejects a claim with an unknown type", () => {
    expect(
      analyzerOutputSchema.safeParse({
        ...base,
        claims: [{ type: "NONSENSE", text: "t", supportingPassage: "p" }],
      }).success
    ).toBe(false);
  });
  it("accepts all valid claim types", () => {
    const r = analyzerOutputSchema.safeParse({
      ...base,
      claims: CLAIM_TYPES.map((type) => ({
        type,
        text: "claim",
        supportingPassage: "passage",
      })),
    });
    expect(r.success).toBe(true);
  });
  it("rejects an empty researchProblem", () => {
    expect(
      analyzerOutputSchema.safeParse({ ...base, researchProblem: "" }).success
    ).toBe(false);
  });
});

describe("terminologyOutputSchema", () => {
  it("rejects a term missing its definition", () => {
    expect(
      terminologyOutputSchema.safeParse({ terms: [{ term: "CNN" }] }).success
    ).toBe(false);
  });
  it("accepts valid terms", () => {
    expect(
      terminologyOutputSchema.safeParse({
        terms: [{ term: "CNN", definition: "A neural net." }],
      }).success
    ).toBe(true);
  });
});

describe("knowledgeOutputSchema", () => {
  it("rejects empty motivation", () => {
    expect(
      knowledgeOutputSchema.safeParse({ motivation: "", significance: "s" })
        .success
    ).toBe(false);
  });
});

describe("synthesizerOutputSchema", () => {
  it("requires at least one conclusion", () => {
    expect(
      synthesizerOutputSchema.safeParse({
        conclusions: [],
        confidence: "low",
        confidenceRationale: "r",
      }).success
    ).toBe(false);
  });
  it("rejects an invalid confidence value", () => {
    expect(
      synthesizerOutputSchema.safeParse({
        conclusions: ["c"],
        confidence: "very-high",
        confidenceRationale: "r",
      }).success
    ).toBe(false);
  });
});

describe("comparatorOutputSchema", () => {
  it("requires at least one dimension", () => {
    expect(
      comparatorOutputSchema.safeParse({ dimensions: [], summary: "s" }).success
    ).toBe(false);
  });
  it("accepts a valid comparison", () => {
    expect(
      comparatorOutputSchema.safeParse({
        dimensions: [
          { dimension: "Method", values: [{ paperId: "p1", value: "CNN" }] },
        ],
        summary: "They differ in method.",
      }).success
    ).toBe(true);
  });
});
