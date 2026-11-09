import type { AIProvider } from "@/lib/ai/types";
import { completeJson } from "@/lib/ai/complete";
import {
  analyzerOutputSchema,
  type AnalyzerOutput,
} from "@/lib/validation/analysis";
import { analyzerPrompt } from "@/prompts/analysis";
import {
  truncateForPrompt,
  sentencesMatching,
  orFallback,
  type AgentResult,
  type AgentRunOptions,
} from "@/core/agents/shared";

export interface AnalyzerInput {
  title: string;
  text: string;
  readerSummary: string;
}

/** Demo Analyzer: keyword-driven extraction, grounded in the text. */
export function demoAnalyzer(input: AnalyzerInput): AnalyzerOutput {
  const text = input.text;
  const problem = sentencesMatching(
    text,
    ["problem", "aim", "address", "propose", "challenge", "task of"],
    1
  )[0];
  const method = sentencesMatching(
    text,
    ["method", "approach", "we use", "we train", "model", "architecture", "algorithm"],
    1
  )[0];
  const results = sentencesMatching(
    text,
    ["accuracy", "achieve", "result", "outperform", "%", "score", "F1"],
    5
  );
  const contributions = sentencesMatching(
    text,
    ["contribution", "we propose", "we introduce", "we present", "novel"],
    5
  );
  const limitations = sentencesMatching(
    text,
    ["limitation", "however", "future work", "do not", "cannot", "fails"],
    5
  );

  const claims: AnalyzerOutput["claims"] = [];
  const firstResult = results[0];
  if (firstResult) {
    claims.push({
      type: "RESULT",
      text: "A reported result from the paper.",
      supportingPassage: firstResult.slice(0, 1400),
    });
  }
  const firstLimitation = limitations[0];
  if (firstLimitation) {
    claims.push({
      type: "LIMITATION",
      text: "A stated or evident limitation.",
      supportingPassage: firstLimitation.slice(0, 1400),
    });
  }

  return {
    researchProblem: orFallback(
      problem,
      "Demo mode: the research problem was not clearly identifiable from the text."
    ).slice(0, 2500),
    methodology: orFallback(
      method,
      "Demo mode: the methodology was not clearly identifiable from the text."
    ).slice(0, 3500),
    datasets: [],
    metrics: [],
    results: results.map((s) => s.slice(0, 600)),
    contributions: contributions.map((s) => s.slice(0, 600)),
    limitations: limitations.map((s) => s.slice(0, 600)),
    claims,
  };
}

export function runAnalyzer(
  provider: AIProvider,
  input: AnalyzerInput,
  opts: AgentRunOptions = {}
): Promise<AgentResult<AnalyzerOutput>> {
  const text = truncateForPrompt(input.text);
  return completeJson({
    provider,
    schema: analyzerOutputSchema,
    ...analyzerPrompt({
      title: input.title,
      text,
      readerSummary: input.readerSummary,
    }),
    demo: () => demoAnalyzer(input),
    ...opts,
  });
}
