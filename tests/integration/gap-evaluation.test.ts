/**
 * Gap evaluation suite (spec section 9).
 *
 * A small curated corpus with known, manually-reviewed properties is ingested,
 * analyzed, and run through gap generation (demo mode = deterministic). The
 * tests then measure the properties the spec calls for:
 *   - cited sources exist (every evidence paper is in the corpus)
 *   - citations map to real stored passages (verbatim, not invented)
 *   - extracted limitations match the originals
 *   - contradictory evidence is surfaced when present
 *   - the system abstains when evidence is insufficient
 *   - proposed gaps carry the required, useful-to-a-reviewer fields
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { registerUser } from "@/lib/auth/service";
import { ingestPaper } from "@/lib/documents/ingest";
import { createProject, addPaperToProject } from "@/lib/projects/service";
import { generateGaps } from "@/core/pipelines/generate-gaps";
import { getGapAnalysisView } from "@/lib/gaps/gap-service";
import { buildCorpus } from "@/lib/gaps/corpus";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const email = `gapeval-${RUN}@example.test`;
let userId = "";

// Curated, manually-authored evidence. These exact limitation/result passages
// are the ground truth the evaluation checks citations against.
const GROUND_TRUTH = {
  p1: {
    title: "Prototypical Few-Shot Leaf Disease",
    limitation: "robustness to field conditions is not evaluated in this work",
    result: "contrastive pretraining improves field accuracy on the benchmark",
    futureWork: "evaluate robustness to field conditions in future work",
  },
  p2: {
    title: "Meta-Learning Crop Disease",
    limitation: "robustness to field conditions is not evaluated in our experiments",
    result: "contrastive pretraining fails to improve field accuracy and degrades it",
    futureWork: "evaluate robustness to field conditions as future work",
  },
};

async function seedAnalyzed(
  owner: string,
  title: string,
  gt: { limitation: string; result: string; futureWork: string }
): Promise<string> {
  const paper = await ingestPaper(owner, {
    source: "PASTED_TEXT",
    title,
    text: `${title}. ${gt.result}. ${gt.limitation}. ${gt.futureWork}. Padded to pass validation.`,
  });
  const analysis = await prisma.paperAnalysis.create({
    data: {
      paperId: paper.id,
      version: 1,
      status: "COMPLETED",
      researchProblem: "Few-shot plant disease classification",
      methodology: "Metric / meta learning",
      datasets: [{ name: "PlantVillage", description: "shared benchmark" }],
      results: [gt.result],
      limitations: [gt.limitation],
      followUpQuestions: [gt.futureWork],
    },
  });
  await prisma.extractedClaim.createMany({
    data: [
      { paperId: paper.id, analysisId: analysis.id, type: "LIMITATION", text: "limitation", supportingPassage: gt.limitation },
      { paperId: paper.id, analysisId: analysis.id, type: "RESULT", text: "result", supportingPassage: gt.result },
    ],
  });
  return paper.id;
}

let projectId = "";
let analysisId = "";

beforeAll(async () => {
  userId = (await registerUser({ email, password: "password-123" })).id;
  const p1 = await seedAnalyzed(userId, GROUND_TRUTH.p1.title, GROUND_TRUTH.p1);
  const p2 = await seedAnalyzed(userId, GROUND_TRUTH.p2.title, GROUND_TRUTH.p2);
  projectId = (await createProject(userId, { name: `Eval ${RUN}` })).id;
  await addPaperToProject(userId, projectId, p1);
  await addPaperToProject(userId, projectId, p2);
  const outcome = await generateGaps(userId, projectId);
  analysisId = outcome.analysisId;
}, 60000);

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe("gap evaluation — citation integrity", () => {
  it("every cited source exists in the corpus", async () => {
    const view = await getGapAnalysisView(userId, analysisId);
    const corpusPaperIds = new Set(
      (
        await prisma.projectPaper.findMany({
          where: { projectId },
          select: { paperId: true },
        })
      ).map((m) => m.paperId)
    );
    let citations = 0;
    for (const g of view.gaps) {
      for (const e of [...g.supporting, ...g.contradicting]) {
        citations += 1;
        expect(corpusPaperIds.has(e.paperId)).toBe(true);
      }
    }
    expect(citations).toBeGreaterThan(0);
  });

  it("every cited passage is verbatim corpus text (not invented)", async () => {
    const view = await getGapAnalysisView(userId, analysisId);
    // The legitimate passage set: everything the corpus actually contains for
    // each paper (structured analysis fields + extracted-claim passages).
    const corpus = await buildCorpus(userId, projectId);
    const legit = new Map<string, Set<string>>();
    for (const p of corpus.papers) {
      const set = new Set<string>([
        ...p.objectives,
        ...p.methods,
        ...p.architectures,
        ...p.datasets,
        ...p.metrics,
        ...p.results,
        ...p.limitations,
        ...p.futureWork,
        ...p.contexts,
        ...p.claims.map((c) => c.supportingPassage),
      ]);
      legit.set(p.paperId, set);
    }
    for (const g of view.gaps) {
      for (const e of [...g.supporting, ...g.contradicting]) {
        expect(legit.get(e.paperId)?.has(e.passage)).toBe(true);
        expect(e.verified).toBe(true);
      }
    }
  });

  it("extracted limitations match the original documents", async () => {
    // The ground-truth limitation passages must appear among cited evidence.
    const view = await getGapAnalysisView(userId, analysisId);
    const cited = view.gaps.flatMap((g) =>
      [...g.supporting, ...g.contradicting].map((e) => e.passage)
    );
    expect(cited).toContain(GROUND_TRUTH.p1.limitation);
    expect(cited).toContain(GROUND_TRUTH.p2.limitation);
  });
});

describe("gap evaluation — contradictory evidence & usefulness", () => {
  it("surfaces contradictory evidence where a conflict exists", async () => {
    // p1 says pretraining improves field accuracy; p2 says it fails/degrades.
    const view = await getGapAnalysisView(userId, analysisId);
    const anyContradiction = view.gaps.some((g) => g.contradicting.length > 0);
    expect(anyContradiction).toBe(true);
  });

  it("each gap carries the reviewer-useful fields", async () => {
    const view = await getGapAnalysisView(userId, analysisId);
    expect(view.gaps.length).toBeGreaterThan(0);
    for (const g of view.gaps) {
      expect(g.title.length).toBeGreaterThan(0);
      expect(g.explanation.length).toBeGreaterThan(0);
      expect(g.significance && g.significance.length).toBeTruthy();
      expect(g.confidenceRationale && g.confidenceRationale.length).toBeTruthy();
      expect(g.suggestedExperiments.length).toBeGreaterThan(0);
      // A presented gap always has at least one verifiable supporting passage.
      expect(g.supporting.length).toBeGreaterThan(0);
    }
  });

  it("confidence rationale references observable evidence, not bare certainty", async () => {
    const view = await getGapAnalysisView(userId, analysisId);
    for (const g of view.gaps) {
      expect(g.confidenceRationale).toMatch(/corpus|paper|evidence|contradic/i);
    }
  });
});

describe("gap evaluation — abstention on insufficient evidence", () => {
  it("generates no gaps and explains what is missing for a 1-paper project", async () => {
    const p = await ingestPaper(userId, {
      source: "PASTED_TEXT",
      title: "Lonely Paper",
      text: "A single analyzed paper is not enough for a cross-paper gap analysis here.",
    });
    await prisma.paperAnalysis.create({
      data: { paperId: p.id, version: 1, status: "COMPLETED", researchProblem: "x" },
    });
    const proj = await createProject(userId, { name: `Thin ${RUN}` });
    await addPaperToProject(userId, proj.id, p.id);

    const outcome = await generateGaps(userId, proj.id);
    expect(outcome.insufficientEvidence).toBe(true);
    expect(outcome.gapCount).toBe(0);

    const view = await getGapAnalysisView(userId, outcome.analysisId);
    expect(view.gaps).toHaveLength(0);
    // It must SAY what's missing rather than invent conclusions.
    expect((view.coverageNotes ?? "") + (view.limitations ?? "")).toMatch(
      /at least two|one analyzed|not enough|insufficient/i
    );
  }, 60000);

  it("abstains with an explanation for an empty project", async () => {
    const proj = await createProject(userId, { name: `Empty ${RUN}` });
    const outcome = await generateGaps(userId, proj.id);
    expect(outcome.insufficientEvidence).toBe(true);
    expect(outcome.gapCount).toBe(0);
    expect(outcome.coverageNotes).toMatch(/no analyzed papers|at least two/i);
  }, 60000);
});
