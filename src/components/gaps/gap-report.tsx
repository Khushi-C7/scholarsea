"use client";

import { Download, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GapAnalysisView } from "@/lib/gaps/report-types";
import { toGapMarkdown, toGapJson } from "@/lib/gaps/report-export";
import { GapCard } from "@/components/gaps/gap-card";

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function GapReport({ analysis }: { analysis: GapAnalysisView }) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{analysis.papersExamined} papers in corpus</span>
          <span>{analysis.gaps.length} candidate gaps</span>
          <span>
            {new Date(analysis.createdAt).toLocaleDateString("en-US", {
              dateStyle: "medium",
            } as Intl.DateTimeFormatOptions)}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                download("gap-report.md", toGapMarkdown(analysis), "text/markdown")
              }
            >
              Markdown (.md)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                download("gap-report.json", toGapJson(analysis), "application/json")
              }
            >
              JSON (.json)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Executive summary */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div>
            <h2 className="mb-1 text-sm font-semibold">Executive summary</h2>
            <p className="text-sm text-foreground/90">
              {analysis.executiveSummary ?? "Not available."}
            </p>
          </div>
          {analysis.coverageNotes ? (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {analysis.coverageNotes}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Insufficient evidence */}
      {analysis.insufficientEvidence ? (
        <Card className="border-dashed">
          <CardContent className="space-y-1.5 p-6 text-center">
            <h2 className="text-sm font-semibold">Insufficient evidence</h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {analysis.limitations ??
                "The corpus did not contain enough analyzed papers to generate candidate gaps. Add and analyze more papers, then run the analysis again."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Identified patterns */}
          {analysis.patterns.length > 0 ? (
            <div>
              <h2 className="mb-2 text-sm font-semibold">Identified patterns</h2>
              <div className="flex flex-wrap gap-1.5">
                {analysis.patterns.map((p, i) => (
                  <Badge
                    key={i}
                    variant={p.isAbsence ? "warning" : "outline"}
                    title={p.evidenceScope}
                  >
                    {p.title}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {/* Candidate gaps */}
          <div>
            <h2 className="mb-2 text-sm font-semibold">
              Candidate research gaps
            </h2>
            {analysis.gaps.length === 0 ? (
              <div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
                No candidate gaps were supported by verifiable evidence in this
                corpus.
              </div>
            ) : (
              <div className="grid gap-3">
                {analysis.gaps.map((g, i) => (
                  <GapCard key={g.id} gap={g} index={i + 1} />
                ))}
              </div>
            )}
          </div>

          {analysis.limitations ? (
            <Card>
              <CardContent className="p-4">
                <h2 className="mb-1 text-sm font-semibold">
                  Limitations of this analysis
                </h2>
                <p className="text-sm text-muted-foreground">
                  {analysis.limitations}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
