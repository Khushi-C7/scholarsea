import type { AIProvider } from "@/lib/ai/types";
import { completeJson } from "@/lib/ai/complete";
import {
  comparatorOutputSchema,
  type ComparatorOutput,
} from "@/lib/validation/analysis";
import { comparatorPrompt } from "@/prompts/analysis";
import type { AgentResult, AgentRunOptions } from "@/core/agents/shared";

export interface ComparatorPaper {
  paperId: string;
  title: string;
  /** JSON string of that paper's analysis sections. */
  analysisJson: string;
}

export const DEFAULT_COMPARE_DIMENSIONS = [
  "Research objective",
  "Methodology",
  "Datasets",
  "Evaluation metrics",
  "Results",
  "Limitations",
  "Contributions",
];

export interface ComparatorInput {
  papers: ComparatorPaper[];
  dimensions?: string[];
}

/** Demo Comparator: scaffolds the matrix without inventing comparisons. */
export function demoComparator(input: ComparatorInput): ComparatorOutput {
  const dims = input.dimensions ?? DEFAULT_COMPARE_DIMENSIONS;
  return {
    dimensions: dims.map((dimension) => ({
      dimension,
      values: input.papers.map((p) => ({
        paperId: p.paperId,
        value: "(demo mode — not compared)",
      })),
    })),
    summary:
      "Demo mode: no cross-paper comparison was generated. Configure an API key for a real comparison.",
  };
}

export function runComparator(
  provider: AIProvider,
  input: ComparatorInput,
  opts: AgentRunOptions = {}
): Promise<AgentResult<ComparatorOutput>> {
  const dimensions = input.dimensions ?? DEFAULT_COMPARE_DIMENSIONS;
  return completeJson({
    provider,
    schema: comparatorOutputSchema,
    ...comparatorPrompt({ papers: input.papers, dimensions }),
    demo: () => demoComparator(input),
    ...opts,
  });
}
