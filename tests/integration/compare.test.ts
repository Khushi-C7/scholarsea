import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { registerUser } from "@/lib/auth/service";
import { ingestPaper } from "@/lib/documents/ingest";
import { buildComparison, NOT_REPORTED } from "@/lib/compare/build";
import { NotFoundError } from "@/lib/auth/errors";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const emailA = `cmp-${RUN}-a@example.test`;
const emailB = `cmp-${RUN}-b@example.test`;
let userA = "";
let userB = "";
let paperFull = ""; // has a rich analysis
let paperSparse = ""; // analyzed but missing most fields
let paperNone = ""; // no analysis at all
let paperB = ""; // belongs to user B

beforeAll(async () => {
  userA = (await registerUser({ email: emailA, password: "password-123" })).id;
  userB = (await registerUser({ email: emailB, password: "password-123" })).id;

  paperFull = (
    await ingestPaper(userA, {
      source: "PASTED_TEXT",
      title: "Full Paper",
      text: "Full paper with plenty of text to validate ingestion. 2023.",
    })
  ).id;
  paperSparse = (
    await ingestPaper(userA, {
      source: "PASTED_TEXT",
      title: "Sparse Paper",
      text: "Sparse paper with just enough text to validate ingestion here. 2024.",
    })
  ).id;
  paperNone = (
    await ingestPaper(userA, {
      source: "PASTED_TEXT",
      title: "Unanalyzed Paper",
      text: "This paper is ingested but will not receive any analysis at all here.",
    })
  ).id;
  paperB = (
    await ingestPaper(userB, {
      source: "PASTED_TEXT",
      title: "Other User Paper",
      text: "A paper owned by user B that user A must never see in a comparison.",
    })
  ).id;

  // Rich analysis for paperFull.
  const full = await prisma.paperAnalysis.create({
    data: {
      paperId: paperFull,
      version: 1,
      status: "COMPLETED",
      researchProblem: "Few-shot leaf disease classification",
      methodology: "Prototypical metric learning",
      datasets: [{ name: "PlantVillage", description: "lab images" }],
      metrics: [{ name: "Accuracy", value: "78.4%" }],
      results: ["78.4% 5-way 5-shot"],
      contributions: ["A prototype-based few-shot method"],
      limitations: ["No field evaluation"],
      followUpQuestions: ["How does it do on field imagery?"],
    },
  });
  await prisma.extractedClaim.createMany({
    data: [
      {
        paperId: paperFull,
        analysisId: full.id,
        type: "OBJECTIVE",
        text: "objective",
        supportingPassage: "we address few-shot leaf disease classification",
      },
      {
        paperId: paperFull,
        analysisId: full.id,
        type: "MODEL_ARCHITECTURE",
        text: "arch",
        supportingPassage: "a CNN encoder produces class prototypes",
      },
    ],
  });

  // Sparse analysis: only a research problem; everything else empty.
  await prisma.paperAnalysis.create({
    data: {
      paperId: paperSparse,
      version: 1,
      status: "COMPLETED",
      researchProblem: "Crop disease via meta-learning",
    },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
  await prisma.$disconnect();
});

describe("buildComparison", () => {
  it("builds a matrix with one column per paper and all 9 dimensions", async () => {
    const c = await buildComparison(userA, [paperFull, paperSparse]);
    expect(c.papers.map((p) => p.paperId)).toEqual([paperFull, paperSparse]);
    expect(c.rows).toHaveLength(9);
    expect(c.rows.map((r) => r.key)).toContain("futureWork");
  });

  it("reports values that exist and marks missing ones not reported", async () => {
    const c = await buildComparison(userA, [paperFull, paperSparse]);
    const metrics = c.rows.find((r) => r.key === "metrics")!;
    const [fullCell, sparseCell] = metrics.cells;
    expect(fullCell.reported).toBe(true);
    expect(fullCell.values[0]).toContain("Accuracy");
    // Sparse paper has no metrics → not reported, no invented value.
    expect(sparseCell.reported).toBe(false);
    expect(sparseCell.values).toEqual([]);
  });

  it("source-links a dimension from extracted claim passages", async () => {
    const c = await buildComparison(userA, [paperFull, paperSparse]);
    const objective = c.rows.find((r) => r.key === "objective")!;
    expect(objective.cells[0].sources[0]).toContain("few-shot leaf disease");
    // Architecture has no analysis column, but the claim supplies a source.
    const arch = c.rows.find((r) => r.key === "architecture")!;
    expect(arch.cells[0].sources[0]).toContain("CNN encoder");
  });

  it("treats an unanalyzed paper as all-not-reported", async () => {
    const c = await buildComparison(userA, [paperFull, paperNone]);
    const noneCol = c.rows.map((r) => r.cells[1]);
    expect(noneCol.every((cell) => cell.reported === false)).toBe(true);
    expect(c.papers[1].analyzed).toBe(false);
  });

  it("refuses to compare another user's paper (404, no leakage)", async () => {
    await expect(
      buildComparison(userA, [paperFull, paperB])
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("never emits the NOT_REPORTED sentinel as a real value", async () => {
    const c = await buildComparison(userA, [paperFull, paperSparse]);
    for (const row of c.rows) {
      for (const cell of row.cells) {
        expect(cell.values).not.toContain(NOT_REPORTED);
      }
    }
  });
});
