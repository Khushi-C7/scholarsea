import { describe, it, expect, beforeAll } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { registerUser } from "@/lib/auth/service";
import { ingestPaper } from "@/lib/documents/ingest";
import { importArxivPaper } from "@/lib/search/import";
import { recommendRelated } from "@/lib/search/recommend";
import { DuplicatePaperError } from "@/lib/documents/errors";
import { NotFoundError } from "@/lib/auth/errors";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
let userA = "";
let userB = "";

const base = {
  arxivId: `test.${RUN}.1`,
  version: "v1",
  title: "Prototypical Networks for Few-shot Leaf Disease Classification",
  authors: ["Ada Lovelace"],
  year: 2023,
  abstract:
    "We present a prototypical metric-learning approach for few-shot plant leaf disease classification on the PlantVillage dataset.",
  url: "https://arxiv.org/abs/test.1",
  doi: null,
};

beforeAll(async () => {
  userA = (await registerUser({ email: `srch-${RUN}-a@example.test`, password: "password-123" })).id;
  userB = (await registerUser({ email: `srch-${RUN}-b@example.test`, password: "password-123" })).id;
});

describe("importArxivPaper", () => {
  it("imports a real result as an ACADEMIC_SEARCH paper with the abstract as text", async () => {
    const paper = await importArxivPaper(userA, base);
    expect(paper.source).toBe("ACADEMIC_SEARCH");
    expect(paper.arxivId).toBe(base.arxivId);
    expect(paper.fullText).toBe(base.abstract);
    expect(paper.extractionStatus).toBe("COMPLETED");
  });

  it("deduplicates a re-import by arXiv id and points at the existing paper", async () => {
    const existing = await prisma.paper.findFirst({
      where: { ownerId: userA, arxivId: base.arxivId },
      select: { id: true },
    });
    await expect(importArxivPaper(userA, base)).rejects.toMatchObject({
      existingPaperId: existing!.id,
    } satisfies Partial<DuplicatePaperError>);
  });

  it("lets a different user import the same arXiv id (ownership-scoped dedup)", async () => {
    const paper = await importArxivPaper(userB, base);
    expect(paper.arxivId).toBe(base.arxivId);
    expect(paper.ownerId).toBe(userB);
  });

  it("flags an import with no abstract as extraction-failed instead of inventing text", async () => {
    const paper = await importArxivPaper(userA, {
      ...base,
      arxivId: `test.${RUN}.noabs`,
      abstract: null,
    });
    expect(paper.fullText).toBeNull();
    expect(paper.extractionStatus).toBe("FAILED");
    expect(paper.extractionError).toMatch(/no abstract/i);
  });
});

describe("recommendRelated", () => {
  it("ranks papers that share real terms and explains each with those terms", async () => {
    const related = (
      await ingestPaper(userB, {
        source: "PASTED_TEXT",
        title: "Few-shot Plant Leaf Disease Classification with Metric Learning",
        text: "A few-shot metric-learning study of plant leaf disease classification on PlantVillage imagery.",
      })
    ).id;
    const unrelated = (
      await ingestPaper(userB, {
        source: "PASTED_TEXT",
        title: "Quantum Error Correction Thresholds",
        text: "Surface codes and stabilizer measurements for quantum error correction thresholds.",
      })
    ).id;

    const source = await prisma.paper.findFirst({
      where: { ownerId: userB, arxivId: base.arxivId },
      select: { id: true },
    });
    const recs = await recommendRelated(userB, source!.id);

    const ids = recs.map((r) => r.paperId);
    expect(ids).toContain(related);
    expect(ids).not.toContain(unrelated);

    const top = recs.find((r) => r.paperId === related)!;
    expect(top.explanation).toMatch(/shares key terms/i);
    // The named terms must be real terms from the source paper, not fabricated.
    const named = top.explanation
      .replace(/^.*:\s*/, "")
      .replace(/\.$/, "")
      .split(", ");
    expect(named.length).toBeGreaterThanOrEqual(2);
    const sourceText = `${base.title} ${base.abstract}`.toLowerCase();
    for (const term of named) {
      expect(sourceText).toContain(term);
    }
  });

  it("returns 404 for a paper the user does not own", async () => {
    const other = await prisma.paper.findFirst({
      where: { ownerId: userA },
      select: { id: true },
    });
    await expect(recommendRelated(userB, other!.id)).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});
