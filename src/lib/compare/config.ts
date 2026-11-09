/**
 * Comparison configuration. The upper limit is a single named constant so it
 * is easy to change in one place (the spec asks for a configurable upper
 * limit). Minimum is 2 — a comparison needs at least two papers.
 */
export const COMPARE_MIN = 2;
export const COMPARE_MAX = 6;

/** The claim type the DB stores for each dimension, when source-linked. */
export type ClaimType =
  | "OBJECTIVE"
  | "METHOD"
  | "MODEL_ARCHITECTURE"
  | "DATASET"
  | "METRIC"
  | "RESULT"
  | "LIMITATION"
  | "FUTURE_WORK"
  | "CONTRIBUTION";

export interface DimensionDef {
  key: string;
  label: string;
  /** Claim type whose supporting passages back this dimension, if any. */
  claimType?: ClaimType;
}

/**
 * The comparison dimensions, in display order. Mirrors section G exactly.
 * `claimType` links a dimension to the extracted claims that can supply a
 * source passage for it.
 */
export const COMPARE_DIMENSIONS: DimensionDef[] = [
  { key: "objective", label: "Research objective", claimType: "OBJECTIVE" },
  { key: "methodology", label: "Methodology", claimType: "METHOD" },
  {
    key: "architecture",
    label: "Model architecture",
    claimType: "MODEL_ARCHITECTURE",
  },
  { key: "datasets", label: "Datasets", claimType: "DATASET" },
  { key: "metrics", label: "Evaluation metrics", claimType: "METRIC" },
  { key: "results", label: "Results", claimType: "RESULT" },
  { key: "limitations", label: "Limitations", claimType: "LIMITATION" },
  {
    key: "contributions",
    label: "Contributions",
    claimType: "CONTRIBUTION",
  },
  { key: "futureWork", label: "Future work", claimType: "FUTURE_WORK" },
];
