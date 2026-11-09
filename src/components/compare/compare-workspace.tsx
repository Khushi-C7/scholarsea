"use client";

import * as React from "react";
import Link from "next/link";
import { Download, GitCompareArrows, Loader2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { COMPARE_MIN, COMPARE_MAX } from "@/lib/compare/config";
import type { Comparison } from "@/lib/compare/types";
import { toMarkdown, toCsv, toJson } from "@/lib/compare/export";
import { ComparisonTable } from "@/components/compare/comparison-table";

export interface PaperOption {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  analyzed: boolean;
}

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

export function CompareWorkspace({
  papers,
  initialSelected = [],
}: {
  papers: PaperOption[];
  initialSelected?: string[];
}) {
  const [selected, setSelected] = React.useState<string[]>(
    initialSelected.slice(0, COMPARE_MAX)
  );
  const [comparison, setComparison] = React.useState<Comparison | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const atMax = selected.length >= COMPARE_MAX;

  function toggle(id: string) {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= COMPARE_MAX) return cur; // enforce upper limit
      return [...cur, id];
    });
    setComparison(null);
  }

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paperIds: selected }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not build the comparison.");
        return;
      }
      setComparison(data.comparison);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (papers.length < COMPARE_MIN) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
          <GitCompareArrows className="size-6" />
        </div>
        <h2 className="text-base font-semibold">Not enough papers</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          You need at least {COMPARE_MIN} papers in your library to compare.
        </p>
        <Button asChild className="mt-5">
          <Link href="/new">Add papers</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Picker */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">
            Select papers{" "}
            <span className="text-muted-foreground">
              ({selected.length}/{COMPARE_MAX})
            </span>
          </p>
          {atMax ? (
            <span className="text-xs text-muted-foreground">
              Maximum {COMPARE_MAX} reached
            </span>
          ) : null}
        </div>
        <ul className="grid max-h-72 gap-1.5 overflow-y-auto rounded-xl border p-2 sm:grid-cols-2">
          {papers.map((p) => {
            const checked = selected.includes(p.id);
            const disabled = !checked && atMax;
            return (
              <li key={p.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors",
                    checked
                      ? "border-primary/50 bg-accent/50"
                      : "hover:bg-accent/40",
                    disabled && "cursor-not-allowed opacity-50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(p.id)}
                    className="mt-0.5 size-4 accent-[color:var(--primary)]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {p.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[p.authors.slice(0, 2).join(", "), p.year]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </span>
                    {!p.analyzed ? (
                      <Badge variant="warning" className="mt-1">
                        Not analyzed
                      </Badge>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={run} disabled={loading || selected.length < COMPARE_MIN}>
          {loading ? <Loader2 className="animate-spin" /> : <GitCompareArrows />}
          Compare {selected.length >= COMPARE_MIN ? `(${selected.length})` : ""}
        </Button>
        {selected.length > 0 && selected.length < COMPARE_MIN ? (
          <span className="text-xs text-muted-foreground">
            Select at least {COMPARE_MIN}.
          </span>
        ) : null}
        {comparison ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  download("comparison.md", toMarkdown(comparison), "text/markdown")
                }
              >
                Markdown (.md)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  download("comparison.csv", toCsv(comparison), "text/csv")
                }
              >
                CSV (.csv)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  download("comparison.json", toJson(comparison), "application/json")
                }
              >
                JSON (.json)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-[color:var(--destructive)]"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {comparison ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Values are drawn from each paper&apos;s latest analysis. Fields a
            paper does not report are marked{" "}
            <span className="italic">Not reported</span> — never guessed.
          </p>
          <ComparisonTable comparison={comparison} />
        </div>
      ) : null}
    </div>
  );
}
