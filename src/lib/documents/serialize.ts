import type { Paper } from "@/generated/prisma/client";

/** Fields exposed to clients. Excludes fullText, contentHash, and provenance. */
export const PAPER_SUMMARY_SELECT = {
  id: true,
  title: true,
  authors: true,
  year: true,
  abstract: true,
  venue: true,
  doi: true,
  arxivId: true,
  url: true,
  source: true,
  sourceUrl: true,
  pageCount: true,
  extractionStatus: true,
  extractionError: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PaperSummaryFields = Pick<
  Paper,
  keyof typeof PAPER_SUMMARY_SELECT
> & { fullText?: string | null };

/**
 * Client-safe view of a Paper. Works whether or not `fullText` was selected:
 * when present it reports the real length; when omitted it infers availability
 * from the extraction status (COMPLETED ⇒ text was stored).
 */
export function toPaperSummary(paper: PaperSummaryFields) {
  const hasFullText =
    paper.fullText !== undefined
      ? Boolean(paper.fullText && paper.fullText.length > 0)
      : paper.extractionStatus === "COMPLETED";

  return {
    id: paper.id,
    title: paper.title,
    authors: paper.authors,
    year: paper.year,
    abstract: paper.abstract,
    venue: paper.venue,
    doi: paper.doi,
    arxivId: paper.arxivId,
    url: paper.url,
    source: paper.source,
    sourceUrl: paper.sourceUrl,
    pageCount: paper.pageCount,
    hasFullText,
    extractionStatus: paper.extractionStatus,
    extractionError: paper.extractionError,
    createdAt: paper.createdAt,
    updatedAt: paper.updatedAt,
  };
}

export type PaperSummary = ReturnType<typeof toPaperSummary>;
