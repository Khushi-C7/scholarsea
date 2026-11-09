import "server-only";

import type { Paper, PaperSource, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { LIMITS } from "@/lib/documents/limits";
import {
  contentHashFromBytes,
  contentHashFromText,
} from "@/lib/documents/hash";
import { extractPdf } from "@/lib/documents/pdf";
import {
  validatePdfUpload,
  validateTextInput,
  classifyFetched,
} from "@/lib/documents/validate";
import {
  metadataFromText,
  metadataFromPdf,
  metadataFromHtml,
  htmlToText,
  type PaperMetadata,
} from "@/lib/documents/metadata";
import { safeFetch } from "@/lib/documents/ssrf";
import { DuplicatePaperError } from "@/lib/documents/errors";

export type IngestInput =
  | { source: "PASTED_TEXT"; title?: string | null; text: string }
  | { source: "PDF_UPLOAD"; filename?: string | null; bytes: Buffer }
  | { source: "URL"; url: string };

/** Everything derived from a source before it becomes a Paper row. */
interface Prepared {
  metadata: PaperMetadata;
  fullText: string | null;
  contentHash: string;
  pageCount: number | null;
  url: string | null;
  sourceUrl: string | null;
  source: PaperSource;
  status: "COMPLETED" | "FAILED";
  error: string | null;
  provenance: Record<string, unknown>;
}

const NO_TEXT_ERROR =
  "No readable text could be extracted (the document may be scanned images).";

function fallbackTitleForUrl(url: string): string {
  try {
    const u = new URL(url);
    const tail = u.pathname.split("/").filter(Boolean).pop();
    return tail ? `${u.hostname}/${tail}` : u.hostname;
  } catch {
    return "Untitled page";
  }
}

async function preparePastedText(
  text: string,
  title?: string | null
): Promise<Prepared> {
  validateTextInput(text);
  const metadata = metadataFromText(text, title);
  if (!metadata.title) metadata.title = "Untitled pasted text";
  return {
    metadata,
    fullText: text,
    contentHash: contentHashFromText(text),
    pageCount: null,
    url: null,
    sourceUrl: null,
    source: "PASTED_TEXT",
    status: "COMPLETED",
    error: null,
    provenance: { ingestedVia: "pasted_text" },
  };
}

async function preparePdf(
  bytes: Buffer,
  filename?: string | null,
  origin?: { url: string; sourceUrl: string }
): Promise<Prepared> {
  validatePdfUpload(bytes);
  const contentHash = contentHashFromBytes(bytes);
  const fallbackTitle =
    filename?.replace(/\.pdf$/i, "").trim() ||
    (origin ? fallbackTitleForUrl(origin.url) : "Untitled PDF");

  try {
    const { text, pageCount, info } = await extractPdf(bytes);
    const metadata = metadataFromPdf(info, text);
    if (!metadata.title) metadata.title = fallbackTitle;
    const hasText = text.trim().length >= LIMITS.MIN_TEXT_CHARS;
    return {
      metadata,
      fullText: hasText ? text : null,
      contentHash,
      pageCount: pageCount || null,
      url: origin?.url ?? null,
      sourceUrl: origin?.sourceUrl ?? null,
      source: origin ? "URL" : "PDF_UPLOAD",
      status: hasText ? "COMPLETED" : "FAILED",
      error: hasText ? null : NO_TEXT_ERROR,
      provenance: {
        ingestedVia: origin ? "url_pdf" : "pdf_upload",
        originalFilename: filename ?? null,
        finalUrl: origin?.sourceUrl ?? null,
      },
    };
  } catch {
    // Magic bytes said PDF but parsing failed: keep a FAILED record.
    const metadata = metadataFromText("");
    metadata.title = fallbackTitle;
    return {
      metadata,
      fullText: null,
      contentHash,
      pageCount: null,
      url: origin?.url ?? null,
      sourceUrl: origin?.sourceUrl ?? null,
      source: origin ? "URL" : "PDF_UPLOAD",
      status: "FAILED",
      error: "The PDF could not be parsed.",
      provenance: {
        ingestedVia: origin ? "url_pdf" : "pdf_upload",
        originalFilename: filename ?? null,
      },
    };
  }
}

async function prepareUrl(rawUrl: string): Promise<Prepared> {
  const res = await safeFetch(rawUrl, {
    maxBytes: LIMITS.MAX_FETCH_BYTES,
    timeoutMs: LIMITS.FETCH_TIMEOUT_MS,
    maxRedirects: LIMITS.MAX_REDIRECTS,
    accept: "text/html,application/pdf,*/*",
  });

  if (classifyFetched(res.body, res.contentType) === "pdf") {
    return preparePdf(res.body, null, {
      url: rawUrl,
      sourceUrl: res.finalUrl,
    });
  }

  const html = res.body.toString("utf8");
  const text = htmlToText(html);
  const metadata = metadataFromHtml(html, res.finalUrl);
  if (!metadata.title) metadata.title = fallbackTitleForUrl(res.finalUrl);
  const hasText = text.trim().length >= LIMITS.MIN_TEXT_CHARS;
  return {
    metadata,
    fullText: hasText ? text : null,
    contentHash: contentHashFromText(hasText ? text : res.finalUrl),
    pageCount: null,
    url: res.finalUrl,
    sourceUrl: res.finalUrl,
    source: "URL",
    status: hasText ? "COMPLETED" : "FAILED",
    error: hasText ? null : NO_TEXT_ERROR,
    provenance: { ingestedVia: "url_html", finalUrl: res.finalUrl },
  };
}

async function prepare(input: IngestInput): Promise<Prepared> {
  switch (input.source) {
    case "PASTED_TEXT":
      return preparePastedText(input.text, input.title);
    case "PDF_UPLOAD":
      return preparePdf(input.bytes, input.filename);
    case "URL":
      return prepareUrl(input.url);
  }
}

function isUniqueViolation(err: unknown): err is { code: string; meta?: unknown } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}

/**
 * Ingest one paper for a user. Validates and extracts the source, rejects
 * duplicates (same content, DOI, or arXiv id already in the user's library),
 * and persists a Paper with its extraction status. Pre-flight failures
 * (bad type/size, blocked URL, duplicate) throw; extraction failures on
 * otherwise-valid input are stored as a FAILED record the user can see.
 */
export async function ingestPaper(
  userId: string,
  input: IngestInput
): Promise<Paper> {
  const p = await prepare(input);

  // Explicit duplicate check by content hash (fast path + clear error).
  const existing = await prisma.paper.findFirst({
    where: { ownerId: userId, contentHash: p.contentHash },
    select: { id: true },
  });
  if (existing) throw new DuplicatePaperError(existing.id);

  try {
    return await prisma.paper.create({
      data: {
        ownerId: userId,
        title: p.metadata.title ?? "Untitled document",
        abstract: p.metadata.abstract,
        authors: p.metadata.authors,
        year: p.metadata.year,
        doi: p.metadata.doi,
        arxivId: p.metadata.arxivId,
        url: p.url,
        source: p.source,
        sourceUrl: p.sourceUrl,
        fullText: p.fullText,
        pageCount: p.pageCount,
        contentHash: p.contentHash,
        metadata: p.provenance as Prisma.InputJsonValue,
        extractionStatus: p.status,
        extractionError: p.error,
      },
    });
  } catch (err) {
    // Unique violation on content/doi/arxiv: already in the library.
    if (isUniqueViolation(err)) {
      const dupe = await prisma.paper.findFirst({
        where: {
          ownerId: userId,
          OR: [
            { contentHash: p.contentHash },
            ...(p.metadata.doi ? [{ doi: p.metadata.doi }] : []),
            ...(p.metadata.arxivId ? [{ arxivId: p.metadata.arxivId }] : []),
          ],
        },
        select: { id: true },
      });
      throw new DuplicatePaperError(dupe?.id ?? "");
    }
    throw err;
  }
}
