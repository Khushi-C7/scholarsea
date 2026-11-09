/**
 * Types for candidate-gap generation (section E, step 3). Client-safe.
 *
 * The integrity mechanism: the model is shown an "evidence menu" — a numbered
 * list of real passages, each already tied to a real ingested paper — and may
 * only reference those items by their `evidenceId`. It never writes paper
 * titles, authors, or passages itself. The pipeline resolves the referenced
 * IDs back to real documents; anything unresolvable is dropped and the gap is
 * labelled unverified. See generate-gaps.ts.
 */

export type GapVerificationStatus =
  | "UNVERIFIED"
  | "VERIFIED"
  | "REFUTED"
  | "NEEDS_REVIEW";

export type GapReviewStatus =
  | "NONE"
  | "USEFUL"
  | "REJECTED"
  | "NEEDS_INVESTIGATION";

export type EvidenceStance = "SUPPORTING" | "CONTRADICTING" | "CONTEXTUAL";

/** An item in the menu handed to the model. Backed by a real paper + passage. */
export interface EvidenceMenuItem {
  evidenceId: string;
  paperId: string;
  paperTitle: string;
  passage: string;
  claimType: string | null;
  /** The detected-pattern suggestion this item came from, for context. */
  fromPattern: string;
}

/** A resolved piece of gap evidence, ready to persist. */
export interface ResolvedEvidence {
  paperId: string;
  paperTitle: string;
  passage: string;
  claimType: string | null;
  stance: EvidenceStance;
  /** True ⇒ the passage maps to a real extracted claim/paper in the corpus. */
  verified: boolean;
}
