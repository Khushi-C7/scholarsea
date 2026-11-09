import type { AIProvider } from "@/lib/ai/types";
import type { TokenUsage } from "@/lib/ai/types";
import { ZERO_USAGE, addUsage } from "@/lib/ai/types";
import type { AgentResult, AgentRunOptions } from "@/core/agents/shared";
import type {
  ReaderOutput,
  AnalyzerOutput,
  TerminologyOutput,
  KnowledgeOutput,
  SynthesizerOutput,
} from "@/lib/validation/analysis";
import { runReader } from "@/core/agents/reader";
import { runAnalyzer } from "@/core/agents/analyzer";
import { runTerminology } from "@/core/agents/terminology";
import { runKnowledge } from "@/core/agents/knowledge";
import { runSynthesizer } from "@/core/agents/synthesizer";

export type StageStatus = "COMPLETED" | "FAILED" | "SKIPPED";

export interface StageResult {
  name: string;
  status: StageStatus;
  attempts: number;
  tokensUsed: number;
  ms: number;
  error?: string;
}

export interface InsightReport {
  reader: ReaderOutput | null;
  analyzer: AnalyzerOutput | null;
  terminology: TerminologyOutput | null;
  knowledge: KnowledgeOutput | null;
  synthesizer: SynthesizerOutput | null;
}

export interface AnalysisRunResult {
  report: InsightReport;
  stages: StageResult[];
  usage: TokenUsage;
  demo: boolean;
  status: "COMPLETED" | "FAILED";
  error?: string;
}

export interface AnalysisInput {
  title: string;
  text: string;
}

interface StageOutcome<T> {
  data: T | null;
  stage: StageResult;
  usage: TokenUsage;
  demo: boolean;
}

async function runStage<T>(
  name: string,
  fn: () => Promise<AgentResult<T>>
): Promise<StageOutcome<T>> {
  const start = Date.now();
  try {
    const r = await fn();
    const stage: StageResult = {
      name,
      status: "COMPLETED",
      attempts: r.attempts,
      tokensUsed: r.usage.totalTokens,
      ms: Date.now() - start,
    };
    console.info(
      `[analysis] ${name} ok (${stage.ms}ms, ${stage.tokensUsed} tok, ${r.attempts} attempt(s))`
    );
    return { data: r.data, stage, usage: r.usage, demo: r.demo };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[analysis] ${name} failed: ${message}`);
    return {
      data: null,
      stage: {
        name,
        status: "FAILED",
        attempts: 0,
        tokensUsed: 0,
        ms: Date.now() - start,
        error: message,
      },
      usage: ZERO_USAGE,
      demo: false,
    };
  }
}

/**
 * Run the single-paper analysis pipeline.
 *
 * Dependencies: Reader → (Analyzer ∥ Terminology) → Knowledge → Synthesizer.
 * Analyzer and Terminology run concurrently. Reader and Analyzer are required;
 * if either fails the run is FAILED. Terminology, Knowledge, and Synthesizer
 * degrade gracefully (null) so a partial report is still produced.
 */
export async function runAnalysisPipeline(
  provider: AIProvider,
  input: AnalysisInput,
  opts: AgentRunOptions = {}
): Promise<AnalysisRunResult> {
  const stages: StageResult[] = [];
  let usage = ZERO_USAGE;
  const report: InsightReport = {
    reader: null,
    analyzer: null,
    terminology: null,
    knowledge: null,
    synthesizer: null,
  };

  // 1. Reader (required)
  const reader = await runStage("reader", () =>
    runReader(provider, { title: input.title, text: input.text }, opts)
  );
  stages.push(reader.stage);
  usage = addUsage(usage, reader.usage);
  report.reader = reader.data;
  const demo = reader.demo;

  if (!reader.data) {
    return {
      report,
      stages,
      usage,
      demo,
      status: "FAILED",
      error: `Reader failed: ${reader.stage.error}`,
    };
  }

  // 2. Analyzer (required) ∥ Terminology (optional) — concurrent
  const [analyzer, terminology] = await Promise.all([
    runStage("analyzer", () =>
      runAnalyzer(
        provider,
        {
          title: input.title,
          text: input.text,
          readerSummary: reader.data!.summary,
        },
        opts
      )
    ),
    runStage("terminology", () =>
      runTerminology(provider, { text: input.text }, opts)
    ),
  ]);
  stages.push(analyzer.stage, terminology.stage);
  usage = addUsage(addUsage(usage, analyzer.usage), terminology.usage);
  report.analyzer = analyzer.data;
  report.terminology = terminology.data;

  if (!analyzer.data) {
    return {
      report,
      stages,
      usage,
      demo,
      status: "FAILED",
      error: `Analyzer failed: ${analyzer.stage.error}`,
    };
  }

  // 3. Knowledge builder (optional)
  const knowledge = await runStage("knowledge", () =>
    runKnowledge(
      provider,
      {
        title: input.title,
        researchProblem: analyzer.data!.researchProblem,
        methodology: analyzer.data!.methodology,
        contributions: analyzer.data!.contributions,
        limitations: analyzer.data!.limitations,
      },
      opts
    )
  );
  stages.push(knowledge.stage);
  usage = addUsage(usage, knowledge.usage);
  report.knowledge = knowledge.data;

  // 4. Synthesizer (optional)
  const synthesizer = await runStage("synthesizer", () =>
    runSynthesizer(
      provider,
      {
        researchProblem: analyzer.data!.researchProblem,
        results: analyzer.data!.results,
        limitations: analyzer.data!.limitations,
      },
      opts
    )
  );
  stages.push(synthesizer.stage);
  usage = addUsage(usage, synthesizer.usage);
  report.synthesizer = synthesizer.data;

  return { report, stages, usage, demo, status: "COMPLETED" };
}
