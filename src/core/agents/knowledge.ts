import type { AIProvider } from "@/lib/ai/types";
import { completeJson } from "@/lib/ai/complete";
import {
  knowledgeOutputSchema,
  type KnowledgeOutput,
} from "@/lib/validation/analysis";
import { knowledgePrompt } from "@/prompts/analysis";
import {
  orFallback,
  type AgentResult,
  type AgentRunOptions,
} from "@/core/agents/shared";

export interface KnowledgeInput {
  title: string;
  researchProblem: string;
  methodology: string;
  contributions: string[];
  limitations: string[];
}

/** Demo Knowledge builder: motivation/questions derived from the analysis. */
export function demoKnowledge(input: KnowledgeInput): KnowledgeOutput {
  const followUps =
    input.limitations.length > 0
      ? input.limitations
          .slice(0, 5)
          .map((l) => `How could this be addressed: ${l.slice(0, 300)}`)
      : ["What are the main open questions this work leaves unanswered?"];
  return {
    motivation: orFallback(
      `Demo mode: motivation inferred from the research problem — ${input.researchProblem}`,
      "Demo mode: motivation not generated."
    ).slice(0, 2500),
    significance: orFallback(
      input.contributions[0]
        ? `Demo mode: significance relates to the stated contribution — ${input.contributions[0]}`
        : "",
      "Demo mode: significance not generated."
    ).slice(0, 2500),
    relatedWorkThemes: [],
    followUpQuestions: followUps,
  };
}

export function runKnowledge(
  provider: AIProvider,
  input: KnowledgeInput,
  opts: AgentRunOptions = {}
): Promise<AgentResult<KnowledgeOutput>> {
  return completeJson({
    provider,
    schema: knowledgeOutputSchema,
    ...knowledgePrompt({
      title: input.title,
      researchProblem: input.researchProblem,
      methodology: input.methodology,
      contributions: input.contributions,
    }),
    demo: () => demoKnowledge(input),
    ...opts,
  });
}
