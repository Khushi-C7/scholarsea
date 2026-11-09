/**
 * Knowledge-graph shared types (client-safe). Every node and edge in a
 * GraphData is derived from a stored field — see `provenance` on each edge
 * and the builder in `build.ts`. Nothing here is synthesized to decorate the
 * visualization.
 */

export type GraphNodeType =
  | "paper"
  | "author"
  | "concept"
  | "method"
  | "dataset"
  | "topic";

export const NODE_TYPES: GraphNodeType[] = [
  "paper",
  "author",
  "concept",
  "method",
  "dataset",
  "topic",
];

export type GraphEdgeKind =
  | "authored_by"
  | "uses_dataset"
  | "uses_method"
  | "mentions_concept"
  | "tagged_topic"
  | "cites"
  | "related_concept";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  /** Longer text for the details panel (abstract, definition, description…). */
  detail: string | null;
  /** For paper nodes: the library paper id, so the UI can deep-link. */
  paperId: string | null;
  /** Extra per-type facts shown in the details panel. */
  meta: Record<string, string | number | null>;
  /** Number of edges touching this node (computed). */
  degree: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: GraphEdgeKind;
  /** Human-readable relationship label. */
  label: string;
  /**
   * Exactly where this edge came from, e.g. "paper.authors" or
   * "analysis.references → matched library paper". Shown in the UI so every
   * relationship is auditable back to stored data.
   */
  provenance: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Counts by node type, for the filter legend. */
  counts: Record<GraphNodeType, number>;
  /** How many library papers were considered (incl. isolated ones). */
  paperCount: number;
}

export const EDGE_LABELS: Record<GraphEdgeKind, string> = {
  authored_by: "authored by",
  uses_dataset: "uses dataset",
  uses_method: "uses method",
  mentions_concept: "mentions",
  tagged_topic: "tagged",
  cites: "cites",
  related_concept: "related to",
};
