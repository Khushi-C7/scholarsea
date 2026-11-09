import "server-only";

import { prisma } from "@/lib/db/prisma";
import { getOwnedProject } from "@/lib/auth/guards";
import { toInsightReportView } from "@/lib/documents/analysis-view";
import type {
  EvidenceCorpus,
  CorpusPaper,
  CorpusClaim,
  ClaimType,
} from "@/lib/gaps/types";

/**
 * Step 1 — build the evidence corpus for a project.
 *
 * For every paper in the project, collect structured information from its
 * latest analysis (objectives, methods, architectures, datasets, metrics,
 * results, limitations, future-work, contexts) and retain every extracted
 * claim with its paper identifier and verbatim supporting passage. Nothing is
 * synthesized here — the corpus is exactly what the analyses already contain,
 * so every downstream citation is traceable.
 *
 * Owner-scoped via getOwnedProject (404 if not the user's project).
 */
export async function buildCorpus(
  userId: string,
  projectId: string
): Promise<EvidenceCorpus> {
  await getOwnedProject(projectId, userId);

  const memberships = await prisma.projectPaper.findMany({
    where: { projectId },
    select: {
      paper: { select: { id: true, title: true, year: true } },
    },
    orderBy: { addedAt: "asc" },
  });

  const papers: CorpusPaper[] = [];
  let analyzedCount = 0;

  for (const m of memberships) {
    const p = m.paper;
    const analysis = await prisma.paperAnalysis.findFirst({
      where: { paperId: p.id },
      orderBy: { version: "desc" },
    });

    if (!analysis) {
      papers.push(emptyCorpusPaper(p));
      continue;
    }
    analyzedCount += 1;

    const view = toInsightReportView(analysis);
    const claimRows = await prisma.extractedClaim.findMany({
      where: { analysisId: analysis.id },
      select: {
        type: true,
        text: true,
        supportingPassage: true,
        location: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const claims: CorpusClaim[] = claimRows.map((c) => ({
      paperId: p.id,
      paperTitle: p.title,
      type: c.type as ClaimType,
      text: c.text,
      supportingPassage: c.supportingPassage,
      location:
        c.location && typeof c.location === "object"
          ? (c.location as Record<string, unknown>)
          : null,
    }));

    // Architectures and contexts come from claim types (no dedicated column).
    const architectures = claims
      .filter((c) => c.type === "MODEL_ARCHITECTURE")
      .map((c) => c.text);
    const contexts = claims
      .filter((c) => c.type === "ASSUMPTION" || c.type === "CONTEXT")
      .map((c) => c.text);

    papers.push({
      paperId: p.id,
      title: p.title,
      year: p.year,
      analyzed: true,
      analysisId: analysis.id,
      objectives: view.researchProblem ? [view.researchProblem] : [],
      methods: view.methodology ? [view.methodology] : [],
      architectures,
      datasets: view.datasets.map((d) =>
        d.description ? `${d.name} — ${d.description}` : d.name
      ),
      metrics: view.metrics.map((m) => (m.value ? `${m.name}: ${m.value}` : m.name)),
      results: view.results,
      limitations: view.limitations,
      futureWork: view.followUpQuestions,
      contexts,
      claims,
    });
  }

  return {
    projectId,
    papers,
    papersExamined: papers.length,
    papersAnalyzed: analyzedCount,
    generatedAt: new Date().toISOString(),
  };
}

function emptyCorpusPaper(p: {
  id: string;
  title: string;
  year: number | null;
}): CorpusPaper {
  return {
    paperId: p.id,
    title: p.title,
    year: p.year,
    analyzed: false,
    analysisId: null,
    objectives: [],
    methods: [],
    architectures: [],
    datasets: [],
    metrics: [],
    results: [],
    limitations: [],
    futureWork: [],
    contexts: [],
    claims: [],
  };
}
