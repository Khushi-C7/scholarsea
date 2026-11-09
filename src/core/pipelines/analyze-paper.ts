import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getOwnedPaper } from "@/lib/auth/guards";
import { getProvider } from "@/lib/ai/provider";
import { NotAnalyzableError } from "@/lib/ai/errors";
import {
  runAnalysisPipeline,
  type StageResult,
} from "@/core/orchestration/coordinator";
import { extractReferences } from "@/lib/documents/references";
import { PROMPT_VERSION } from "@/prompts/analysis";

export interface AnalyzeOutcome {
  analysisId: string;
  version: number;
  status: "COMPLETED" | "FAILED";
  demo: boolean;
  tokensUsed: number;
  stages: StageResult[];
  error?: string;
}

/** Cast a JSON-serializable value to Prisma's Json input, or undefined. */
function asJson(
  value: unknown
): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

/**
 * Run the multi-agent pipeline on an owned paper and persist a new
 * PaperAnalysis version plus its extracted claims, in one transaction.
 */
export async function analyzePaper(
  userId: string,
  paperId: string
): Promise<AnalyzeOutcome> {
  const paper = await getOwnedPaper(paperId, userId); // 404 if not owned
  if (!paper.fullText || paper.fullText.trim().length < 20) {
    throw new NotAnalyzableError();
  }

  const provider = getProvider();
  const run = await runAnalysisPipeline(provider, {
    title: paper.title,
    text: paper.fullText,
  });
  const references = extractReferences(paper.fullText);
  const r = run.report;

  const last = await prisma.paperAnalysis.findFirst({
    where: { paperId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;

  const extras = {
    documentType: r.reader?.documentType ?? null,
    keyPoints: r.reader?.keyPoints ?? [],
    sectionsDetected: r.reader?.sectionsDetected ?? [],
    significance: r.knowledge?.significance ?? null,
    synthesizer: r.synthesizer ?? null,
    stages: run.stages,
    demo: run.demo,
    promptVersion: PROMPT_VERSION,
  };

  const created = await prisma.$transaction(async (tx) => {
    const analysis = await tx.paperAnalysis.create({
      data: {
        paperId,
        version,
        status: run.status,
        summary: r.reader?.summary ?? null,
        researchProblem: r.analyzer?.researchProblem ?? null,
        motivation: r.knowledge?.motivation ?? null,
        methodology: r.analyzer?.methodology ?? null,
        contributions: asJson(r.analyzer?.contributions),
        datasets: asJson(r.analyzer?.datasets),
        results: asJson(r.analyzer?.results),
        metrics: asJson(r.analyzer?.metrics),
        limitations: asJson(r.analyzer?.limitations),
        terminology: asJson(r.terminology?.terms),
        relatedWork: asJson(r.knowledge?.relatedWorkThemes),
        references: references.length ? asJson(references) : undefined,
        followUpQuestions: asJson(r.knowledge?.followUpQuestions),
        modelProvider: provider.name,
        modelName: provider.model,
        tokensUsed: run.usage.totalTokens,
        report: asJson(extras),
        error: run.error ?? null,
      },
    });

    if (run.status === "COMPLETED" && r.analyzer?.claims?.length) {
      await tx.extractedClaim.createMany({
        data: r.analyzer.claims.map((c) => ({
          paperId,
          analysisId: analysis.id,
          type: c.type,
          text: c.text,
          supportingPassage: c.supportingPassage,
        })),
      });
    }

    return analysis;
  });

  return {
    analysisId: created.id,
    version,
    status: run.status,
    demo: run.demo,
    tokensUsed: run.usage.totalTokens,
    stages: run.stages,
    error: run.error,
  };
}
