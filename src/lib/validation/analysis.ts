import { z } from "zod";

/** Claim categories — kept in sync with the DB ClaimType enum. */
export const CLAIM_TYPES = [
  "OBJECTIVE",
  "METHOD",
  "MODEL_ARCHITECTURE",
  "DATASET",
  "METRIC",
  "RESULT",
  "LIMITATION",
  "FUTURE_WORK",
  "CONTRIBUTION",
  "ASSUMPTION",
  "CONTEXT",
] as const;

export const claimTypeSchema = z.enum(CLAIM_TYPES);

// --- Reader ----------------------------------------------------------------
export const readerOutputSchema = z.object({
  documentType: z.string().min(1).max(80),
  summary: z.string().min(20).max(4000),
  keyPoints: z.array(z.string().min(1).max(500)).min(1).max(12),
  sectionsDetected: z.array(z.string().min(1).max(120)).max(40).default([]),
});
export type ReaderOutput = z.infer<typeof readerOutputSchema>;

// --- Analyzer --------------------------------------------------------------
export const analyzerClaimSchema = z.object({
  type: claimTypeSchema,
  text: z.string().min(1).max(600),
  supportingPassage: z.string().min(1).max(1500),
});

export const analyzerOutputSchema = z.object({
  researchProblem: z.string().min(1).max(2500),
  methodology: z.string().min(1).max(3500),
  datasets: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().max(600).nullable().optional(),
      })
    )
    .max(25)
    .default([]),
  metrics: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        value: z.string().max(120).nullable().optional(),
      })
    )
    .max(40)
    .default([]),
  results: z.array(z.string().min(1).max(600)).max(25).default([]),
  contributions: z.array(z.string().min(1).max(600)).max(25).default([]),
  limitations: z.array(z.string().min(1).max(600)).max(25).default([]),
  claims: z.array(analyzerClaimSchema).max(50).default([]),
});
export type AnalyzerOutput = z.infer<typeof analyzerOutputSchema>;

// --- Terminology -----------------------------------------------------------
export const terminologyOutputSchema = z.object({
  terms: z
    .array(
      z.object({
        term: z.string().min(1).max(160),
        definition: z.string().min(1).max(800),
        relatedTerms: z.array(z.string().min(1).max(160)).max(15).default([]),
      })
    )
    .max(50)
    .default([]),
});
export type TerminologyOutput = z.infer<typeof terminologyOutputSchema>;

// --- Knowledge builder -----------------------------------------------------
// No invented citations: related work is themes/areas, not specific papers.
export const knowledgeOutputSchema = z.object({
  motivation: z.string().min(1).max(2500),
  significance: z.string().min(1).max(2500),
  relatedWorkThemes: z.array(z.string().min(1).max(400)).max(25).default([]),
  followUpQuestions: z.array(z.string().min(1).max(400)).max(20).default([]),
});
export type KnowledgeOutput = z.infer<typeof knowledgeOutputSchema>;

// --- Synthesizer -----------------------------------------------------------
export const synthesizerOutputSchema = z.object({
  conclusions: z.array(z.string().min(1).max(800)).min(1).max(15),
  keyTakeaways: z.array(z.string().min(1).max(500)).max(15).default([]),
  confidence: z.enum(["low", "medium", "high"]),
  confidenceRationale: z.string().min(1).max(1500),
});
export type SynthesizerOutput = z.infer<typeof synthesizerOutputSchema>;

// --- Comparator ------------------------------------------------------------
export const comparatorOutputSchema = z.object({
  dimensions: z
    .array(
      z.object({
        dimension: z.string().min(1).max(120),
        values: z
          .array(
            z.object({
              paperId: z.string().min(1),
              value: z.string().max(1000),
            })
          )
          .min(1),
      })
    )
    .min(1)
    .max(25),
  summary: z.string().min(1).max(3000),
});
export type ComparatorOutput = z.infer<typeof comparatorOutputSchema>;
