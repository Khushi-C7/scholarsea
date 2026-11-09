import "server-only";

import { prisma } from "@/lib/db/prisma";
import {
  getOwnedProject,
  getOwnedGapAnalysis,
  getOwnedGap,
} from "@/lib/auth/guards";
import type {
  GapAnalysisView,
  GapView,
  GapEvidenceView,
  PatternSummary,
} from "@/lib/gaps/report-types";
import type { ReviewGapInput } from "@/lib/validation/gaps";

export interface GapAnalysisListItem {
  id: string;
  status: string;
  papersExamined: number;
  gapCount: number;
  createdAt: string;
}

/** List a project's saved gap analyses (owner-scoped). */
export async function listGapAnalyses(
  userId: string,
  projectId: string
): Promise<GapAnalysisListItem[]> {
  await getOwnedProject(projectId, userId);
  const rows = await prisma.researchGapAnalysis.findMany({
    where: { projectId, ownerId: userId },
    select: {
      id: true,
      status: true,
      paperCount: true,
      createdAt: true,
      _count: { select: { gaps: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    papersExamined: r.paperCount,
    gapCount: r._count.gaps,
    createdAt: r.createdAt.toISOString(),
  }));
}

function toEvidenceView(e: {
  id: string;
  paperId: string;
  stance: string;
  passage: string;
  verified: boolean;
  note: string | null;
  paper: { title: string };
}): GapEvidenceView {
  return {
    id: e.id,
    paperId: e.paperId,
    paperTitle: e.paper.title,
    stance: e.stance as GapEvidenceView["stance"],
    passage: e.passage,
    verified: e.verified,
    note: e.note,
  };
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Full view of one gap analysis: patterns, gaps, and source-linked evidence. */
export async function getGapAnalysisView(
  userId: string,
  analysisId: string
): Promise<GapAnalysisView> {
  const analysis = await getOwnedGapAnalysis(analysisId, userId); // 404 if not owned
  const project = await prisma.researchProject.findUnique({
    where: { id: analysis.projectId },
    select: { name: true },
  });

  const gapRows = await prisma.researchGap.findMany({
    where: { analysisId },
    orderBy: { createdAt: "asc" },
    include: {
      evidence: {
        include: { paper: { select: { title: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const gaps: GapView[] = gapRows.map((g) => {
    const ev = g.evidence.map(toEvidenceView);
    return {
      id: g.id,
      title: g.title,
      explanation: g.explanation,
      significance: g.significance,
      confidenceRationale: g.confidenceRationale,
      evidenceCoverage: g.evidenceCoverage,
      verificationStatus: g.verificationStatus as GapView["verificationStatus"],
      reviewStatus: g.reviewStatus as GapView["reviewStatus"],
      reviewerNotes: g.reviewerNotes,
      suggestedExperiments: strArray(g.suggestedExperiments),
      researchQuestions: strArray(g.researchQuestions),
      supporting: ev.filter((e) => e.stance === "SUPPORTING"),
      contradicting: ev.filter((e) => e.stance === "CONTRADICTING"),
    };
  });

  const patterns: PatternSummary[] = Array.isArray(analysis.patterns)
    ? (analysis.patterns as unknown[]).flatMap((p) => {
        if (p && typeof p === "object") {
          const o = p as Record<string, unknown>;
          return [
            {
              type: String(o.type ?? ""),
              title: String(o.title ?? ""),
              isAbsence: o.isAbsence === true,
              evidenceScope: String(o.evidenceScope ?? ""),
              papersInvolved: Number(o.papersInvolved ?? 0),
            },
          ];
        }
        return [];
      })
    : [];

  return {
    id: analysis.id,
    projectId: analysis.projectId,
    projectName: project?.name ?? "Project",
    status: analysis.status,
    papersExamined: analysis.paperCount,
    executiveSummary: analysis.executiveSummary,
    coverageNotes: analysis.coverageNotes,
    limitations: analysis.limitations,
    patterns,
    gaps,
    insufficientEvidence: gaps.length === 0 && patterns.length === 0,
    createdAt: analysis.createdAt.toISOString(),
  };
}

/** Evidence-inspector: mark a candidate gap useful/rejected/… and/or add notes. */
export async function reviewGap(
  userId: string,
  gapId: string,
  input: ReviewGapInput
): Promise<GapView["reviewStatus"]> {
  await getOwnedGap(gapId, userId); // 404 if not owned (via analysis.owner)
  const updated = await prisma.researchGap.update({
    where: { id: gapId },
    data: {
      ...(input.reviewStatus !== undefined
        ? { reviewStatus: input.reviewStatus }
        : {}),
      ...(input.reviewerNotes !== undefined
        ? { reviewerNotes: input.reviewerNotes }
        : {}),
    },
    select: { reviewStatus: true },
  });
  return updated.reviewStatus as GapView["reviewStatus"];
}
