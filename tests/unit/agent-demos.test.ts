import { describe, it, expect } from "vitest";

import {
  readerOutputSchema,
  analyzerOutputSchema,
  terminologyOutputSchema,
  knowledgeOutputSchema,
  synthesizerOutputSchema,
  comparatorOutputSchema,
} from "@/lib/validation/analysis";
import { demoReader } from "@/core/agents/reader";
import { demoAnalyzer } from "@/core/agents/analyzer";
import { demoTerminology } from "@/core/agents/terminology";
import { demoKnowledge } from "@/core/agents/knowledge";
import { demoSynthesizer } from "@/core/agents/synthesizer";
import { demoComparator } from "@/core/agents/comparator";

const SAMPLE = `Prototypical Networks for Leaf Disease.
Abstract: We address the problem of few-shot leaf disease classification. We propose a metric-learning method using class prototypes.
Method: Our approach computes a prototype per class using a CNN encoder.
Results: We achieve 78.4% accuracy on the PlantVillage benchmark.
Limitations: However, performance drops under field conditions, which we do not evaluate.
Conclusion: Prototype methods are effective but need robustness work.`;

describe("agent demo outputs are always schema-valid", () => {
  it("reader", () => {
    expect(
      readerOutputSchema.safeParse(
        demoReader({ title: "Prototypical Networks", text: SAMPLE })
      ).success
    ).toBe(true);
  });

  it("reader with near-empty text still validates", () => {
    expect(
      readerOutputSchema.safeParse(demoReader({ title: "T", text: "short." }))
        .success
    ).toBe(true);
  });

  it("analyzer", () => {
    const out = demoAnalyzer({
      title: "T",
      text: SAMPLE,
      readerSummary: "summary",
    });
    expect(analyzerOutputSchema.safeParse(out).success).toBe(true);
    // Claims, when present, are grounded in the text.
    for (const c of out.claims) {
      expect(SAMPLE.replace(/\s+/g, " ")).toContain(c.supportingPassage.slice(0, 20));
    }
  });

  it("analyzer with unmatched text still validates (fallbacks)", () => {
    expect(
      analyzerOutputSchema.safeParse(
        demoAnalyzer({ title: "T", text: "zzz zzz zzz nothing here.", readerSummary: "" })
      ).success
    ).toBe(true);
  });

  it("terminology", () => {
    expect(
      terminologyOutputSchema.safeParse(demoTerminology({ text: SAMPLE })).success
    ).toBe(true);
  });

  it("knowledge", () => {
    expect(
      knowledgeOutputSchema.safeParse(
        demoKnowledge({
          title: "T",
          researchProblem: "few-shot leaf disease",
          methodology: "prototypes",
          contributions: ["a metric-learning method"],
          limitations: ["field robustness untested"],
        })
      ).success
    ).toBe(true);
  });

  it("knowledge with no limitations still validates", () => {
    expect(
      knowledgeOutputSchema.safeParse(
        demoKnowledge({
          title: "T",
          researchProblem: "p",
          methodology: "m",
          contributions: [],
          limitations: [],
        })
      ).success
    ).toBe(true);
  });

  it("synthesizer", () => {
    expect(
      synthesizerOutputSchema.safeParse(
        demoSynthesizer({
          researchProblem: "p",
          results: ["78.4% accuracy"],
          limitations: ["field robustness"],
        })
      ).success
    ).toBe(true);
  });

  it("synthesizer with no results still validates", () => {
    expect(
      synthesizerOutputSchema.safeParse(
        demoSynthesizer({ researchProblem: "p", results: [], limitations: [] })
      ).success
    ).toBe(true);
  });

  it("comparator", () => {
    expect(
      comparatorOutputSchema.safeParse(
        demoComparator({
          papers: [
            { paperId: "p1", title: "A", analysisJson: "{}" },
            { paperId: "p2", title: "B", analysisJson: "{}" },
          ],
        })
      ).success
    ).toBe(true);
  });
});
