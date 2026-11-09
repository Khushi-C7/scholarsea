# Knowledge graph

An interactive graph of papers, authors, concepts, methods, datasets, and
topics, with citation links between library papers. Spec section J. Built with
React Flow (`@xyflow/react`). No migration — the graph is assembled on demand
from existing tables.

## The core rule: no invented edges

Every node and every edge is derived from a stored field, and each edge
records a `provenance` string shown in the details panel. Nothing is added to
make the picture look richer. If the data isn't there, the relationship isn't
drawn.

| Node type | Source field |
|-----------|--------------|
| paper   | `Paper` rows (owner-scoped) |
| author  | `Paper.authors` |
| dataset | `PaperAnalysis.datasets[].name` |
| method  | `PaperAnalysis.methodology` |
| concept | `PaperAnalysis.terminology[].term` |
| topic   | `ProjectPaper.tags` (explicit user metadata) |

| Edge | Provenance |
|------|-----------|
| paper → author (`authored_by`) | `paper.authors` |
| paper → dataset (`uses_dataset`) | `analysis.datasets` |
| paper → method (`uses_method`) | `analysis.methodology` |
| paper → concept (`mentions_concept`) | `analysis.terminology` |
| paper → topic (`tagged_topic`) | `projectPaper.tags` |
| paper → paper (`cites`) | `analysis.references` → matched library paper |
| concept ↔ concept (`related_concept`) | `analysis.terminology.relatedTerms` |

Entity nodes are **deduplicated** by normalized label, so two papers that use
the same dataset both connect to one `PlantVillage` node — that shared link is
the real structure of the corpus, not decoration.

## Citations (`src/lib/graph/match.ts`)

A reference string becomes a `cites` edge **only** when it resolves to another
paper already in the user's library. `matchReference` is pure and
conservative:

- shared DOI (normalized) or shared arXiv id → match;
- otherwise the paper's full normalized title (≥ 20 chars) must appear in the
  reference text.

Anything weaker is left unmatched — an unresolved reference never creates an
edge or a phantom node. A paper can never cite itself. The real analysis
pipeline extracts references via `extractReferences(fullText)`, so citation
edges populate automatically as papers are analyzed.

`related_concept` edges only link two concepts that were **both** extracted as
primary terms (no leaf-term clouds), and are deduplicated to one undirected
edge per pair.

## Builder (`src/lib/graph/build.ts`)

`buildGraph(userId, { projectId? })` is owner-scoped end to end: papers,
analyses (latest version per paper), and project tags are all filtered to the
caller, so one user's graph can never contain another user's data. An optional
`projectId` restricts the graph to one owned project. Returns
`{ nodes, edges, counts, paperCount }`; `counts` drives the filter legend.

## API

`GET /api/graph?projectId=` — `requireUser`; `projectId` is checked with
`getOwnedProject` (404 if not owned). Returns the `GraphData`.

## UI (`src/components/graph/knowledge-graph.tsx`)

React Flow canvas with:

- **Zoom / pan / minimap / fit-view** (built-in controls).
- **Node selection** → a details panel showing the node's type, detail text,
  a deep link to the paper (for paper nodes), and every incident relationship
  with its provenance; clicking a related node reselects it.
- **Type filters** — per-type chips (with live counts) toggle whole node types
  on/off; hidden nodes drop their edges too.
- **Search** — matches node labels, highlights hits and dims the rest; Enter
  centres the view on the matches.
- Distinct colour per type; `cites` edges are drawn in the primary colour and
  animated to stand out from attribute edges.
- Honest **empty state** when the library has no graph-able data yet.

### Layout

Positions are computed client-side by a small dependency-free force simulation
(`computeLayout`): nodes seed on a circle, then relax under pairwise repulsion
+ edge springs with a gentle centring pull, over a fixed number of iterations.
It runs once per dataset (memoized); filtering, search, and selection never
recompute it. Layout is pure presentation — the builder emits only truthful
data, with no coordinates, which keeps it fully testable.

## Tests

- `tests/unit/graph-match.test.ts` — `normalizeText`; citation matching on
  DOI, arXiv id, and full-title substring; no self-citation; no match for
  unrelated or short/coincidental titles.
- `tests/integration/graph.test.ts` — owner scoping (user B's papers/datasets
  never appear); node creation for every type; shared dataset/author dedup to
  one node with two edges; a `cites` edge only for a resolvable reference (and
  no phantom node for the unresolvable one); `related_concept` only between
  real terms; every edge has a non-empty provenance; `projectId` restriction
  with its tag → topic edge.
