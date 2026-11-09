/**
 * Markdown and JSON export of paper metadata, built from stored fields only.
 * Pure and deterministic. Companion to `bibtex.ts` for the BibTeX format.
 */

import type { ExportablePaper } from "@/lib/export/bibtex";

/** Escape characters that would break Markdown inline/structure. */
export function escapeMarkdown(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/([*_`[\]()#>|~])/g, "\\$1");
}

function metaLine(p: ExportablePaper): string {
  const bits: string[] = [];
  if (p.authors.length) bits.push(escapeMarkdown(p.authors.join(", ")));
  if (p.year) bits.push(String(p.year));
  if (p.venue) bits.push(escapeMarkdown(p.venue));
  return bits.join(" · ");
}

/** A human-readable Markdown list of papers with a source link per entry. */
export function toMarkdown(papers: ExportablePaper[]): string {
  const L: string[] = ["# Paper export", ""];
  L.push(`_${papers.length} paper${papers.length === 1 ? "" : "s"}._`, "");
  papers.forEach((p, i) => {
    L.push(`## ${i + 1}. ${escapeMarkdown(p.title)}`, "");
    const meta = metaLine(p);
    if (meta) L.push(`*${meta}*`, "");
    if (p.abstract) L.push(escapeMarkdown(p.abstract), "");
    const links: string[] = [];
    if (p.doi) links.push(`DOI: ${escapeMarkdown(p.doi)}`);
    if (p.arxivId) links.push(`arXiv: ${escapeMarkdown(p.arxivId)}`);
    if (p.url) links.push(`[Source](${p.url})`);
    if (links.length) L.push(links.join(" · "), "");
  });
  return L.join("\n");
}

/** Structured JSON of the stored metadata fields. */
export function toJson(papers: ExportablePaper[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      schema: "scholarsea.papers.v1",
      count: papers.length,
      papers,
    },
    null,
    2
  );
}
