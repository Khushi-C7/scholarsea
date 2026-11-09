import { NOT_REPORTED, type Comparison } from "@/lib/compare/types";

/** A short column label for each paper (first author + year, else title). */
export function paperShortLabel(p: Comparison["papers"][number]): string {
  const author = p.authors[0]?.split(/\s+/).slice(-1)[0];
  if (author && p.year) return `${author} ${p.year}`;
  if (author) return author;
  return p.title.slice(0, 30);
}

function cellText(values: string[]): string {
  return values.length > 0 ? values.join("; ") : NOT_REPORTED;
}

/** Markdown table: dimensions as rows, papers as columns. */
export function toMarkdown(c: Comparison): string {
  const headers = ["Dimension", ...c.papers.map(paperShortLabel)];
  const sep = headers.map(() => "---");
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${sep.join(" | ")} |`,
  ];
  for (const row of c.rows) {
    const cells = row.cells.map((cell) =>
      cellText(cell.values).replace(/\|/g, "\\|").replace(/\n/g, " ")
    );
    lines.push(`| ${row.label} | ${cells.join(" | ")} |`);
  }
  lines.push("");
  lines.push("Papers:");
  for (const p of c.papers) {
    lines.push(
      `- **${paperShortLabel(p)}** — ${p.title}${
        p.authors.length ? ` (${p.authors.join(", ")})` : ""
      }`
    );
  }
  return lines.join("\n");
}

/** CSV with a header row; dimensions as rows, papers as columns. */
export function toCsv(c: Comparison): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = ["Dimension", ...c.papers.map((p) => `${paperShortLabel(p)} — ${p.title}`)];
  const rows = [header.map(esc).join(",")];
  for (const row of c.rows) {
    const cells = [row.label, ...row.cells.map((cell) => cellText(cell.values))];
    rows.push(cells.map(esc).join(","));
  }
  return rows.join("\r\n");
}

/** Structured JSON, including source passages and the not-reported flags. */
export function toJson(c: Comparison): string {
  return JSON.stringify(c, null, 2);
}
