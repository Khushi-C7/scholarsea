import { describe, it, expect } from "vitest";

import { detectPatterns } from "@/lib/gaps/patterns";
import type { EvidenceCorpus, CorpusPaper } from "@/lib/gaps/types";

function paper(id: string, over: Partial<CorpusPaper> = {}): CorpusPaper {
  return {
    paperId: id,
    title: `Paper ${id}`,
    year: 2023,
    analyzed: true,
    analysisId: `a-${id}`,
    objectives: [],
    methods: [],
    architectures: [],
    datasets: [],
    metrics: [],
    results: [],
    limitations: [],
    futureWork: [],
    contexts: [],
    claims: [],
    ...over,
  };
}

function corpus(papers: CorpusPaper[]): EvidenceCorpus {
  return {
    projectId: "proj",
    papers,
    papersExamined: papers.length,
    papersAnalyzed: papers.filter((p) => p.analyzed).length,
    generatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("insufficient evidence", () => {
  it("flags zero analyzed papers", () => {
    const r = detectPatterns(corpus([]));
    expect(r.insufficientEvidence).toBe(true);
    expect(r.patterns).toEqual([]);
  });
  it("flags a single analyzed paper (no cross-paper comparison possible)", () => {
    const r = detectPatterns(corpus([paper("1", { limitations: ["no field eval"] })]));
    expect(r.insufficientEvidence).toBe(true);
  });
  it("ignores unanalyzed papers when counting", () => {
    const r = detectPatterns(
      corpus([
        paper("1", { analyzed: true, limitations: ["no field evaluation here"] }),
        paper("2", { analyzed: false }),
      ])
    );
    expect(r.insufficientEvidence).toBe(true); // only 1 analyzed
  });
});

describe("repeated limitations", () => {
  it("detects a limitation shared across two papers", () => {
    const r = detectPatterns(
      corpus([
        paper("1", {
          limitations: ["performance drops under field conditions which we do not evaluate"],
        }),
        paper("2", {
          limitations: ["robustness to field conditions is not evaluated in our experiments"],
        }),
      ])
    );
    const pat = r.patterns.find((p) => p.type === "repeated_limitation");
    expect(pat).toBeTruthy();
    expect(pat!.papersInvolved).toBe(2);
    expect(pat!.isAbsence).toBe(false);
    // Evidence links to both real corpus papers.
    expect(new Set(pat!.evidence.map((e) => e.paperId))).toEqual(
      new Set(["1", "2"])
    );
  });
});

describe("conflicting findings", () => {
  it("flags opposite-polarity results on a shared topic", () => {
    const r = detectPatterns(
      corpus([
        paper("1", {
          results: ["contrastive pretraining improves field accuracy substantially"],
        }),
        paper("2", {
          results: ["contrastive pretraining fails to improve field accuracy and degrades it"],
        }),
      ])
    );
    const pat = r.patterns.find((p) => p.type === "conflicting_findings");
    expect(pat).toBeTruthy();
    expect(pat!.evidence).toHaveLength(2);
  });
});

describe("missing evaluation (absence framing)", () => {
  it("flags an aspect no paper evaluates and carries a corpus-scoped caveat", () => {
    const r = detectPatterns(
      corpus([
        paper("1", {
          results: ["accuracy 78% on the benchmark"],
          limitations: ["we do not test robustness to field conditions"],
        }),
        paper("2", {
          results: ["accuracy 81% on the benchmark"],
          futureWork: ["evaluate robustness under field noise in future work"],
        }),
      ])
    );
    const pat = r.patterns.find((p) => p.type === "missing_evaluation");
    expect(pat).toBeTruthy();
    expect(pat!.isAbsence).toBe(true);
    // The critical distinction: explicit, corpus-scoped, not a universal claim.
    expect(pat!.absenceCaveat).toBeTruthy();
    expect(pat!.absenceCaveat).toMatch(/not proof that no such research exists/i);
    expect(pat!.evidenceScope).toMatch(/in this corpus/i);
  });
});

describe("uncompared methods (absence framing)", () => {
  it("flags methods with no shared dataset", () => {
    const r = detectPatterns(
      corpus([
        paper("1", { methods: ["prototypical networks"], datasets: ["PlantVillage lab split"] }),
        paper("2", { methods: ["MAML meta-learning"], datasets: ["field-collected crop set"] }),
      ])
    );
    const pat = r.patterns.find((p) => p.type === "uncompared_methods");
    expect(pat).toBeTruthy();
    expect(pat!.isAbsence).toBe(true);
    expect(pat!.absenceCaveat).toMatch(/this corpus/i);
  });

  it("does NOT flag when methods share a dataset", () => {
    const r = detectPatterns(
      corpus([
        paper("1", { methods: ["prototypical networks"], datasets: ["PlantVillage benchmark dataset"] }),
        paper("2", { methods: ["MAML meta-learning"], datasets: ["PlantVillage benchmark dataset"] }),
      ])
    );
    expect(r.patterns.find((p) => p.type === "uncompared_methods")).toBeUndefined();
  });
});

describe("recurring future work", () => {
  it("clusters a shared future direction across papers", () => {
    const r = detectPatterns(
      corpus([
        paper("1", { futureWork: ["extend to larger multimodal datasets in future"] }),
        paper("2", { futureWork: ["future work should explore larger multimodal datasets"] }),
      ])
    );
    const pat = r.patterns.find((p) => p.type === "recurring_future_work");
    expect(pat).toBeTruthy();
    expect(pat!.papersInvolved).toBe(2);
  });
});

describe("evidence integrity across all patterns", () => {
  it("every evidence item references a paper that is in the corpus", () => {
    const papers = [
      paper("1", {
        methods: ["prototypical networks"],
        datasets: ["lab split A"],
        results: ["accuracy improves on benchmark"],
        limitations: ["no field evaluation performed"],
        futureWork: ["evaluate deployment latency"],
      }),
      paper("2", {
        methods: ["meta learning"],
        datasets: ["field split B"],
        results: ["accuracy fails to improve on benchmark"],
        limitations: ["field evaluation is absent here too"],
        futureWork: ["evaluate deployment latency in future"],
      }),
    ];
    const ids = new Set(papers.map((p) => p.paperId));
    const r = detectPatterns(corpus(papers));
    expect(r.patterns.length).toBeGreaterThan(0);
    for (const pat of r.patterns) {
      expect(pat.evidence.length).toBeGreaterThan(0);
      for (const e of pat.evidence) {
        expect(ids.has(e.paperId)).toBe(true);
        expect(e.passage.length).toBeGreaterThan(0);
      }
      // Every pattern is scoped to the corpus size.
      expect(pat.papersExamined).toBe(2);
      expect(pat.evidenceScope).toContain("corpus");
      // Absence patterns MUST carry a caveat; non-absence MUST NOT.
      if (pat.isAbsence) expect(pat.absenceCaveat).toBeTruthy();
      else expect(pat.absenceCaveat).toBeNull();
    }
  });
});
