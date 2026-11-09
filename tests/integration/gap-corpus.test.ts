import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { registerUser } from "@/lib/auth/service";
import { ingestPaper } from "@/lib/documents/ingest";
import { createProject, addPaperToProject } from "@/lib/projects/service";
import { buildCorpus } from "@/lib/gaps/corpus";
import { detectPatterns } from "@/lib/gaps/patterns";
import { NotFoundError } from "@/lib/auth/errors";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const emailA = `gap-${RUN}-a@example.test`;
const emailB = `gap-${RUN}-b@example.test`;
let userA = "";
let userB = "";
let projectId = "";
let p1 = "";
let p2 = "";
let p3none = ""; // in project but never analyzed

beforeAll(async () => {
  userA = (await registerUser({ email: emailA, password: "password-123" })).id;
  userB = (await registerUser({ email: emailB, password: "password-123" })).id;

  p1 = (await ingestPaper(userA, { source: "PASTED_TEXT", title: "Paper One", text: "Paper one text long enough to validate ingestion properly. 2023." })).id;
  p2 = (await ingestPaper(userA, { source: "PASTED_TEXT", title: "Paper Two", text: "Paper two text long enough to validate ingestion properly too. 2024." })).id;
  p3none = (await ingestPaper(userA, { source: "PASTED_TEXT", title: "Paper Three", text: "Paper three ingested but never analyzed at all in this corpus test." })).id;

  // Analysis + claims for p1.
  const a1 = await prisma.paperAnalysis.create({
    data: {
      paperId: p1,
      version: 1,
      status: "COMPLETED",
      researchProblem: "Few-shot leaf disease classification",
      methodology: "Prototypical metric learning",
      datasets: [{ name: "PlantVillage", description: "lab" }],
      results: ["78.4% accuracy on the benchmark"],
      limitations: ["no field-condition robustness evaluation is performed"],
      followUpQuestions: ["evaluate robustness to field conditions"],
    },
  });
  await prisma.extractedClaim.createMany({
    data: [
      { paperId: p1, analysisId: a1.id, type: "LIMITATION", text: "no field eval", supportingPassage: "performance under field conditions is not evaluated" },
      { paperId: p1, analysisId: a1.id, type: "MODEL_ARCHITECTURE", text: "cnn encoder", supportingPassage: "a CNN encoder produces class prototypes" },
    ],
  });

  // Analysis + claims for p2.
  const a2 = await prisma.paperAnalysis.create({
    data: {
      paperId: p2,
      version: 1,
      status: "COMPLETED",
      researchProblem: "Crop disease via meta-learning",
      methodology: "MAML meta-learning",
      datasets: [{ name: "Field crop set", description: "in the wild" }],
      results: ["19-point accuracy drop under field conditions"],
      limitations: ["robustness to field imagery remains limited"],
      followUpQuestions: ["evaluate robustness under field noise"],
    },
  });
  await prisma.extractedClaim.createMany({
    data: [
      { paperId: p2, analysisId: a2.id, type: "LIMITATION", text: "field robustness", supportingPassage: "a 19-point accuracy drop under field conditions" },
    ],
  });

  projectId = (await createProject(userA, { name: `Gap Corpus ${RUN}` })).id;
  await addPaperToProject(userA, projectId, p1);
  await addPaperToProject(userA, projectId, p2);
  await addPaperToProject(userA, projectId, p3none);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
  await prisma.$disconnect();
});

describe("buildCorpus — evidence linking", () => {
  it("collects one entry per project paper and counts analyzed vs examined", async () => {
    const c = await buildCorpus(userA, projectId);
    expect(c.papersExamined).toBe(3);
    expect(c.papersAnalyzed).toBe(2);
    expect(c.papers.find((p) => p.paperId === p3none)!.analyzed).toBe(false);
  });

  it("retains structured fields from each analysis", async () => {
    const c = await buildCorpus(userA, projectId);
    const one = c.papers.find((p) => p.paperId === p1)!;
    expect(one.objectives[0]).toContain("Few-shot");
    expect(one.methods[0]).toContain("Prototypical");
    expect(one.datasets[0]).toContain("PlantVillage");
    expect(one.limitations[0]).toMatch(/field/);
    // Architecture is sourced from the MODEL_ARCHITECTURE claim.
    expect(one.architectures[0]).toContain("cnn");
  });

  it("every retained claim carries its paper id and a supporting passage", async () => {
    const c = await buildCorpus(userA, projectId);
    const corpusPaperIds = new Set(c.papers.map((p) => p.paperId));
    let total = 0;
    for (const paper of c.papers) {
      for (const claim of paper.claims) {
        total += 1;
        // The claim's paperId resolves to a paper actually in the corpus...
        expect(corpusPaperIds.has(claim.paperId)).toBe(true);
        // ...and matches the paper it is nested under.
        expect(claim.paperId).toBe(paper.paperId);
        // ...and has a non-empty verbatim passage.
        expect(claim.supportingPassage.length).toBeGreaterThan(0);
      }
    }
    expect(total).toBe(3); // 2 claims on p1 + 1 on p2
  });

  it("refuses another user's project (404)", async () => {
    await expect(buildCorpus(userB, projectId)).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});

describe("corpus + patterns end to end", () => {
  it("detects patterns whose evidence links to real corpus papers", async () => {
    const c = await buildCorpus(userA, projectId);
    const ids = new Set(c.papers.map((p) => p.paperId));
    const result = detectPatterns(c);

    expect(result.insufficientEvidence).toBe(false);
    expect(result.papersAnalyzed).toBe(2);
    expect(result.patterns.length).toBeGreaterThan(0);

    for (const pat of result.patterns) {
      for (const e of pat.evidence) {
        expect(ids.has(e.paperId)).toBe(true);
      }
      if (pat.isAbsence) {
        expect(pat.absenceCaveat).toMatch(/not proof that no such research exists/i);
      }
    }

    // The shared field/robustness concern should surface in some pattern's
    // evidence (here via recurring future-work and uncompared methods).
    const fieldSurfaces = result.patterns.some((p) =>
      p.evidence.some((e) => /field|robust/i.test(e.passage))
    );
    expect(fieldSurfaces).toBe(true);

    // At least one absence-type pattern, and it is correctly caveated.
    const absence = result.patterns.filter((p) => p.isAbsence);
    expect(absence.length).toBeGreaterThan(0);
  });
});
