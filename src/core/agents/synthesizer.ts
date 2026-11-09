import type { AIProvider } from "@/lib/ai/types";
import { completeJson } from "@/lib/ai/complete";
import {
  synthesizerOutputSchema,
  type SynthesizerOutput,
} from "@/lib/validation/analysis";
import { synthesizerPrompt } from "@/prompts/analysis";
import type { AgentResult, AgentRunOptions } from "@/core/agents/shared";

export interface SynthesizerInput {
  researchProblem: string;
  results: string[];
  limitations: string[];
}

/** Demo Synthesizer: honest, low-confidence summary of extracted evidence. */
export function demoSynthesizer(input: SynthesizerInput): SynthesizerOutput {
  const conclusions =
    input.results.length > 0
      ? input.results.slice(0, 5).map((r) => r.slice(0, 700))
      : [
          "Demo mode: no AI-generated conclusions. Refer to the extracted results and limitations.",
        ];
  return {
    conclusions,
    keyTakeaways: input.results.slice(0, 3).map((r) => r.slice(0, 400)),
    confidence: "low",
    confidenceRationale:
      "Demo mode: confidence is fixed to low because no model reasoning was performed.",
  };
}

export function runSynthesizer(
  provider: AIProvider,
  input: SynthesizerInput,
  opts: AgentRunOptions = {}
): Promise<AgentResult<SynthesizerOutput>> {
  return completeJson({
    provider,
    schema: synthesizerOutputSchema,
    ...synthesizerPrompt({
      researchProblem: input.researchProblem,
      results: input.results,
      limitations: input.limitations,
    }),
    demo: () => demoSynthesizer(input),
    ...opts,
  });
}
