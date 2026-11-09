/** Client-safe view types for a persisted gap analysis + its report export. */

export interface GapEvidenceView {
  id: string;
  paperId: string;
  paperTitle: string;
  stance: "SUPPORTING" | "CONTRADICTING" | "CONTEXTUAL";
  passage: string;
  verified: boolean;
  note: string | null;
}

export interface GapView {
  id: string;
  title: string;
  explanation: string;
  significance: string | null;
  confidenceRationale: string | null;
  evidenceCoverage: string | null;
  verificationStatus: "UNVERIFIED" | "VERIFIED" | "REFUTED" | "NEEDS_REVIEW";
  reviewStatus: "NONE" | "USEFUL" | "REJECTED" | "NEEDS_INVESTIGATION";
  reviewerNotes: string | null;
  suggestedExperiments: string[];
  researchQuestions: string[];
  supporting: GapEvidenceView[];
  contradicting: GapEvidenceView[];
}

export interface PatternSummary {
  type: string;
  title: string;
  isAbsence: boolean;
  evidenceScope: string;
  papersInvolved: number;
}

export interface GapAnalysisView {
  id: string;
  projectId: string;
  projectName: string;
  status: string;
  papersExamined: number;
  executiveSummary: string | null;
  coverageNotes: string | null;
  limitations: string | null;
  patterns: PatternSummary[];
  gaps: GapView[];
  insufficientEvidence: boolean;
  createdAt: string;
}
