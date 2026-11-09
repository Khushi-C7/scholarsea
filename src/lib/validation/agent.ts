import { z } from "zod";

export const createSessionSchema = z.object({
  goal: z.string().trim().min(5, "Describe a research goal").max(1000),
  projectId: z.string().min(1).optional(),
});

/** The synthesizer's output: answer prose + cited passage ids. */
export const agentSynthesisSchema = z.object({
  answer: z.string().min(1).max(5000),
  citedPassageIds: z.array(z.string().min(1)).max(20).default([]),
  insufficient: z.boolean().default(false),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type AgentSynthesis = z.infer<typeof agentSynthesisSchema>;
