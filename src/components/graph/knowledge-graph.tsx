"use client";

import "@xyflow/react/dist/style.css";

import * as React from "react";
import Link from "next/link";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import { Loader2, Search, X, ExternalLink, Share2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  type GraphData,
  type GraphNode,
  type GraphNodeType,
  NODE_TYPES,
} from "@/lib/graph/types";

/** Per-type presentation. Classes are full literals so Tailwind keeps them. */
const TYPE_STYLE: Record<
  GraphNodeType,
  { label: string; dot: string; chip: string; node: string }
> = {
  paper: {
    label: "Paper",
    dot: "bg-indigo-500",
    chip: "border-indigo-400 text-indigo-700 dark:text-indigo-300",
    node: "border-indigo-400 bg-indigo-50 text-indigo-900 dark:border-indigo-500/60 dark:bg-indigo-950/70 dark:text-indigo-100",
  },
  author: {
    label: "Author",
    dot: "bg-violet-500",
    chip: "border-violet-400 text-violet-700 dark:text-violet-300",
    node: "border-violet-400 bg-violet-50 text-violet-900 dark:border-violet-500/60 dark:bg-violet-950/70 dark:text-violet-100",
  },
  concept: {
    label: "Concept",
    dot: "bg-amber-500",
    chip: "border-amber-400 text-amber-700 dark:text-amber-300",
    node: "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-500/60 dark:bg-amber-950/70 dark:text-amber-100",
  },
  method: {
    label: "Method",
    dot: "bg-emerald-500",
    chip: "border-emerald-400 text-emerald-700 dark:text-emerald-300",
    node: "border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-500/60 dark:bg-emerald-950/70 dark:text-emerald-100",
  },
  dataset: {
    label: "Dataset",
    dot: "bg-sky-500",
    chip: "border-sky-400 text-sky-700 dark:text-sky-300",
    node: "border-sky-400 bg-sky-50 text-sky-900 dark:border-sky-500/60 dark:bg-sky-950/70 dark:text-sky-100",
  },
  topic: {
    label: "Topic",
    dot: "bg-rose-500",
    chip: "border-rose-400 text-rose-700 dark:text-rose-300",
    node: "border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-500/60 dark:bg-rose-950/70 dark:text-rose-100",
  },
};

interface NodeData extends Record<string, unknown> {
  g: GraphNode;
  dimmed: boolean;
  matched: boolean;
}

/** Custom node: a rounded chip sized a little by degree. Handles are centered
 *  and invisible so edges run node-center to node-center. */
function EntityNode({ data }: NodeProps<Node<NodeData>>) {
  const { g, dimmed, matched } = data;
  const s = TYPE_STYLE[g.type];
  const big = g.type === "paper" || g.degree >= 4;
  return (
    <div
      className={[
        "rounded-full border px-3 py-1.5 text-center shadow-sm transition-opacity",
        s.node,
        big ? "text-[11px] font-semibold" : "text-[10px] font-medium",
        dimmed ? "opacity-20" : "opacity-100",
        matched ? "ring-2 ring-offset-1 ring-foreground" : "",
      ].join(" ")}
      style={{ maxWidth: big ? 190 : 150 }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, left: "50%", top: "50%" }}
        isConnectable={false}
      />
      <span className="line-clamp-2 leading-tight">{g.label}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, left: "50%", top: "50%" }}
        isConnectable={false}
      />
    </div>
  );
}

const nodeTypes = { entity: EntityNode };

/** Deterministic force layout — no extra deps. Seeds nodes on a circle, then
 *  relaxes with pairwise repulsion + edge springs. Runs once per dataset. */
function computeLayout(data: GraphData): Map<string, { x: number; y: number }> {
  const n = data.nodes.length;
  const pos = new Map<string, { x: number; y: number; vx: number; vy: number }>();
  const R = Math.max(300, n * 22);
  data.nodes.forEach((node, i) => {
    const a = (2 * Math.PI * i) / Math.max(1, n);
    pos.set(node.id, { x: Math.cos(a) * R, y: Math.sin(a) * R, vx: 0, vy: 0 });
  });
  if (n <= 1) {
    const out = new Map<string, { x: number; y: number }>();
    for (const [k, v] of pos) out.set(k, { x: v.x, y: v.y });
    return out;
  }

  const ids = data.nodes.map((d) => d.id);
  const idealLen = 140;
  const repulsion = 9000;
  const iterations = 320;

  for (let it = 0; it < iterations; it++) {
    const cooling = 1 - it / iterations;
    // Repulsion (all pairs).
    for (let i = 0; i < ids.length; i++) {
      const a = pos.get(ids[i])!;
      for (let j = i + 1; j < ids.length; j++) {
        const b = pos.get(ids[j])!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          dx = (Math.random() - 0.5) * 0.1;
          dy = (Math.random() - 0.5) * 0.1;
          d2 = 0.01;
        }
        const f = repulsion / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }
    // Springs (edges).
    for (const e of data.edges) {
      const a = pos.get(e.source);
      const b = pos.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (d - idealLen) * 0.02;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
    // Integrate + gentle centering pull.
    for (const id of ids) {
      const p = pos.get(id)!;
      p.vx -= p.x * 0.002;
      p.vy -= p.y * 0.002;
      p.x += Math.max(-30, Math.min(30, p.vx)) * cooling;
      p.y += Math.max(-30, Math.min(30, p.vy)) * cooling;
      p.vx *= 0.85;
      p.vy *= 0.85;
    }
  }

  const out = new Map<string, { x: number; y: number }>();
  for (const [k, v] of pos) out.set(k, { x: v.x, y: v.y });
  return out;
}

function GraphCanvas({ data }: { data: GraphData }) {
  const rf = useReactFlow();
  const [active, setActive] = React.useState<Set<GraphNodeType>>(
    () => new Set(NODE_TYPES)
  );
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const layout = React.useMemo(() => computeLayout(data), [data]);
  const nodeById = React.useMemo(
    () => new Map(data.nodes.map((n) => [n.id, n])),
    [data]
  );

  const q = query.trim().toLowerCase();
  const matchedIds = React.useMemo(() => {
    if (!q) return new Set<string>();
    return new Set(
      data.nodes.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.id)
    );
  }, [q, data]);

  const visibleNodeIds = React.useMemo(() => {
    return new Set(
      data.nodes.filter((n) => active.has(n.type)).map((n) => n.id)
    );
  }, [active, data]);

  const rfNodes: Node<NodeData>[] = React.useMemo(() => {
    return data.nodes
      .filter((n) => visibleNodeIds.has(n.id))
      .map((n) => ({
        id: n.id,
        type: "entity",
        position: layout.get(n.id) ?? { x: 0, y: 0 },
        data: {
          g: n,
          dimmed: q.length > 0 && !matchedIds.has(n.id),
          matched: matchedIds.has(n.id),
        },
        selected: n.id === selectedId,
      }));
  }, [data, layout, visibleNodeIds, q, matchedIds, selectedId]);

  const rfEdges: Edge[] = React.useMemo(() => {
    return data.edges
      .filter(
        (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
      )
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.kind === "cites" ? "default" : "straight",
        animated: e.kind === "cites",
        style: {
          stroke:
            e.kind === "cites" ? "var(--primary)" : "var(--border)",
          strokeWidth: e.kind === "cites" ? 2 : 1.2,
        },
      }));
  }, [data, visibleNodeIds]);

  const selected = selectedId ? nodeById.get(selectedId) ?? null : null;

  // Edges incident to the selected node, for the details panel.
  const selectedEdges = React.useMemo(() => {
    if (!selectedId) return [];
    return data.edges
      .filter((e) => e.source === selectedId || e.target === selectedId)
      .map((e) => {
        const otherId = e.source === selectedId ? e.target : e.source;
        return { edge: e, other: nodeById.get(otherId) ?? null };
      })
      .filter((x) => x.other !== null);
  }, [selectedId, data, nodeById]);

  const onNodeClick = React.useCallback(
    (_: React.MouseEvent, node: Node) => setSelectedId(node.id),
    []
  );

  function toggleType(t: GraphNodeType) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function focusMatches() {
    const pts = data.nodes
      .filter((n) => matchedIds.has(n.id) && visibleNodeIds.has(n.id))
      .map((n) => layout.get(n.id))
      .filter((p): p is { x: number; y: number } => Boolean(p));
    if (pts.length === 0) return;
    const avg = pts.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 }
    );
    rf.setCenter(avg.x / pts.length, avg.y / pts.length, {
      zoom: 1.1,
      duration: 500,
    });
  }

  return (
    <div className="relative h-[calc(100vh-13rem)] min-h-[520px] w-full overflow-hidden rounded-xl border bg-card">
      {/* Controls bar */}
      <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") focusMatches();
            }}
            placeholder="Search nodes…"
            className="h-9 w-48 bg-background/90 pl-8 backdrop-blur"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        {NODE_TYPES.map((t) => {
          const s = TYPE_STYLE[t];
          const on = active.has(t);
          return (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={[
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs backdrop-blur transition-colors",
                on
                  ? "bg-background/90 " + s.chip
                  : "border-transparent bg-muted/60 text-muted-foreground line-through",
              ].join(" ")}
            >
              <span className={["size-2 rounded-full", s.dot].join(" ")} />
              {s.label}
              <span className="tabular-nums opacity-70">{data.counts[t]}</span>
            </button>
          );
        })}
      </div>

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={() => setSelectedId(null)}
        fitView
        minZoom={0.15}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} className="opacity-60" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeStrokeWidth={2}
          className="!bg-background/80"
          nodeColor={(node) => {
            const g = (node.data as NodeData | undefined)?.g;
            if (!g) return "var(--muted)";
            return (
              {
                paper: "#6366f1",
                author: "#8b5cf6",
                concept: "#f59e0b",
                method: "#10b981",
                dataset: "#0ea5e9",
                topic: "#f43f5e",
              } as Record<GraphNodeType, string>
            )[g.type];
          }}
        />
      </ReactFlow>

      {/* Details panel */}
      {selected ? (
        <div className="absolute right-3 top-3 z-10 max-h-[calc(100%-1.5rem)] w-80 overflow-auto rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
                  TYPE_STYLE[selected.type].chip,
                ].join(" ")}
              >
                <span
                  className={[
                    "size-2 rounded-full",
                    TYPE_STYLE[selected.type].dot,
                  ].join(" ")}
                />
                {TYPE_STYLE[selected.type].label}
              </span>
              <h3 className="mt-2 text-sm font-semibold leading-snug">
                {selected.label}
              </h3>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          {selected.detail ? (
            <p className="mt-2 line-clamp-6 text-xs leading-relaxed text-muted-foreground">
              {selected.detail}
            </p>
          ) : null}

          {selected.paperId ? (
            <Button asChild size="sm" variant="outline" className="mt-3 w-full">
              <Link href={`/library/${selected.paperId}`}>
                Open paper <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          ) : null}

          <div className="mt-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Relationships ({selectedEdges.length})
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {selectedEdges.map(({ edge, other }) => (
                <li key={edge.id} className="text-xs">
                  <button
                    className="text-left hover:underline"
                    onClick={() => setSelectedId(other!.id)}
                  >
                    <span className="text-muted-foreground">{edge.label} </span>
                    <span className="font-medium">{other!.label}</span>
                  </button>
                  <span className="block text-[10px] text-muted-foreground/70">
                    source: {edge.provenance}
                  </span>
                </li>
              ))}
              {selectedEdges.length === 0 ? (
                <li className="text-xs text-muted-foreground">
                  No stored relationships for this node.
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function KnowledgeGraph() {
  const [data, setData] = React.useState<GraphData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    fetch("/api/graph")
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok) {
          setError(body?.error?.message ?? "Could not load the graph.");
          return;
        }
        setData(body);
      })
      .catch(() => active && setError("Could not load the graph."));
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-[color:var(--destructive)]">
        {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Building graph…
      </div>
    );
  }
  if (data.nodes.length === 0) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card px-6 text-center">
        <Share2 className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Your graph is empty</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Add and analyze papers to populate the graph. Nodes and links are
          built only from stored metadata and analysis — nothing is invented.
        </p>
        <Button asChild size="sm" className="mt-2">
          <Link href="/new">Add a paper</Link>
        </Button>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <GraphCanvas data={data} />
    </ReactFlowProvider>
  );
}
