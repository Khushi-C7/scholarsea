import { z } from "zod";

export const corpusRequestSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
});

export type CorpusRequest = z.infer<typeof corpusRequestSchema>;

export const generateGapsRequestSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
});

/** Evidence-inspector marking + notes on a candidate gap. */
export const reviewGapSchema = z
  .object({
    reviewStatus: z
      .enum(["NONE", "USEFUL", "REJECTED", "NEEDS_INVESTIGATION"])
      .optional(),
    reviewerNotes: z.string().trim().max(5000).nullable().optional(),
  })
  .refine(
    (v) => v.reviewStatus !== undefined || v.reviewerNotes !== undefined,
    { message: "Nothing to update" }
  );

export type ReviewGapInput = z.infer<typeof reviewGapSchema>;
