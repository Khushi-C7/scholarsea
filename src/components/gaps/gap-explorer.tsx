"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Telescope, Loader2, TriangleAlert, Info, Sparkles, FileSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { EvidenceCorpus } from "@/lib/gaps/types";
import type { PatternResult } from "@/lib/gaps/patterns";
import { PatternCard } from "@/components/gaps/pattern-card";

interface SavedAnalysis {
  id: string;
  papersExamined: number;
  gapCount: number;
  createdAt: string;
}

export interface ProjectOption {
  id: string;
  name: string;
  paperCount: number;
}

export function GapExplorer({
  projects,
  initialProjectId,
}: {
  projects: ProjectOption[];
  initialProjectId?: string;
}) {
  const [projectId, setProjectId] = React.useState(
    initialProjectId && projects.some((p) => p.id === initialProjectId)
      ? initialProjectId
      : (projects[0]?.id ?? "")
  );
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [corpus, setCorpus] = React.useState<EvidenceCorpus | null>(null);
  const [result, setResult] = React.useState<PatternResult | null>(null);
  const [saved, setSaved] = React.useState<SavedAnalysis[]>([]);

  const loadSaved = React.useCallback(async (pid: string) => {
    try {
      const res = await fetch(`/api/gaps/analyses?projectId=${pid}`);
      const data = await res.json().catch(() => null);
      return res.ok ? ((data.analyses ?? []) as SavedAnalysis[]) : [];
    } catch {
      return [] as SavedAnalysis[];
    }
  }, []);

  React.useEffect(() => {
    if (!projectId) return;
    let active = true;
    void loadSaved(projectId).then((rows) => {
      if (active) setSaved(rows);
    });
    return () => {
      active = false;
    };
  }, [projectId, loadSaved]);

  async function run() {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    setCorpus(null);
    setResult(null);
    try {
      const res = await fetch("/api/gaps/corpus", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not build the evidence corpus.");
        return;
      }
      setCorpus(data.corpus);
      setResult(data.patterns);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    if (!projectId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/gaps/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not generate candidate gaps.");
        return;
      }
      router.push(`/gaps/${data.analysisId}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
          <Telescope className="size-6" />
        </div>
        <h2 className="text-base font-semibold">No projects yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Create a project and add analyzed papers to it, then explore gaps
          across that corpus.
        </p>
        <Button asChild className="mt-5">
          <Link href="/projects">Go to projects</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label htmlFor="gap-project" className="text-sm font-medium">
            Project corpus
          </label>
          <select
            id="gap-project"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setCorpus(null);
              setResult(null);
              // The effect keyed on projectId reloads the saved list.
            }}
            className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.paperCount} papers)
              </option>
            ))}
          </select>
        </div>
        <Button onClick={run} disabled={loading || !projectId}>
          {loading ? <Loader2 className="animate-spin" /> : <Telescope />}
          Build corpus &amp; find patterns
        </Button>
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

      {saved.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Saved gap analyses
          </h2>
          <ul className="space-y-1.5">
            {saved.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/gaps/${s.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3.5 py-2.5 transition-colors hover:border-primary/40"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <FileSearch className="size-4 text-primary" />
                    {s.gapCount} candidate gap{s.gapCount === 1 ? "" : "s"}
                    <span className="text-muted-foreground">
                      · {s.papersExamined} papers
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {corpus && result ? (
        <div className="space-y-4">
          {/* Corpus summary */}
          <Card>
            <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
              <div>
                <span className="text-2xl font-semibold tabular-nums">
                  {corpus.papersExamined}
                </span>{" "}
                <span className="text-muted-foreground">papers in corpus</span>
              </div>
              <div>
                <span className="text-2xl font-semibold tabular-nums">
                  {corpus.papersAnalyzed}
                </span>{" "}
                <span className="text-muted-foreground">analyzed</span>
              </div>
              <div>
                <span className="text-2xl font-semibold tabular-nums">
                  {corpus.papers.reduce((n, p) => n + p.claims.length, 0)}
                </span>{" "}
                <span className="text-muted-foreground">source-linked claims</span>
              </div>
            </CardContent>
          </Card>

          {corpus.papersAnalyzed < corpus.papersExamined ? (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {corpus.papersExamined - corpus.papersAnalyzed} paper(s) in this
              project have no analysis yet and contribute no evidence. Analyze
              them to widen the corpus.
            </p>
          ) : null}

          {/* Patterns, or an honest insufficient-evidence state */}
          {result.insufficientEvidence ? (
            <div className="rounded-xl border border-dashed px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                {result.insufficientReason}
              </p>
            </div>
          ) : result.patterns.length === 0 ? (
            <div className="rounded-xl border border-dashed px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No cross-paper patterns stood out across{" "}
                {result.papersAnalyzed} analyzed papers. This is an absence of
                detected patterns in this corpus — not evidence that none exist.
                Adding more analyzed papers may surface patterns.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium">
                  {result.patterns.length} candidate pattern
                  {result.patterns.length === 1 ? "" : "s"}
                  <span className="ml-1 font-normal text-muted-foreground">
                    across {result.papersAnalyzed} analyzed papers
                  </span>
                </h2>
                <Button size="sm" onClick={generate} disabled={generating}>
                  {generating ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Sparkles />
                  )}
                  Generate candidate gaps
                </Button>
              </div>
              <div className="grid gap-3">
                {result.patterns.map((p, i) => (
                  <PatternCard key={i} pattern={p} />
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
