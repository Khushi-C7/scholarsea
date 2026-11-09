import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getOwnedProject } from "@/lib/auth/guards";
import { getProvider } from "@/lib/ai/provider";
import { completeJson } from "@/lib/ai/complete";
import { buildCorpus } from "@/lib/gaps/corpus";
import { detectPatterns } from "@/lib/gaps/patterns";
import { buildEvidenceMenu, resolveGap } from "@/lib/gaps/gap-resolve";
import { demoGenerateGaps } from "@/core/pipelines/generate-gaps-demo";
import { generatedGapsSchema } from "@/lib/validation/gap-gen";
import { gapGenerationPrompt, GAP_PROMPT_VERSION } from "@/prompts/gaps";

export interface GenerateGapsOutcome {
  analysisId: string;
  status: "COMPLETED" | "FAILED";
  demo: boolean;
  gapCount: number;
  insufficientEvidence: boolean;
  coverageNotes: string | null;
}

function asJson(v: unknown): Prisma.InputJsonValue | undefined {
  return v === null || v === undefined ? undefined : (v as Prisma.InputJsonValue);
}

/**
 * Section E, step 3 — generate candidate research gaps for a project and
 * persist them (ResearchGapAnalysis → ResearchGap → GapEvidence).
 *
 * Integrity:
 * - The model only references evidence by id from a menu built from real
 *   corpus passages; resolveGap discards any id it invents.
 * - verificationStatus is derived from resolved evidence, never from the
 *   model's own confidence.
 * - When evidence is insufficient, no gaps are invented: the analysis records
 *   what is missing in coverageNotes and completes with zero gaps.
 */
export async function generateGaps(
  userId: string,
  projectId: string
): Promise<GenerateGapsOutcome> {
  await getOwnedProject(projectId, userId);

  const corpus = await buildCorpus(userId, projectId);
  const patternResult = detectPatterns(corpus);
  const examinedIds = corpus.papers.map((p) => p.paperId);

  // --- Insufficient evidence: abstain, don't invent. ---
  if (patternResult.insufficientEvidence) {
    const analysis = await prisma.researchGapAnalysis.create({
      data: {
        projectId,
        ownerId: userId,
        status: "COMPLETED",
        paperCount: corpus.papersExamined,
        examinedPaperIds: examinedIds,
        executiveSummary:
          "Insufficient evidence to generate research gaps for this corpus.",
        coverageNotes: patternResult.insufficientReason,
        patterns: asJson([]),
        limitations: patternResult.insufficientReason,
      },
    });
    return {
      analysisId: analysis.id,
      status: "COMPLETED",
      demo: corpus.papersAnalyzed === 0 ? true : false,
      gapCount: 0,
      insufficientEvidence: true,
      coverageNotes: patternResult.insufficientReason,
    };
  }

  const menu = buildEvidenceMenu(patternResult.patterns);
  const provider = getProvider();

  // --- Produce candidate gaps (AI, validated; or deterministic demo). ---
  const { data: generated, demo } = await completeJson({
    provider,
    schema: generatedGapsSchema,
    ...gapGenerationPrompt({
      patterns: patternResult.patterns,
      menu,
      papersExamined: patternResult.papersAnalyzed,
    }),
    demo: () =>
      demoGenerateGaps(patternResult.patterns, menu, patternResult.papersAnalyzed),
  });

  // --- Resolve every gap's evidence ids against the real-corpus menu. ---
  const resolved = generated.gaps.map((g) => resolveGap(g, menu));
  // Keep only gaps with at least one resolvable supporting passage — a gap we
  // cannot tie to a real document is not presented.
  const presentable = resolved.filter((g) => g.evidence.length > 0);

  const coverageNotes = `${corpus.papersAnalyzed} of ${corpus.papersExamined} papers in the project were analyzed and examined for this gap analysis.`;

  const analysis = await prisma.$transaction(async (tx) => {
    const created = await tx.researchGapAnalysis.create({
      data: {
        projectId,
        ownerId: userId,
        status: "COMPLETED",
        paperCount: corpus.papersExamined,
        examinedPaperIds: examinedIds,
        executiveSummary: generated.executiveSummary,
        coverageNotes,
        patterns: asJson(
          patternResult.patterns.map((p) => ({
            type: p.type,
            title: p.title,
            isAbsence: p.isAbsence,
            evidenceScope: p.evidenceScope,
            papersInvolved: p.papersInvolved,
          }))
        ),
        limitations:
          corpus.papersAnalyzed < corpus.papersExamined
            ? `${corpus.papersExamined - corpus.papersAnalyzed} paper(s) in this project are not yet analyzed and did not contribute evidence.`
            : null,
      },
    });

    for (const g of presentable) {
      const gap = await tx.researchGap.create({
        data: {
          analysisId: created.id,
          title: g.title,
          explanation: g.explanation,
          significance: g.significance,
          confidenceRationale: g.confidenceRationale,
          evidenceCoverage: g.evidenceCoverage,
          paperCountExamined: corpus.papersAnalyzed,
          suggestedExperiments: asJson(g.suggestedExperiments),
          researchQuestions: asJson(g.researchQuestions),
          verificationStatus: g.verificationStatus,
          reviewStatus: "NONE",
        },
      });
      if (g.evidence.length > 0) {
        await tx.gapEvidence.createMany({
          data: g.evidence.map((e) => ({
            gapId: gap.id,
            paperId: e.paperId,
            stance: e.stance,
            passage: e.passage,
            verified: e.verified,
          })),
        });
      }
    }
    return created;
  });

  void GAP_PROMPT_VERSION;
  return {
    analysisId: analysis.id,
    status: "COMPLETED",
    demo,
    gapCount: presentable.length,
    insufficientEvidence: false,
    coverageNotes,
  };
}
