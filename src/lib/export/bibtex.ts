/**
 * BibTeX export built strictly from stored paper metadata. Every entry maps to
 * a real ingested paper; no field is invented — a field is emitted only when
 * the source row actually has it. Pure and deterministic, so it is unit tested.
 */

export interface ExportablePaper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  doi: string | null;
  arxivId: string | null;
  url: string | null;
  abstract: string | null;
}

/** Escape BibTeX/LaTeX special characters in a field value. */
export function escapeBibtex(s: string): string {
  return s
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function lastName(author: string): string {
  const parts = author.trim().split(/\s+/);
  return parts[parts.length - 1] ?? "";
}

/** Build a cite key like `smith2023deep`, ASCII-only. */
function baseCiteKey(p: ExportablePaper): string {
  const author = p.authors[0] ? lastName(p.authors[0]) : "anon";
  const year = p.year ? String(p.year) : "nd";
  const firstWord =
    p.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .find((w) => w.length > 2) ?? "";
  const key = `${author}${year}${firstWord}`
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
  return key || "ref";
}

/** A reference is exportable if it carries at least a title. */
export function isExportable(p: ExportablePaper): boolean {
  return Boolean(p.title && p.title.trim());
}

/** Render one entry; assumes `isExportable(p)`. */
function entry(p: ExportablePaper, citeKey: string): string {
  const type = p.venue ? "article" : "misc";
  const fields: [string, string][] = [];

  // Preserve title case with double braces.
  fields.push(["title", `{${escapeBibtex(p.title.trim())}}`]);
  if (p.authors.length) {
    fields.push(["author", escapeBibtex(p.authors.join(" and "))]);
  }
  if (p.year) fields.push(["year", String(p.year)]);
  if (p.venue) fields.push(["journal", escapeBibtex(p.venue)]);
  if (p.doi) fields.push(["doi", escapeBibtex(p.doi)]);
  if (p.arxivId) {
    fields.push(["eprint", escapeBibtex(p.arxivId)]);
    fields.push(["archivePrefix", "arXiv"]);
  }
  if (p.url) fields.push(["url", escapeBibtex(p.url)]);

  // Each value is wrapped in {...}; the title value already carries inner
  // braces, so it renders as {{Title}} to preserve its capitalization.
  const body = fields.map(([k, v]) => `  ${k} = {${v}}`).join(",\n");
  return `@${type}{${citeKey},\n${body}\n}`;
}

/** Render a list of papers to a BibTeX document (skips untitled entries). */
export function toBibtex(papers: ExportablePaper[]): string {
  const used = new Map<string, number>();
  const out: string[] = [];
  for (const p of papers) {
    if (!isExportable(p)) continue;
    let key = baseCiteKey(p);
    // Disambiguate collisions with a, b, c…
    const n = used.get(key) ?? 0;
    used.set(key, n + 1);
    if (n > 0) key = `${key}${String.fromCharCode(96 + n)}`;
    out.push(entry(p, key));
  }
  return out.join("\n\n") + (out.length ? "\n" : "");
}
