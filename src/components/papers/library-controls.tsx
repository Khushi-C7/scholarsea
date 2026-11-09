"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

const SORTS = [
  { value: "recent", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title", label: "Title A–Z" },
  { value: "year_desc", label: "Year ↓" },
  { value: "year_asc", label: "Year ↑" },
];

const STATUSES = [
  { value: "COMPLETED", label: "Ready" },
  { value: "FAILED", label: "Failed" },
];

const SOURCES = [
  { value: "PASTED_TEXT", label: "Pasted" },
  { value: "PDF_UPLOAD", label: "PDF" },
  { value: "URL", label: "URL" },
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "hover:bg-accent"
      )}
    >
      {children}
    </button>
  );
}

/**
 * URL-param-driven library filters. Updating a control pushes new search
 * params; the server page re-queries. Debounced text search.
 */
export function LibraryControls({
  years,
  tags,
}: {
  years: number[];
  tags: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = React.useState(params.get("q") ?? "");

  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
      router.replace(`/library?${next.toString()}`);
    },
    [params, router]
  );

  // Debounce the free-text search.
  React.useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => setParam("q", q || null), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const status = params.get("status");
  const source = params.get("source");
  const year = params.get("year");
  const tag = params.get("tag");
  const bookmarked = params.get("bookmarked");
  const sort = params.get("sort") ?? "recent";

  const hasFilters =
    status || source || year || tag || bookmarked || (params.get("q") ?? "");

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, abstract, or author…"
            aria-label="Search library"
            className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setParam("sort", e.target.value)}
          aria-label="Sort"
          className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip
          active={bookmarked === "1"}
          onClick={() => setParam("bookmarked", bookmarked === "1" ? null : "1")}
        >
          Bookmarked
        </Chip>
        <span className="mx-1 h-4 w-px bg-border" />
        {STATUSES.map((s) => (
          <Chip
            key={s.value}
            active={status === s.value}
            onClick={() => setParam("status", status === s.value ? null : s.value)}
          >
            {s.label}
          </Chip>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        {SOURCES.map((s) => (
          <Chip
            key={s.value}
            active={source === s.value}
            onClick={() => setParam("source", source === s.value ? null : s.value)}
          >
            {s.label}
          </Chip>
        ))}
        {years.length > 0 ? (
          <>
            <span className="mx-1 h-4 w-px bg-border" />
            <select
              value={year ?? ""}
              onChange={(e) => setParam("year", e.target.value || null)}
              aria-label="Year"
              className="h-7 rounded-full border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Any year</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </>
        ) : null}
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Tags:</span>
          {tags.slice(0, 20).map((t) => (
            <Chip
              key={t}
              active={tag === t}
              onClick={() => setParam("tag", tag === t ? null : t)}
            >
              {t}
            </Chip>
          ))}
        </div>
      ) : null}

      {hasFilters ? (
        <button
          type="button"
          onClick={() => router.replace("/library")}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" /> Clear filters
        </button>
      ) : null}
    </div>
  );
}
