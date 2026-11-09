import type { AIProvider } from "@/lib/ai/types";
import { completeJson } from "@/lib/ai/complete";
import {
  terminologyOutputSchema,
  type TerminologyOutput,
} from "@/lib/validation/analysis";
import { terminologyPrompt } from "@/prompts/analysis";
import {
  truncateForPrompt,
  candidateTerms,
  type AgentResult,
  type AgentRunOptions,
} from "@/core/agents/shared";

export interface TerminologyInput {
  text: string;
}

/** Demo Terminology: surfaces candidate terms without inventing definitions. */
export function demoTerminology(input: TerminologyInput): TerminologyOutput {
  const terms = candidateTerms(input.text, 12).map((term) => ({
    term,
    definition:
      "Term appearing in the document (demo mode — no definition generated).",
    relatedTerms: [],
  }));
  return { terms };
}

export function runTerminology(
  provider: AIProvider,
  input: TerminologyInput,
  opts: AgentRunOptions = {}
): Promise<AgentResult<TerminologyOutput>> {
  const text = truncateForPrompt(input.text);
  return completeJson({
    provider,
    schema: terminologyOutputSchema,
    ...terminologyPrompt({ text }),
    demo: () => demoTerminology(input),
    ...opts,
  });
}
