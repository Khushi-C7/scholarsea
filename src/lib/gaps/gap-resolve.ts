/**
 * The fabrication firewall for candidate gaps. Pure functions, no DB/AI, so
 * they are exhaustively testable.
 *
 * `buildEvidenceMenu` turns detected patterns into a numbered menu of real
 * passages. `resolveGap` takes the model's id-references and resolves them
 * against that menu: ids that exist become verified evidence; ids the model
 * invented are dropped. A gap with no resolvable supporting evidence can never
 * be presented as VERIFIED.
 */
import type { CandidatePattern } from "@/lib/gaps/types";
import type {
  EvidenceMenuItem,
  ResolvedEvidence,
  GapVerificationStatus,
} from "@/lib/gaps/gap-gen-types";
import type { GeneratedGap } from "@/lib/validation/gap-gen";

/** Build the id→real-passage menu from detected patterns, de-duplicated. */
export function buildEvidenceMenu(
  patterns: CandidatePattern[]
): EvidenceMenuItem[] {
  const menu: EvidenceMenuItem[] = [];
  const seen = new Set<string>();
  let n = 1;
  for (const pattern of patterns) {
    for (const e of pattern.evidence) {
      // De-duplicate identical paper+passage pairs across patterns.
      const key = `${e.paperId}::${e.passage}`;
      if (seen.has(key)) continue;
      seen.add(key);
      menu.push({
        evidenceId: `E${n++}`,
        paperId: e.paperId,
        paperTitle: e.paperTitle,
        passage: e.passage,
        claimType: e.claimType,
        fromPattern: pattern.type,
      });
    }
  }
  return menu;
}

export interface ResolvedGap {
  title: string;
  explanation: string;
  significance: string;
  confidenceRationale: string;
  evidence: ResolvedEvidence[];
  suggestedExperiments: string[];
  researchQuestions: string[];
  verificationStatus: GapVerificationStatus;
  evidenceCoverage: string;
  /** Count of referenced ids that could NOT be resolved (fabrication signal). */
  droppedReferences: number;
}

/**
 * Resolve one model-produced gap against the evidence menu.
 *
 * - Supporting/contradicting ids are looked up in the menu; unknown ids are
 *   counted as dropped and discarded (never rendered).
 * - verificationStatus is computed from the EVIDENCE, not the model's
 *   confidence: VERIFIED only if ≥1 supporting item resolved and no referenced
 *   id was fabricated; NEEDS_REVIEW if some ids were fabricated; UNVERIFIED if
 *   nothing resolved; REFUTED if contradicting evidence outweighs support.
 */
export function resolveGap(
  gap: GeneratedGap,
  menu: EvidenceMenuItem[]
): ResolvedGap {
  const byId = new Map(menu.map((m) => [m.evidenceId, m]));
  const evidence: ResolvedEvidence[] = [];
  let dropped = 0;

  const take = (ids: string[], stance: ResolvedEvidence["stance"]) => {
    for (const id of ids) {
      const item = byId.get(id);
      if (!item) {
        dropped += 1;
        continue;
      }
      evidence.push({
        paperId: item.paperId,
        paperTitle: item.paperTitle,
        passage: item.passage,
        claimType: item.claimType,
        stance,
        verified: true, // came from the real-corpus menu
      });
    }
  };
  take(gap.supportingEvidenceIds, "SUPPORTING");
  take(gap.contradictingEvidenceIds, "CONTRADICTING");

  const supporting = evidence.filter((e) => e.stance === "SUPPORTING").length;
  const contradicting = evidence.filter(
    (e) => e.stance === "CONTRADICTING"
  ).length;
  const papers = new Set(evidence.map((e) => e.paperId)).size;

  let status: GapVerificationStatus;
  if (supporting === 0) {
    status = "UNVERIFIED";
  } else if (contradicting > supporting) {
    status = "REFUTED";
  } else if (dropped > 0) {
    status = "NEEDS_REVIEW";
  } else {
    status = "VERIFIED";
  }

  const evidenceCoverage =
    supporting === 0
      ? "No verifiable supporting evidence in the corpus."
      : `Supported by ${supporting} passage${supporting === 1 ? "" : "s"} across ${papers} paper${papers === 1 ? "" : "s"}${
          contradicting > 0
            ? `; ${contradicting} contradicting passage${contradicting === 1 ? "" : "s"} found`
            : ""
        }.`;

  return {
    title: gap.title,
    explanation: gap.explanation,
    significance: gap.significance,
    confidenceRationale: gap.confidenceRationale,
    evidence,
    suggestedExperiments: gap.suggestedExperiments,
    researchQuestions: gap.researchQuestions,
    verificationStatus: status,
    evidenceCoverage,
    droppedReferences: dropped,
  };
}
