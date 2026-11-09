"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  Loader2,
  TriangleAlert,
  Plus,
  Check,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { ArxivResult } from "@/lib/search/types";

type ImportState = "idle" | "importing" | "imported" | "duplicate";

export function AcademicSearch() {
  const [q, setQ] = React.useState("");
  const [author, setAuthor] = React.useState("");
  const [yearFrom, setYearFrom] = React.useState("");
  const [yearTo, setYearTo] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<ArxivResult[] | null>(null);
  const [total, setTotal] = React.useState(0);
  const [importStates, setImportStates] = React.useState<
    Record<string, { state: ImportState; existingId?: string | null }>
  >({});

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim() && !author.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (author.trim()) params.set("author", author.trim());
      if (yearFrom.trim()) params.set("yearFrom", yearFrom.trim());
      if (yearTo.trim()) params.set("yearTo", yearTo.trim());
      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "Search failed.");
        return;
      }
      setResults(data.results);
      setTotal(data.totalResults ?? data.results.length);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function importResult(r: ArxivResult) {
    setImportStates((s) => ({ ...s, [r.arxivId]: { state: "importing" } }));
    try {
      const res = await fetch("/api/search/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          arxivId: r.arxivId,
          version: r.version,
          title: r.title,
          authors: r.authors,
          year: r.year,
          abstract: r.abstract,
          url: r.url,
          doi: r.doi,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 409) {
        setImportStates((s) => ({
          ...s,
          [r.arxivId]: { state: "duplicate", existingId: data?.existingPaperId },
        }));
        return;
      }
      if (!res.ok) {
        setImportStates((s) => ({ ...s, [r.arxivId]: { state: "idle" } }));
        setError(data?.error?.message ?? "Import failed.");
        return;
      }
      setImportStates((s) => ({
        ...s,
        [r.arxivId]: { state: "imported", existingId: data.paper.id },
      }));
    } catch {
      setImportStates((s) => ({ ...s, [r.arxivId]: { state: "idle" } }));
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={runSearch} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="as-q">Keywords or title</Label>
          <Input
            id="as-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. few-shot plant disease classification"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="as-author">Author</Label>
            <Input
              id="as-author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-from">Year from</Label>
            <Input
              id="as-from"
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
              placeholder="2020"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-to">Year to</Label>
            <Input
              id="as-to"
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
              placeholder="2026"
              inputMode="numeric"
            />
          </div>
        </div>
        <Button type="submit" disabled={loading || (!q.trim() && !author.trim())}>
          {loading ? <Loader2 className="animate-spin" /> : <Search />}
          Search arXiv
        </Button>
        <p className="text-xs text-muted-foreground">
          Results come directly from the arXiv API. Nothing is generated — if
          arXiv can&apos;t be reached, no results are shown.
        </p>
      </form>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-[color:var(--destructive)]"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {results !== null ? (
        results.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            No matching papers on arXiv.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Showing {results.length} of {total} results
            </p>
            <ul className="space-y-3">
              {results.map((r) => {
                const imp = importStates[r.arxivId]?.state ?? "idle";
                const existingId = importStates[r.arxivId]?.existingId;
                return (
                  <li key={r.arxivId} className="rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-medium">{r.title}</h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {[r.authors.slice(0, 4).join(", "), r.year]
                            .filter(Boolean)
                            .join(" · ") || "Authors not listed"}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {imp === "imported" ? (
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/library/${existingId}`}>
                              <Check /> In library
                            </Link>
                          </Button>
                        ) : imp === "duplicate" ? (
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/library/${existingId ?? ""}`}>
                              Already added
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => importResult(r)}
                            disabled={imp === "importing"}
                          >
                            {imp === "importing" ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <Plus />
                            )}
                            Import
                          </Button>
                        )}
                      </div>
                    </div>
                    {r.abstract ? (
                      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                        {r.abstract}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground/70">
                        No abstract provided.
                      </p>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {r.categories.slice(0, 3).map((c) => (
                        <Badge key={c} variant="muted">
                          {c}
                        </Badge>
                      ))}
                      <span className="font-mono">arXiv:{r.arxivId}</span>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        View <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )
      ) : null}
    </div>
  );
}
