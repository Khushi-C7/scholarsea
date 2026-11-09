/**
 * Research Gap Explorer — shared types for the evidence corpus (step 1) and
 * the pattern-detection engine (step 2). Client-safe: no server-only imports,
 * no DB. The builder in corpus.ts produces an EvidenceCorpus; the pure engine
 * in patterns.ts turns it into CandidatePatterns.
 */

export type ClaimType =
  | "OBJECTIVE"
  | "METHOD"
  | "MODEL_ARCHITECTURE"
  | "DATASET"
  | "METRIC"
  | "RESULT"
  | "LIMITATION"
  | "FUTURE_WORK"
  | "CONTRIBUTION"
  | "ASSUMPTION"
  | "CONTEXT";

/** A claim retained with its source: paper identifier + verbatim passage. */
export interface CorpusClaim {
  paperId: string;
  paperTitle: string;
  type: ClaimType;
  text: string;
  supportingPassage: string;
  /** { page?, section?, charStart?, charEnd? } when available. */
  location: Record<string, unknown> | null;
}

/** Structured information collected from one analyzed paper. */
export interface CorpusPaper {
  paperId: string;
  title: string;
  year: number | null;
  analyzed: boolean;
  analysisId: string | null;

  objectives: string[];
  methods: string[];
  architectures: string[];
  datasets: string[];
  metrics: string[];
  results: string[];
  limitations: string[];
  futureWork: string[];
  contexts: string[];

  /** Every extracted claim for this paper, each source-linked. */
  claims: CorpusClaim[];
}

export interface EvidenceCorpus {
  projectId: string;
  papers: CorpusPaper[];
  /** Total papers in the corpus (i.e. in the project). */
  papersExamined: number;
  /** How many of those actually had an analysis to draw from. */
  papersAnalyzed: number;
  generatedAt: string;
}

export type PatternType =
  | "repeated_limitation"
  | "conflicting_findings"
  | "uncompared_methods"
  | "dataset_coverage_gap"
  | "missing_evaluation"
  | "recurring_future_work";

/** One evidence item backing a pattern — always points at a real corpus paper. */
export interface PatternEvidence {
  paperId: string;
  paperTitle: string;
  /** Verbatim passage or the structured value that supports the pattern. */
  passage: string;
  claimType: ClaimType | null;
}

export interface CandidatePattern {
  type: PatternType;
  title: string;
  description: string;
  evidence: PatternEvidence[];
  /** Distinct corpus papers contributing evidence. */
  papersInvolved: number;
  /** Size of the analyzed corpus this was derived from. */
  papersExamined: number;
  /**
   * Human-readable scope, always stated relative to THIS corpus — e.g.
   * "Observed in 3 of 5 analyzed papers in this corpus."
   */
  evidenceScope: string;
  /**
   * True when the pattern is about something the corpus does NOT contain
   * (a coverage or missing-evaluation gap). Such patterns always carry an
   * absenceCaveat making explicit that this is absence of evidence in the
   * analyzed corpus — not proof that no such research exists anywhere.
   */
  isAbsence: boolean;
  absenceCaveat: string | null;
}
