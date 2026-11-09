import { z } from "zod";

export const createConversationSchema = z.object({
  paperIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one paper")
    .max(50),
  projectId: z.string().min(1).optional(),
  title: z.string().trim().max(200).optional(),
});

export const askSchema = z.object({
  question: z.string().trim().min(1, "Ask a question").max(2000),
});

/** The model's grounded answer: prose + the passageIds it relied on. */
export const chatAnswerSchema = z.object({
  answer: z.string().min(1).max(4000),
  citedPassageIds: z.array(z.string().min(1)).max(12).default([]),
  /** The model's own judgement that the passages don't answer the question. */
  insufficient: z.boolean().default(false),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type AskInput = z.infer<typeof askSchema>;
export type ChatAnswer = z.infer<typeof chatAnswerSchema>;
