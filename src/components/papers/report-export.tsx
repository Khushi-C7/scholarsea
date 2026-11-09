"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { InsightReportView } from "@/lib/documents/analysis-view";

export interface ExportPaper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  doi: string | null;
  url: string | null;
}

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "paper";
}

function toMarkdown(paper: ExportPaper, r: InsightReportView): string {
  const L: string[] = [];
  L.push(`# ${paper.title}`, "");
  const meta = [paper.authors.join(", "), paper.year, paper.doi ? `DOI: ${paper.doi}` : ""]
    .filter(Boolean)
    .join(" · ");
  if (meta) L.push(`*${meta}*`, "");
  const sec = (t: string, body: string | string[] | null) => {
    if (!body || (Array.isArray(body) && body.length === 0)) return;
    L.push(`## ${t}`, "");
    if (Array.isArray(body)) body.forEach((b) => L.push(`- ${b}`));
    else L.push(body);
    L.push("");
  };
  sec("Summary", r.summary);
  sec("Key points", r.keyPoints);
  sec("Research problem", r.researchProblem);
  sec("Motivation", r.motivation);
  sec("Contributions", r.contributions);
  sec("Methodology", r.methodology);
  sec("Datasets", r.datasets.map((d) => (d.description ? `${d.name} — ${d.description}` : d.name)));
  sec("Results", r.results);
  sec("Metrics", r.metrics.map((m) => (m.value ? `${m.name}: ${m.value}` : m.name)));
  sec("Limitations", r.limitations);
  if (r.synthesizer) {
    sec("Conclusions", r.synthesizer.conclusions);
    sec(`Evidence confidence (${r.synthesizer.confidence})`, r.synthesizer.confidenceRationale);
  }
  sec("Terminology", r.terminology.map((t) => `**${t.term}**: ${t.definition}`));
  sec("Related work themes", r.relatedWork);
  sec("References", r.references);
  sec("Follow-up questions", r.followUpQuestions);
  if (r.demo) L.push("> Generated in demo mode (heuristic, not an AI model).", "");
  return L.join("\n");
}

function toJson(paper: ExportPaper, r: InsightReportView): string {
  return JSON.stringify({ paper, analysis: r }, null, 2);
}

function toBibtex(paper: ExportPaper): string | null {
  if (!paper.title) return null;
  const key = `${slug(paper.authors[0] ?? paper.title)}${paper.year ?? ""}`;
  const fields: string[] = [`  title = {${paper.title}}`];
  if (paper.authors.length) fields.push(`  author = {${paper.authors.join(" and ")}}`);
  if (paper.year) fields.push(`  year = {${paper.year}}`);
  if (paper.doi) fields.push(`  doi = {${paper.doi}}`);
  if (paper.url) fields.push(`  url = {${paper.url}}`);
  return `@misc{${key},\n${fields.join(",\n")}\n}\n`;
}

export function ReportExport({
  paper,
  report,
}: {
  paper: ExportPaper;
  report: InsightReportView;
}) {
  const base = slug(paper.title);
  const bibtex = toBibtex(paper);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() =>
            triggerDownload(`${base}.md`, toMarkdown(paper, report), "text/markdown")
          }
        >
          Markdown (.md)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            triggerDownload(`${base}.json`, toJson(paper, report), "application/json")
          }
        >
          JSON (.json)
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!bibtex}
          onClick={() =>
            bibtex &&
            triggerDownload(`${base}.bib`, bibtex, "application/x-bibtex")
          }
        >
          BibTeX (.bib)
          {!bibtex ? (
            <span className="ml-auto text-[10px] text-muted-foreground">
              no metadata
            </span>
          ) : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
