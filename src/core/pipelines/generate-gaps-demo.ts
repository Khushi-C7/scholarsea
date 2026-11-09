/**
 * Deterministic demo generator: turns detected patterns into candidate gaps
 * without a model, referencing the evidence menu by id — so it exercises the
 * same resolution path as the AI output, and produces grounded, reproducible
 * gaps for tests and for demo mode.
 */
import type { CandidatePattern } from "@/lib/gaps/types";
import type { EvidenceMenuItem } from "@/lib/gaps/gap-gen-types";
import type { GeneratedGaps, GeneratedGap } from "@/lib/validation/gap-gen";

export function demoGenerateGaps(
  patterns: CandidatePattern[],
  menu: EvidenceMenuItem[],
  papersExamined: number
): GeneratedGaps {
  // Map each evidence item back to its menu id by paper+passage.
  const idFor = new Map(
    menu.map((m) => [`${m.paperId}::${m.passage}`, m.evidenceId])
  );

  const gaps: GeneratedGap[] = patterns.map((p) => {
    const ids = p.evidence
      .map((e) => idFor.get(`${e.paperId}::${e.passage}`))
      .filter((x): x is string => Boolean(x));

    // Conflicting-findings patterns split their two sides into support vs
    // contradiction; others treat all evidence as supporting.
    const isConflict = p.type === "conflicting_findings";
    const supporting = isConflict ? ids.slice(0, 1) : ids;
    const contradicting = isConflict ? ids.slice(1) : [];

    return {
      title: p.title,
      explanation:
        p.description +
        (p.isAbsence ? ` ${p.absenceCaveat ?? ""}` : ""),
      significance:
        p.type === "repeated_limitation"
          ? "A limitation shared across multiple papers is a strong candidate for targeted improvement."
          : p.type === "conflicting_findings"
            ? "Reconciling conflicting findings would clarify what actually holds under which conditions."
            : p.type === "missing_evaluation"
              ? "An evaluation the corpus never performs may hide real-world weaknesses."
              : p.type === "uncompared_methods"
                ? "Without a controlled comparison, reported gains cannot be attributed to the method itself."
                : p.type === "dataset_coverage_gap"
                  ? "Thin dataset overlap limits how comparable and generalizable the findings are."
                  : "A direction multiple papers point to is a well-motivated opportunity.",
      confidenceRationale:
        `${p.evidenceScope} ${
          contradicting.length > 0
            ? "Countervailing evidence is present, so confidence is tempered."
            : "No contradicting evidence was found in this corpus."
        } (Demo mode: derived deterministically from detected patterns.)`,
      supportingEvidenceIds: supporting,
      contradictingEvidenceIds: contradicting,
      suggestedExperiments:
        p.type === "uncompared_methods"
          ? ["Evaluate the methods on a shared dataset under identical settings."]
          : p.type === "missing_evaluation"
            ? ["Add the missing evaluation to each method on a common benchmark."]
            : ["Design a study that directly targets this gap on a shared benchmark."],
      researchQuestions: [
        `What would it take to resolve: ${p.title.toLowerCase()}?`,
      ],
    };
  });

  const executiveSummary =
    gaps.length === 0
      ? `No candidate gaps could be derived from the ${papersExamined} analyzed papers in this corpus. This is an absence of detected gaps, not evidence that none exist — add more analyzed papers.`
      : `Across ${papersExamined} analyzed papers, ${gaps.length} candidate gap${
          gaps.length === 1 ? "" : "s"
        } were derived from recurring limitations, conflicts, coverage gaps, and future-work directions. (Demo mode: heuristic, not model-generated.)`;

  return { gaps, executiveSummary };
}
