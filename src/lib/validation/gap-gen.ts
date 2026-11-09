import { z } from "zod";

/**
 * Schema for the model's candidate-gap output. The model supplies the gap
 * narrative and *references* evidence by id (supportingEvidenceIds /
 * contradictingEvidenceIds) — it must not, and structurally cannot, emit paper
 * titles, authors, or passages. Those are resolved from the evidence menu
 * server-side.
 */
export const generatedGapSchema = z.object({
  title: z.string().min(1).max(200),
  explanation: z.string().min(1).max(3000),
  /** Why the gap matters. */
  significance: z.string().min(1).max(2000),
  /** A rationale grounded in the observable evidence, not model self-assurance. */
  confidenceRationale: z.string().min(1).max(1500),
  supportingEvidenceIds: z.array(z.string().min(1)).max(30).default([]),
  contradictingEvidenceIds: z.array(z.string().min(1)).max(30).default([]),
  suggestedExperiments: z.array(z.string().min(1).max(600)).max(10).default([]),
  researchQuestions: z.array(z.string().min(1).max(400)).max(10).default([]),
});

export const generatedGapsSchema = z.object({
  gaps: z.array(generatedGapSchema).max(15).default([]),
  executiveSummary: z.string().min(1).max(3000),
});

export type GeneratedGap = z.infer<typeof generatedGapSchema>;
export type GeneratedGaps = z.infer<typeof generatedGapsSchema>;
