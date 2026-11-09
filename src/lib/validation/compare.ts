import { z } from "zod";

import { COMPARE_MIN, COMPARE_MAX } from "@/lib/compare/config";

export const compareRequestSchema = z.object({
  paperIds: z
    .array(z.string().min(1))
    // De-duplicate before the count check so the same paper can't pad the set.
    .transform((ids) => Array.from(new Set(ids)))
    .pipe(
      z
        .array(z.string().min(1))
        .min(COMPARE_MIN, `Select at least ${COMPARE_MIN} papers to compare`)
        .max(COMPARE_MAX, `You can compare at most ${COMPARE_MAX} papers at once`)
    ),
});

export type CompareRequest = z.infer<typeof compareRequestSchema>;
