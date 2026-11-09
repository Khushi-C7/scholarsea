import type { AIProvider } from "@/lib/ai/types";
import { completeJson } from "@/lib/ai/complete";
import { readerOutputSchema, type ReaderOutput } from "@/lib/validation/analysis";
import { readerPrompt } from "@/prompts/analysis";
import {
  truncateForPrompt,
  firstSentences,
  detectSections,
  orFallback,
  type AgentResult,
  type AgentRunOptions,
} from "@/core/agents/shared";

export interface ReaderInput {
  title: string;
  text: string;
}

/** Demo Reader: a faithful, heuristic summary straight from the text. */
export function demoReader(input: ReaderInput): ReaderOutput {
  const sentences = firstSentences(input.text, 4);
  const summary = orFallback(
    sentences.join(" "),
    "Demo mode: no summary generated. The document text was too short to summarize heuristically."
  );
  const keyPoints = firstSentences(input.text, 5).map((s) => s.slice(0, 300));
  return {
    documentType: "research paper (demo)",
    summary: summary.slice(0, 4000),
    keyPoints: keyPoints.length > 0 ? keyPoints : [input.title],
    sectionsDetected: detectSections(input.text),
  };
}

export function runReader(
  provider: AIProvider,
  input: ReaderInput,
  opts: AgentRunOptions = {}
): Promise<AgentResult<ReaderOutput>> {
  const text = truncateForPrompt(input.text);
  return completeJson({
    provider,
    schema: readerOutputSchema,
    ...readerPrompt({ title: input.title, text }),
    demo: () => demoReader(input),
    ...opts,
  });
}
