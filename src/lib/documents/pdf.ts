import { extractText, getDocumentProxy, getMeta } from "unpdf";

/** True if the bytes begin with the PDF magic marker "%PDF-". */
export function looksLikePdf(bytes: Buffer): boolean {
  return bytes.length >= 5 && bytes.subarray(0, 5).toString("latin1") === "%PDF-";
}

export interface PdfExtraction {
  text: string;
  pageCount: number;
  /** Raw PDF info dictionary (Title, Author, CreationDate, …), if present. */
  info: Record<string, unknown> | null;
}

/**
 * Extract text and metadata from a PDF buffer. Throws if the bytes cannot be
 * parsed as a PDF (the caller turns that into a clear error).
 */
export async function extractPdf(bytes: Buffer): Promise<PdfExtraction> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const [{ totalPages, text }, meta] = await Promise.all([
    extractText(pdf, { mergePages: true }),
    getMeta(pdf).catch(() => ({ info: null, metadata: null })),
  ]);
  const merged = Array.isArray(text) ? text.join("\n") : text;
  return {
    text: merged ?? "",
    pageCount: totalPages ?? 0,
    info: (meta?.info as Record<string, unknown> | null) ?? null,
  };
}
