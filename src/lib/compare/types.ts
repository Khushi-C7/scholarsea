/**
 * Shared comparison types and constants — safe to import from both server and
 * client code (no `server-only`, no DB). The builder in build.ts produces
 * these; the table and export modules consume them.
 */

/** Sentinel shown wherever a paper does not report a dimension. */
export const NOT_REPORTED = "Not reported";

/** One paper column header in the comparison. */
export interface ComparePaper {
  paperId: string;
  title: string;
  authors: string[];
  year: number | null;
  /** True when the paper has at least one analysis to compare from. */
  analyzed: boolean;
}

/** A single cell: either reported values (with optional source passages) or not. */
export interface CompareCell {
  paperId: string;
  /** Reported values for this dimension; empty array ⇒ not reported. */
  values: string[];
  /** Verbatim source passages from the paper backing this dimension. */
  sources: string[];
  reported: boolean;
}

export interface CompareRow {
  key: string;
  label: string;
  cells: CompareCell[];
}

export interface Comparison {
  papers: ComparePaper[];
  rows: CompareRow[];
  generatedAt: string;
}
