import "server-only";

import type { Paper, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { contentHashFromText } from "@/lib/documents/hash";
import { DuplicatePaperError } from "@/lib/documents/errors";
import type { ImportArxivInput } from "@/lib/validation/search";

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2002"
  );
}

/**
 * Import a real arXiv result into the user's library as an ACADEMIC_SEARCH
 * paper. Only metadata + abstract are stored (no full PDF fetch), so the
 * abstract becomes the paper's text when present. Deduplicates by
 * (ownerId, arxivId) and by content hash — a re-import returns the existing
 * paper's id rather than a duplicate.
 */
export async function importArxivPaper(
  userId: string,
  input: ImportArxivInput
): Promise<Paper> {
  // Authorization is enforced at the route boundary; this takes a trusted
  // userId and scopes every query to it.

  // Dedup by arXiv id first (fast, explicit).
  const existingById = await prisma.paper.findFirst({
    where: { ownerId: userId, arxivId: input.arxivId },
    select: { id: true },
  });
  if (existingById) throw new DuplicatePaperError(existingById.id);

  const abstract = input.abstract?.trim() || null;
  const fullText = abstract; // abstract is the only text we have from search
  const contentHash = contentHashFromText(
    abstract || `${input.title} ${input.arxivId}`
  );

  const existingByHash = await prisma.paper.findFirst({
    where: { ownerId: userId, contentHash },
    select: { id: true },
  });
  if (existingByHash) throw new DuplicatePaperError(existingByHash.id);

  const provenance: Prisma.InputJsonValue = {
    ingestedVia: "academic_search",
    provider: "arxiv",
    arxivId: input.arxivId,
    version: input.version ?? null,
  };

  try {
    return await prisma.paper.create({
      data: {
        ownerId: userId,
        title: input.title,
        abstract,
        authors: input.authors,
        year: input.year ?? null,
        doi: input.doi ?? null,
        arxivId: input.arxivId,
        url: input.url ?? `https://arxiv.org/abs/${input.arxivId}`,
        source: "ACADEMIC_SEARCH",
        sourceUrl: input.url ?? `https://arxiv.org/abs/${input.arxivId}`,
        fullText,
        contentHash,
        metadata: provenance,
        // Abstract-only: analyzable when an abstract exists, else flagged.
        extractionStatus: abstract ? "COMPLETED" : "FAILED",
        extractionError: abstract
          ? null
          : "Imported from arXiv with no abstract; only metadata is available.",
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const dupe = await prisma.paper.findFirst({
        where: {
          ownerId: userId,
          OR: [{ arxivId: input.arxivId }, { contentHash }],
        },
        select: { id: true },
      });
      throw new DuplicatePaperError(dupe?.id ?? "");
    }
    throw err;
  }
}
