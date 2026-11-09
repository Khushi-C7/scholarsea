import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { registerUser } from "@/lib/auth/service";
import { ingestPaper } from "@/lib/documents/ingest";
import { DuplicatePaperError, SsrfError } from "@/lib/documents/errors";
import { makePdf } from "../fixtures/make-pdf";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const email = `ingest-${RUN}@example.test`;
let userId = "";

beforeAll(async () => {
  const u = await registerUser({ email, password: "password-123", name: "I" });
  userId = u.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe("pasted text ingestion", () => {
  const text =
    "A Title About Plant Disease\n\nAbstract: This 2023 study evaluates few-shot classification of leaf diseases and reports strong accuracy.";

  it("creates a COMPLETED paper with detected metadata", async () => {
    const paper = await ingestPaper(userId, { source: "PASTED_TEXT", text });
    expect(paper.extractionStatus).toBe("COMPLETED");
    expect(paper.title).toBe("A Title About Plant Disease");
    expect(paper.year).toBe(2023);
    expect(paper.fullText).toContain("leaf diseases");
    expect(paper.ownerId).toBe(userId);
  });

  it("rejects an exact duplicate", async () => {
    await expect(
      ingestPaper(userId, { source: "PASTED_TEXT", text })
    ).rejects.toBeInstanceOf(DuplicatePaperError);
  });

  it("ingests distinct text as a separate COMPLETED paper", async () => {
    const paper = await ingestPaper(userId, {
      source: "PASTED_TEXT",
      title: "Another",
      text: "A completely different abstract with enough length to pass.",
    });
    expect(paper.extractionStatus).toBe("COMPLETED");
  });
});

describe("PDF upload ingestion", () => {
  it("extracts a generated PDF to a COMPLETED paper", async () => {
    const bytes = makePdf("Prototypical Networks for Few-Shot Leaf Disease");
    const paper = await ingestPaper(userId, {
      source: "PDF_UPLOAD",
      filename: "proto.pdf",
      bytes,
    });
    expect(paper.source).toBe("PDF_UPLOAD");
    expect(paper.extractionStatus).toBe("COMPLETED");
    expect(paper.title).toContain("Prototypical Networks");
    expect(paper.pageCount).toBe(1);
  });
});

describe("URL ingestion is SSRF-guarded", () => {
  it("refuses a loopback URL", async () => {
    await expect(
      ingestPaper(userId, { source: "URL", url: "http://127.0.0.1:3000/x" })
    ).rejects.toBeInstanceOf(SsrfError);
  });

  it("refuses the cloud metadata endpoint", async () => {
    await expect(
      ingestPaper(userId, {
        source: "URL",
        url: "http://169.254.169.254/latest/meta-data/",
      })
    ).rejects.toBeInstanceOf(SsrfError);
  });

  it("refuses a file:// URL", async () => {
    await expect(
      ingestPaper(userId, { source: "URL", url: "file:///etc/passwd" })
    ).rejects.toBeInstanceOf(SsrfError);
  });
});
