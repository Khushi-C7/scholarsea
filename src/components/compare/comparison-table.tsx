"use client";

import * as React from "react";
import { Quote } from "lucide-react";

import { cn } from "@/lib/utils";
import { NOT_REPORTED, type Comparison } from "@/lib/compare/types";
import { paperShortLabel } from "@/lib/compare/export";

/**
 * The comparison matrix: dimensions down the left, one column per paper.
 * "Not reported" cells are visibly muted so a missing value never reads as an
 * empty-but-present one. Source passages expand under a cell on request.
 */
export function ComparisonTable({ comparison }: { comparison: Comparison }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="sticky left-0 z-10 min-w-36 bg-muted/40 p-3 text-left font-medium">
              Dimension
            </th>
            {comparison.papers.map((p) => (
              <th
                key={p.paperId}
                className="min-w-56 border-l p-3 text-left align-top font-medium"
              >
                <div className="font-semibold">{paperShortLabel(p)}</div>
                <div className="mt-0.5 line-clamp-2 text-xs font-normal text-muted-foreground">
                  {p.title}
                </div>
                {!p.analyzed ? (
                  <div className="mt-1 text-xs font-normal text-[color:var(--warning)]">
                    Not analyzed yet
                  </div>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparison.rows.map((row, i) => (
            <tr
              key={row.key}
              className={cn("border-b align-top", i % 2 === 1 && "bg-muted/20")}
            >
              <th className="sticky left-0 z-10 bg-inherit p-3 text-left font-medium text-muted-foreground">
                {row.label}
              </th>
              {row.cells.map((cell) => (
                <td key={cell.paperId} className="border-l p-3 align-top">
                  {cell.reported ? (
                    <Cell values={cell.values} sources={cell.sources} />
                  ) : (
                    <span className="text-xs italic text-muted-foreground/60">
                      {NOT_REPORTED}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ values, sources }: { values: string[]; sources: string[] }) {
  const [showSources, setShowSources] = React.useState(false);
  return (
    <div className="space-y-1.5">
      {values.length === 1 ? (
        <p className="whitespace-pre-wrap">{values[0]}</p>
      ) : (
        <ul className="space-y-1">
          {values.map((v, i) => (
            <li key={i} className="flex gap-1.5">
              <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-muted-foreground/50" />
              <span className="whitespace-pre-wrap">{v}</span>
            </li>
          ))}
        </ul>
      )}
      {sources.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setShowSources((s) => !s)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Quote className="size-3" />
            {showSources
              ? "Hide source"
              : `Source${sources.length > 1 ? `s (${sources.length})` : ""}`}
          </button>
          {showSources ? (
            <ul className="space-y-1 border-l-2 border-muted pl-2">
              {sources.map((s, i) => (
                <li key={i} className="text-xs italic text-muted-foreground">
                  &ldquo;{s}&rdquo;
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
