import type { ArxivResult, SearchResponse } from "@/lib/search/types";

/**
 * Parse the arXiv Atom feed into structured results. Pure (no network), so it
 * is unit-tested against fixture XML.
 *
 * It only ever emits entries that are actually present in the feed — nothing
 * is synthesized. Missing fields become null/empty rather than invented
 * values, and an entry with no usable id or title is skipped.
 */

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

function tagText(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decodeEntities(m[1].replace(/\s+/g, " ").trim()) : null;
}

function parseEntry(entryXml: string): ArxivResult | null {
  const rawId = tagText(entryXml, "id");
  if (!rawId) return null;
  // id looks like http://arxiv.org/abs/2305.01234v2
  const idMatch = rawId.match(/arxiv\.org\/abs\/(.+?)(v(\d+))?$/i);
  const fullId = idMatch ? idMatch[1] : rawId;
  const version = idMatch && idMatch[3] ? `v${idMatch[3]}` : null;

  const title = tagText(entryXml, "title");
  if (!fullId || !title) return null; // skip unusable entries

  // Authors: <author><name>…</name></author>
  const authors: string[] = [];
  const authorRe = /<author\b[^>]*>([\s\S]*?)<\/author>/gi;
  let a: RegExpExecArray | null;
  while ((a = authorRe.exec(entryXml))) {
    const name = tagText(a[1], "name");
    if (name) authors.push(name);
  }

  const abstract = tagText(entryXml, "summary");
  const published = tagText(entryXml, "published");
  const year = published ? Number(published.slice(0, 4)) || null : null;

  // Categories: <category term="cs.CV"/>
  const categories = Array.from(
    entryXml.matchAll(/<category\b[^>]*\bterm="([^"]+)"/gi)
  ).map((m) => m[1]);

  // Links: alternate (abstract page) and title="pdf".
  let pdfUrl: string | null = null;
  let abstractUrl: string | null = null;
  for (const m of entryXml.matchAll(/<link\b([^>]*)\/?>/gi)) {
    const attrs = m[1];
    const href = attrs.match(/\bhref="([^"]+)"/i)?.[1] ?? null;
    if (!href) continue;
    if (/\btitle="pdf"/i.test(attrs)) pdfUrl = href;
    if (/\brel="alternate"/i.test(attrs)) abstractUrl = href;
  }

  const doi = tagText(entryXml, "arxiv:doi");

  return {
    arxivId: fullId,
    version,
    title,
    authors,
    year,
    published,
    abstract,
    categories,
    url: abstractUrl ?? `https://arxiv.org/abs/${fullId}`,
    pdfUrl,
    doi,
  };
}

export function parseArxivFeed(xml: string): SearchResponse {
  const total = Number(tagText(xml, "opensearch:totalResults") ?? "0") || 0;
  const start = Number(tagText(xml, "opensearch:startIndex") ?? "0") || 0;

  const results: ArxivResult[] = [];
  const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml))) {
    const parsed = parseEntry(m[1]);
    if (parsed) results.push(parsed);
  }
  return { results, totalResults: total || results.length, start };
}

export { decodeEntities };
