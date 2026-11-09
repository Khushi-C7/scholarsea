"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Sparkles, ArrowUpRight } from "lucide-react";

interface Recommendation {
  paperId: string;
  title: string;
  authors: string[];
  year: number | null;
  score: number;
  explanation: string;
}

export function RelatedPapers({ paperId }: { paperId: string }) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [recs, setRecs] = React.useState<Recommendation[]>([]);

  React.useEffect(() => {
    let active = true;
    fetch(`/api/papers/${paperId}/related`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok) {
          setError(data?.error?.message ?? "Could not load recommendations.");
          return;
        }
        setRecs(data.recommendations ?? []);
      })
      .catch(() => {
        if (active) setError("Could not load recommendations.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [paperId]);

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="font-semibold">Related papers</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Suggestions drawn from your own library, with the concrete overlap that
        makes each one relevant.
      </p>

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Finding related papers…
          </div>
        ) : error ? (
          <p className="text-sm text-[color:var(--destructive)]">{error}</p>
        ) : recs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No related papers in your library yet. As you add more papers that
            share terminology with this one, they&apos;ll appear here.
          </p>
        ) : (
          <ul className="space-y-3">
            {recs.map((r) => (
              <li key={r.paperId}>
                <Link
                  href={`/library/${r.paperId}`}
                  className="group block rounded-lg border p-3 transition-colors hover:bg-accent"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium group-hover:underline">
                        {r.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[r.authors.slice(0, 3).join(", "), r.year]
                          .filter(Boolean)
                          .join(" · ") || "Metadata not detected"}
                      </p>
                    </div>
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {r.explanation}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
