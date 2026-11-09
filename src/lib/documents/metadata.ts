/**
 * Metadata extraction. Every extractor returns the same shape and leaves
 * fields null/empty when the source does not support them — we never invent
 * values. Provenance (which source) is tracked by the caller.
 */

export interface PaperMetadata {
  title: string | null;
  authors: string[];
  year: number | null;
  abstract: string | null;
  doi: string | null;
  arxivId: string | null;
}

export function emptyMetadata(): PaperMetadata {
  return {
    title: null,
    authors: [],
    year: null,
    abstract: null,
    doi: null,
    arxivId: null,
  };
}

const CURRENT_YEAR = new Date().getFullYear();

/** Pull the first plausible 4-digit year from a string. */
export function parseYear(value: string | null | undefined): number | null {
  if (!value) return null;
  const matches = value.match(/\b(19|20)\d{2}\b/g);
  if (!matches) return null;
  for (const m of matches) {
    const y = Number(m);
    if (y >= 1900 && y <= CURRENT_YEAR + 1) return y;
  }
  return null;
}

/** First non-empty line, trimmed to a sane length, as a title guess. */
function firstLineTitle(text: string): string | null {
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.length >= 3 && !/^abstract$/i.test(line)) {
      return line.slice(0, 300);
    }
  }
  return null;
}

/** Best-effort abstract: the block following an "Abstract" heading. */
function abstractFromText(text: string): string | null {
  const m = text.match(/\babstract\b[\s:—-]*(.+?)(?:\n\s*\n|\b1\.?\s+introduction\b|\bkeywords\b)/is);
  if (m && m[1]) {
    const a = m[1].replace(/\s+/g, " ").trim();
    if (a.length >= 40) return a.slice(0, 2000);
  }
  return null;
}

/** Metadata from pasted/plain text + an optional user-supplied title. */
export function metadataFromText(
  text: string,
  providedTitle?: string | null
): PaperMetadata {
  const meta = emptyMetadata();
  meta.title = (providedTitle?.trim() || firstLineTitle(text)) ?? null;
  meta.year = parseYear(text.slice(0, 4000));
  meta.abstract = abstractFromText(text);
  return meta;
}

/** Map a PDF info dictionary (plus text fallback) to metadata. */
export function metadataFromPdf(
  info: Record<string, unknown> | null,
  text: string
): PaperMetadata {
  const meta = metadataFromText(text);
  const title = typeof info?.Title === "string" ? info.Title.trim() : "";
  const author = typeof info?.Author === "string" ? info.Author.trim() : "";
  const created =
    typeof info?.CreationDate === "string" ? info.CreationDate : "";
  if (title) meta.title = title.slice(0, 300);
  if (author) {
    meta.authors = author
      .split(/\s*(?:;|,| and )\s*/)
      .map((a) => a.trim())
      .filter(Boolean)
      .slice(0, 50);
  }
  const pdfYear = parseYear(created);
  if (pdfYear) meta.year = pdfYear;
  return meta;
}

// --- HTML ------------------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

interface MetaTags {
  byName: Map<string, string[]>;
  byProperty: Map<string, string[]>;
}

function parseMetaTags(html: string): MetaTags {
  const byName = new Map<string, string[]>();
  const byProperty = new Map<string, string[]>();
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const attr = (tag: string, name: string) => {
    const m = tag.match(
      new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i")
    );
    return m ? decodeEntities(m[2] ?? m[3] ?? "") : null;
  };
  for (const tag of tags) {
    const content = attr(tag, "content");
    if (!content) continue;
    const name = attr(tag, "name");
    const property = attr(tag, "property");
    if (name) {
      const key = name.toLowerCase();
      byName.set(key, [...(byName.get(key) ?? []), content]);
    }
    if (property) {
      const key = property.toLowerCase();
      byProperty.set(key, [...(byProperty.get(key) ?? []), content]);
    }
  }
  return { byName, byProperty };
}

/** Strip HTML to readable text (for storage and hashing). */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function arxivIdFromUrl(url: string): string | null {
  const m = url.match(/arxiv\.org\/(?:abs|pdf)\/([0-9]{4}\.[0-9]{4,5})(v\d+)?/i);
  return m ? m[1] : null;
}

/** Metadata from an HTML page using scholarly citation / DC / OG meta tags. */
export function metadataFromHtml(html: string, url: string): PaperMetadata {
  const meta = emptyMetadata();
  const { byName, byProperty } = parseMetaTags(html);
  const first = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = byName.get(k)?.[0] ?? byProperty.get(k)?.[0];
      if (v) return v;
    }
    return null;
  };

  meta.title =
    first("citation_title", "dc.title") ??
    byProperty.get("og:title")?.[0] ??
    titleTag(html) ??
    null;

  const authors =
    byName.get("citation_author") ??
    byName.get("dc.creator") ??
    byName.get("author") ??
    [];
  meta.authors = authors.map((a) => a.trim()).filter(Boolean).slice(0, 50);

  meta.year = parseYear(
    first(
      "citation_publication_date",
      "citation_date",
      "citation_online_date",
      "dc.date",
      "prism.publicationdate"
    ) ?? ""
  );

  meta.abstract =
    first("citation_abstract", "dc.description", "description") ??
    byProperty.get("og:description")?.[0] ??
    null;

  meta.doi = first("citation_doi", "dc.identifier")?.replace(/^doi:/i, "") ?? null;
  meta.arxivId = arxivIdFromUrl(url);
  return meta;
}

function titleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1].replace(/\s+/g, " ").trim()) : null;
}
