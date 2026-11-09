import { describe, it, expect } from "vitest";

import { buildEvidenceMenu, resolveGap } from "@/lib/gaps/gap-resolve";
import type { CandidatePattern } from "@/lib/gaps/types";
import type { GeneratedGap } from "@/lib/validation/gap-gen";

function pattern(over: Partial<CandidatePattern> = {}): CandidatePattern {
  return {
    type: "repeated_limitation",
    title: "t",
    description: "d",
    evidence: [],
    papersInvolved: 0,
    papersExamined: 2,
    evidenceScope: "scope in this corpus",
    isAbsence: false,
    absenceCaveat: null,
    ...over,
  };
}

const PATTERNS: CandidatePattern[] = [
  pattern({
    evidence: [
      { paperId: "p1", paperTitle: "Paper One", passage: "no field eval", claimType: "LIMITATION" },
      { paperId: "p2", paperTitle: "Paper Two", passage: "field untested", claimType: "LIMITATION" },
    ],
  }),
  pattern({
    type: "conflicting_findings",
    evidence: [
      { paperId: "p1", paperTitle: "Paper One", passage: "accuracy improves", claimType: "RESULT" },
      { paperId: "p3", paperTitle: "Paper Three", passage: "accuracy drops", claimType: "RESULT" },
    ],
  }),
];

function gap(over: Partial<GeneratedGap> = {}): GeneratedGap {
  return {
    title: "Gap",
    explanation: "exp",
    significance: "sig",
    confidenceRationale: "rationale",
    supportingEvidenceIds: [],
    contradictingEvidenceIds: [],
    suggestedExperiments: [],
    researchQuestions: [],
    ...over,
  };
}

describe("buildEvidenceMenu", () => {
  it("assigns a stable id to each distinct paper+passage", () => {
    const menu = buildEvidenceMenu(PATTERNS);
    // 4 evidence items, all distinct.
    expect(menu).toHaveLength(4);
    expect(new Set(menu.map((m) => m.evidenceId)).size).toBe(4);
    expect(menu.every((m) => m.paperId && m.passage)).toBe(true);
  });

  it("de-duplicates identical paper+passage across patterns", () => {
    const dup = [
      pattern({ evidence: [{ paperId: "p1", paperTitle: "One", passage: "same", claimType: "LIMITATION" }] }),
      pattern({ type: "recurring_future_work", evidence: [{ paperId: "p1", paperTitle: "One", passage: "same", claimType: "FUTURE_WORK" }] }),
    ];
    expect(buildEvidenceMenu(dup)).toHaveLength(1);
  });
});

describe("resolveGap — fabrication firewall", () => {
  const menu = buildEvidenceMenu(PATTERNS);
  const realIds = menu.map((m) => m.evidenceId);

  it("resolves real evidence ids to real paper passages", () => {
    const r = resolveGap(
      gap({ supportingEvidenceIds: [realIds[0], realIds[1]] }),
      menu
    );
    expect(r.evidence).toHaveLength(2);
    expect(r.evidence.every((e) => e.verified)).toBe(true);
    expect(r.droppedReferences).toBe(0);
    expect(r.verificationStatus).toBe("VERIFIED");
  });

  it("drops invented evidence ids and flags the gap NEEDS_REVIEW", () => {
    const r = resolveGap(
      gap({ supportingEvidenceIds: [realIds[0], "E999_FAKE", "totally-made-up"] }),
      menu
    );
    // Only the real one survives; the two fabricated ids are dropped.
    expect(r.evidence).toHaveLength(1);
    expect(r.droppedReferences).toBe(2);
    expect(r.verificationStatus).toBe("NEEDS_REVIEW");
  });

  it("a gap citing ONLY invented ids resolves to no evidence and is UNVERIFIED", () => {
    const r = resolveGap(
      gap({ supportingEvidenceIds: ["fake1", "fake2"] }),
      menu
    );
    expect(r.evidence).toHaveLength(0);
    expect(r.verificationStatus).toBe("UNVERIFIED");
  });

  it("marks REFUTED when contradicting evidence outweighs support", () => {
    const r = resolveGap(
      gap({
        supportingEvidenceIds: [realIds[0]],
        contradictingEvidenceIds: [realIds[1], realIds[2]],
      }),
      menu
    );
    expect(r.verificationStatus).toBe("REFUTED");
  });

  it("verification is independent of the model's stated confidence", () => {
    // A gap can SAY it is highly confident, but with no resolvable evidence it
    // is still UNVERIFIED — model confidence never drives verification.
    const r = resolveGap(
      gap({
        confidenceRationale: "I am extremely confident this is a real gap.",
        supportingEvidenceIds: ["nope"],
      }),
      menu
    );
    expect(r.verificationStatus).toBe("UNVERIFIED");
  });

  it("every resolved evidence item maps to a real menu passage", () => {
    const passages = new Set(menu.map((m) => m.passage));
    const r = resolveGap(
      gap({ supportingEvidenceIds: realIds, contradictingEvidenceIds: ["x"] }),
      menu
    );
    for (const e of r.evidence) expect(passages.has(e.passage)).toBe(true);
  });
});
