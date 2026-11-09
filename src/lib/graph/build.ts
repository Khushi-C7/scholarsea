import "server-only";

import { prisma } from "@/lib/db/prisma";
import { toInsightReportView } from "@/lib/documents/analysis-view";
import {
  type GraphData,
  type GraphEdge,
  type GraphEdgeKind,
  type GraphNode,
  type GraphNodeType,
  EDGE_LABELS,
  NODE_TYPES,
} from "@/lib/graph/types";
import { matchReference, normalizeText, type MatchablePaper } from "@/lib/graph/match";

/**
 * Build the knowledge graph for one user's library. Owner-scoped: only the
 * caller's papers, analyses, and project tags are read, so one user's graph
 * can never contain another user's data.
 *
 * Every node and every edge is derived from a stored field, and each edge
 * records its `provenance`. No edge is added for visual effect — if the data
 * isn't there, the relationship isn't drawn. A citation edge appears only when
 * a stored reference string resolves to another paper in the same library.
 */
export async function buildGraph(
  userId: string,
  opts: { projectId?: string } = {}
): Promise<GraphData> {
  // Papers in scope (optionally restricted to one owned project).
  const papers = await prisma.paper.findMany({
    where: {
      ownerId: userId,
      ...(opts.projectId
        ? { projectPapers: { some: { projectId: opts.projectId } } }
        : {}),
    },
    select: {
      id: true,
      title: true,
      abstract: true,
      authors: true,
      year: true,
      doi: true,
      arxivId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const paperIds = papers.map((p) => p.id);
  const matchable: MatchablePaper[] = papers.map((p) => ({
    id: p.id,
    title: p.title,
    doi: p.doi,
    arxivId: p.arxivId,
  }));

  // Latest analysis per paper (highest version wins).
  const analyses = paperIds.length
    ? await prisma.paperAnalysis.findMany({
        where: { paperId: { in: paperIds } },
        orderBy: { version: "desc" },
      })
    : [];
  const latestByPaper = new Map<string, (typeof analyses)[number]>();
  for (const a of analyses) {
    if (!latestByPaper.has(a.paperId)) latestByPaper.set(a.paperId, a);
  }

  // Project tags for these papers (owner-scoped via the project).
  const projectPapers = paperIds.length
    ? await prisma.projectPaper.findMany({
        where: {
          paperId: { in: paperIds },
          project: { ownerId: userId },
        },
        select: { paperId: true, tags: true },
      })
    : [];
  const tagsByPaper = new Map<string, Set<string>>();
  for (const pp of projectPapers) {
    const set = tagsByPaper.get(pp.paperId) ?? new Set<string>();
    for (const t of pp.tags) set.add(t);
    tagsByPaper.set(pp.paperId, set);
  }

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const edgeSeen = new Set<string>();

  function addEdge(
    source: string,
    target: string,
    kind: GraphEdgeKind,
    provenance: string
  ) {
    if (source === target) return;
    const id = `${kind}:${source}->${target}`;
    if (edgeSeen.has(id)) return;
    edgeSeen.add(id);
    edges.push({ id, source, target, kind, label: EDGE_LABELS[kind], provenance });
  }

  /** Get or create a deduplicated entity node keyed by normalized label. */
  function entityNode(
    type: Exclude<GraphNodeType, "paper">,
    label: string,
    detail: string | null
  ): string | null {
    const key = normalizeText(label);
    if (!key) return null;
    const id = `${type}:${key}`;
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        type,
        label: label.trim(),
        detail,
        paperId: null,
        meta: {},
        degree: 0,
      });
    } else if (detail && !nodes.get(id)!.detail) {
      nodes.get(id)!.detail = detail;
    }
    return id;
  }

  // Track which concept keys exist as primary terms, so related_concept edges
  // only link concepts that were actually extracted (no leaf clouds).
  const primaryConceptIds = new Set<string>();

  // --- Paper nodes + their entity edges -----------------------------------
  for (const p of papers) {
    const paperNodeId = `paper:${p.id}`;
    nodes.set(paperNodeId, {
      id: paperNodeId,
      type: "paper",
      label: p.title,
      detail: p.abstract,
      paperId: p.id,
      meta: {
        year: p.year,
        doi: p.doi,
        arxivId: p.arxivId,
        authors: p.authors.length,
      },
      degree: 0,
    });

    // Authors — reliable paper metadata.
    for (const author of p.authors) {
      const id = entityNode("author", author, null);
      if (id) addEdge(paperNodeId, id, "authored_by", "paper.authors");
    }

    // Project tags → research topics (explicit user metadata).
    for (const tag of tagsByPaper.get(p.id) ?? []) {
      const id = entityNode("topic", tag, null);
      if (id) addEdge(paperNodeId, id, "tagged_topic", "projectPaper.tags");
    }

    // Analysis-derived nodes (only when an analysis exists).
    const analysis = latestByPaper.get(p.id);
    if (!analysis) continue;
    const view = toInsightReportView(analysis);

    if (view.methodology) {
      const id = entityNode("method", view.methodology, view.methodology);
      if (id) addEdge(paperNodeId, id, "uses_method", "analysis.methodology");
    }

    for (const ds of view.datasets) {
      const id = entityNode("dataset", ds.name, ds.description);
      if (id) addEdge(paperNodeId, id, "uses_dataset", "analysis.datasets");
    }

    for (const term of view.terminology) {
      const id = entityNode("concept", term.term, term.definition);
      if (id) {
        primaryConceptIds.add(id);
        addEdge(paperNodeId, id, "mentions_concept", "analysis.terminology");
      }
    }

    // Citations: a reference becomes an edge only if it resolves to another
    // paper in this library (explicit extraction, never invented).
    for (const ref of view.references) {
      const matchedId = matchReference(ref, matchable, p.id);
      if (matchedId) {
        addEdge(
          paperNodeId,
          `paper:${matchedId}`,
          "cites",
          "analysis.references → matched library paper"
        );
      }
    }
  }

  // --- concept ↔ concept (relatedTerms), both endpoints must be real -------
  for (const p of papers) {
    const analysis = latestByPaper.get(p.id);
    if (!analysis) continue;
    const view = toInsightReportView(analysis);
    for (const term of view.terminology) {
      const srcId = `concept:${normalizeText(term.term)}`;
      if (!primaryConceptIds.has(srcId)) continue;
      for (const rel of term.relatedTerms) {
        const relId = `concept:${normalizeText(rel)}`;
        // One undirected edge per concept pair (order the endpoints).
        if (primaryConceptIds.has(relId) && srcId < relId) {
          addEdge(
            srcId,
            relId,
            "related_concept",
            "analysis.terminology.relatedTerms"
          );
        }
      }
    }
  }

  // Degrees.
  for (const e of edges) {
    const s = nodes.get(e.source);
    const t = nodes.get(e.target);
    if (s) s.degree += 1;
    if (t) t.degree += 1;
  }

  const nodeList = Array.from(nodes.values());
  const counts = Object.fromEntries(
    NODE_TYPES.map((t) => [t, 0])
  ) as Record<GraphNodeType, number>;
  for (const n of nodeList) counts[n.type] += 1;

  return { nodes: nodeList, edges, counts, paperCount: papers.length };
}
