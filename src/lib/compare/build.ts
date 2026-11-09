import "server-only";

import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/auth/errors";
import { toInsightReportView } from "@/lib/documents/analysis-view";
import {
  COMPARE_DIMENSIONS,
  type DimensionDef,
  type ClaimType,
} from "@/lib/compare/config";
import type {
  ComparePaper,
  CompareRow,
  Comparison,
} from "@/lib/compare/types";

// Re-export shared types/constant so existing server-side imports still resolve.
export { NOT_REPORTED } from "@/lib/compare/types";
export type {
  ComparePaper,
  CompareCell,
  CompareRow,
  Comparison,
} from "@/lib/compare/types";

type ReportView = ReturnType<typeof toInsightReportView>;

/** Pull the values for one dimension from a paper's analysis view. */
function valuesFor(dim: DimensionDef, r: ReportView | null): string[] {
  if (!r) return [];
  switch (dim.key) {
    case "objective":
      return r.researchProblem ? [r.researchProblem] : [];
    case "methodology":
      return r.methodology ? [r.methodology] : [];
    case "architecture":
      // No dedicated column; sourced only from MODEL_ARCHITECTURE claims.
      return [];
    case "datasets":
      return r.datasets.map((d) =>
        d.description ? `${d.name} — ${d.description}` : d.name
      );
    case "metrics":
      return r.metrics.map((m) => (m.value ? `${m.name}: ${m.value}` : m.name));
    case "results":
      return r.results;
    case "limitations":
      return r.limitations;
    case "contributions":
      return r.contributions;
    case "futureWork":
      return r.followUpQuestions;
    default:
      return [];
  }
}

/**
 * Build a comparison matrix for the given papers, owned by the user.
 *
 * Every value comes from the paper's latest stored analysis (or its extracted
 * claims) — nothing is generated here, so nothing can be invented. A dimension
 * a paper does not report yields an empty cell flagged `reported: false`, which
 * the UI/exports render as "Not reported". Claim passages supply source links.
 */
export async function buildComparison(
  userId: string,
  paperIds: string[]
): Promise<Comparison> {
  // Owner-scoped fetch; if any requested paper isn't the user's, it's absent
  // from `papers` and we treat that as a not-found for the whole request.
  const papers = await prisma.paper.findMany({
    where: { id: { in: paperIds }, ownerId: userId },
    select: { id: true, title: true, authors: true, year: true },
  });
  if (papers.length !== paperIds.length) {
    throw new NotFoundError("One or more papers were not found");
  }

  // Preserve the caller's requested order.
  const ordered = paperIds
    .map((id) => papers.find((p) => p.id === id))
    .filter((p): p is (typeof papers)[number] => Boolean(p));

  // Latest analysis per paper (if any).
  const analyses = new Map<string, ReportView>();
  const claimsByPaper = new Map<string, Map<ClaimType, string[]>>();

  for (const p of ordered) {
    const row = await prisma.paperAnalysis.findFirst({
      where: { paperId: p.id },
      orderBy: { version: "desc" },
    });
    if (row) {
      analyses.set(p.id, toInsightReportView(row));
      const claims = await prisma.extractedClaim.findMany({
        where: { analysisId: row.id },
        select: { type: true, supportingPassage: true },
      });
      const byType = new Map<ClaimType, string[]>();
      for (const c of claims) {
        const arr = byType.get(c.type as ClaimType) ?? [];
        arr.push(c.supportingPassage);
        byType.set(c.type as ClaimType, arr);
      }
      claimsByPaper.set(p.id, byType);
    }
  }

  const comparePapers: ComparePaper[] = ordered.map((p) => ({
    paperId: p.id,
    title: p.title,
    authors: p.authors,
    year: p.year,
    analyzed: analyses.has(p.id),
  }));

  const rows: CompareRow[] = COMPARE_DIMENSIONS.map((dim) => ({
    key: dim.key,
    label: dim.label,
    cells: ordered.map((p) => {
      const view = analyses.get(p.id) ?? null;
      const values = valuesFor(dim, view).filter((v) => v && v.trim());
      const sources = dim.claimType
        ? (claimsByPaper.get(p.id)?.get(dim.claimType) ?? [])
        : [];
      return {
        paperId: p.id,
        values,
        sources,
        reported: values.length > 0,
      };
    }),
  }));

  return {
    papers: comparePapers,
    rows,
    generatedAt: new Date().toISOString(),
  };
}
