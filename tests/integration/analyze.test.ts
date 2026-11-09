import { describe, it, expect, beforeAll } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { registerUser } from "@/lib/auth/service";
import { ingestPaper } from "@/lib/documents/ingest";
import { analyzePaper } from "@/core/pipelines/analyze-paper";
import { NotAnalyzableError } from "@/lib/ai/errors";
import { NotFoundError } from "@/lib/auth/errors";

/**
 * Upload-and-analyze integration (section 9). No AI key is configured in the
 * test env, so the pipeline runs in its clearly-labeled demo mode — we assert
 * the real persistence contract (a versioned PaperAnalysis + claims), not any
 * model output.
 */
const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
let userA = "";
let userB = "";
let paperId = "";

const TEXT = `Title: Few-Shot Leaf Disease Classification.
Abstract: We study prototypical metric learning for few-shot plant leaf disease
recognition, evaluating on the PlantVillage dataset and reporting accuracy and
F1. Our method improves over fine-tuning baselines under scarce labels, though
it is limited to a single crop family and leaves cross-domain transfer to
future work.`;

beforeAll(async () => {
  userA = (await registerUser({ email: `an-${RUN}-a@example.test`, password: "password-123" })).id;
  userB = (await registerUser({ email: `an-${RUN}-b@example.test`, password: "password-123" })).id;
  paperId = (
    await ingestPaper(userA, {
      source: "PASTED_TEXT",
      title: "Few-Shot Leaf Disease Classification",
      text: TEXT,
    })
  ).id;
});

describe("analyzePaper", () => {
  it("persists a versioned analysis for an owned paper", async () => {
    const outcome = await analyzePaper(userA, paperId);
    expect(outcome.version).toBe(1);
    expect(outcome.demo).toBe(true); // no key configured in tests
    expect(["COMPLETED", "FAILED"]).toContain(outcome.status);

    const row = await prisma.paperAnalysis.findFirst({
      where: { paperId, version: 1 },
    });
    expect(row).not.toBeNull();
    expect(row!.modelProvider).toBe("demo");
  });

  it("bumps the version on re-analysis rather than overwriting", async () => {
    const outcome = await analyzePaper(userA, paperId);
    expect(outcome.version).toBe(2);
    const count = await prisma.paperAnalysis.count({ where: { paperId } });
    expect(count).toBe(2);
  });

  it("rejects a cross-user paper with a 404 (ownership enforced)", async () => {
    await expect(analyzePaper(userB, paperId)).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it("refuses to analyze a paper with no usable text", async () => {
    const empty = (
      await ingestPaper(userA, {
        source: "PASTED_TEXT",
        title: "Empty-ish",
        text: "short but ingestable text here for the row to exist ok.",
      })
    ).id;
    // Blank out the extracted text to simulate a failed extraction.
    await prisma.paper.update({ where: { id: empty }, data: { fullText: "" } });
    await expect(analyzePaper(userA, empty)).rejects.toBeInstanceOf(
      NotAnalyzableError
    );
  });
});
