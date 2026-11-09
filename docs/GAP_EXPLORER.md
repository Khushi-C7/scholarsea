# Research Gap Explorer

The full flagship feature, spec section E. Steps 1–2 build an evidence corpus
and detect patterns; steps 3–5 generate candidate gaps, expose an evidence
inspector, and produce an exportable report.

## Step 1 — Evidence corpus (`src/lib/gaps/corpus.ts`)

`buildCorpus(userId, projectId)` (owner-scoped) walks every paper in the
project and, from each paper's **latest** analysis, collects structured
information: objectives, methods, model architectures, datasets, metrics,
results, limitations, future-work, and contexts/assumptions. It retains **every
extracted claim** with its `paperId`, `paperTitle`, verbatim `supportingPassage`,
and `location`. Nothing is synthesized — the corpus is exactly what the stored
analyses contain, so every downstream citation is traceable.

It tracks `papersExamined` (all papers in the project) separately from
`papersAnalyzed` (those with an analysis), because that distinction drives the
honesty guarantees below.

## Step 2 — Pattern engine (`src/lib/gaps/patterns.ts`)

`detectPatterns(corpus)` is **pure and deterministic** (no AI, no network) and
returns candidate patterns of six kinds:

- **repeated_limitation** — a similar limitation clustered across ≥2 papers.
- **conflicting_findings** — results on an overlapping topic with opposite
  polarity.
- **uncompared_methods** — ≥2 methods/architectures with no shared dataset, so
  they were never evaluated under comparable conditions.
- **dataset_coverage_gap** — datasets each used by only one paper (thin overlap).
- **missing_evaluation** — an aspect (robustness / generalization / deployment)
  that papers *raise* as a limitation or future direction but none actually
  evaluate.
- **recurring_future_work** — a future direction clustered across ≥2 papers.

Each pattern carries `evidence[]` (every item points at a real corpus paper,
with its passage), `papersInvolved`, and `papersExamined`.

### The critical discipline: absence ≠ non-existence

Spec section E, step 2 requires distinguishing a genuine absence of evidence in
*our* corpus from proof that no research exists. This is enforced
**structurally**, not just in prose:

- Every pattern's `evidenceScope` states the finding relative to the corpus —
  e.g. *"Observed in 3 of 5 analyzed papers in this corpus."*
- Absence-type patterns (`uncompared_methods`, `dataset_coverage_gap`,
  `missing_evaluation`) set `isAbsence: true` and **always** carry an
  `absenceCaveat`: *"…an absence of evidence in the N analyzed papers in this
  corpus — not proof that no such research exists."*
- `missing_evaluation` only fires when the corpus itself raises the aspect yet
  no paper evaluates it. If nothing in the corpus even mentions an aspect, the
  engine stays silent rather than asserting a gap it has no evidence for.
- With fewer than two analyzed papers, `detectPatterns` returns
  `insufficientEvidence: true` with a reason instead of fabricating patterns.
  Zero detected patterns is likewise reported as "no patterns detected in this
  corpus", never as "no gaps exist".

## API & UI

- `POST /api/gaps/corpus { projectId }` → `{ corpus, patterns }` (owner-guarded).
- `/gaps` lets the user pick a project, build the corpus, and review the
  corpus summary and pattern cards. Each card shows its evidence passages, the
  corpus-scope note, and — for absence patterns — the explicit caveat. The page
  deep-links from a project via `/gaps?project=<id>`.

## Tests

- `tests/unit/gap-patterns.test.ts` — each detector on synthetic corpora;
  insufficient-evidence handling (0 and 1 analyzed papers); and an
  evidence-integrity sweep asserting every evidence item references a corpus
  paper, every pattern is corpus-scoped, and absence ⇔ caveat present.
- `tests/integration/gap-corpus.test.ts` — corpus building against the DB:
  examined-vs-analyzed counts, structured-field collection, that **every
  retained claim carries its paper id and a non-empty supporting passage**,
  cross-user 404, and an end-to-end run whose pattern evidence resolves to real
  corpus papers.

## Step 3 — Candidate gap generation (`src/core/pipelines/generate-gaps.ts`)

Generates candidate gaps and persists them (`ResearchGapAnalysis` →
`ResearchGap` → `GapEvidence`). The no-fabrication guarantee is structural:

1. `buildEvidenceMenu` (in `gap-resolve.ts`) turns the detected patterns into a
   numbered menu of **real** passages, each tied to a real ingested paper.
2. The model (or the deterministic demo generator) writes the gap narrative but
   cites evidence **only by `evidenceId`** from that menu — it never emits paper
   titles, authors, or passages itself.
3. `resolveGap` looks each referenced id up in the menu. Ids that exist become
   verified evidence tied to a real paper; **ids the model invents are dropped**
   and counted. A gap with no resolvable supporting passage is never presented.
4. `verificationStatus` is computed from the resolved evidence, **not** the
   model's stated confidence: VERIFIED (supported, nothing fabricated), REFUTED
   (contradiction outweighs support), NEEDS_REVIEW (some ids were fabricated),
   UNVERIFIED (nothing resolved). This keeps "model confidence" and "scientific
   validity" separate, as the spec requires.

Each gap stores title, explanation, significance ("why it matters"),
confidence rationale, evidence coverage, suggested experiments, research
questions, and supporting + contradictory `GapEvidence`.

When the corpus has fewer than two analyzed papers, generation **abstains**: it
records what is missing in `coverageNotes`/`limitations` and persists zero
gaps, rather than inventing conclusions.

## Step 4 — Evidence inspector (`src/components/gaps/gap-card.tsx`)

Each candidate gap shows its supporting and contradictory evidence side by
side. For every passage the inspector links to the source paper
(`/library/[paperId]`), shows the verbatim quote, and marks whether the source
is verified. The reviewer can mark a gap **Useful / Investigate / Reject**
(persisted to `reviewStatus`) and attach notes (`reviewerNotes`), via
`PATCH /api/gaps/gap/[id]`.

## Step 5 — Gap report & export (`src/lib/gaps/report-export.ts`)

`/gaps/[id]` renders the full report: executive summary, literature coverage,
identified patterns, candidate gaps with evidence, conflicting findings,
research questions, suggested experiments, limitations, and a references list
of the real papers cited. Exports to **Markdown** and **JSON** (pure
formatters). An insufficient-evidence analysis renders an explicit "what's
missing" state instead of empty sections.

## API

| Route | Purpose |
|-------|---------|
| `POST /api/gaps/corpus` | corpus + patterns (steps 1–2 preview) |
| `POST /api/gaps/generate` | generate & persist candidate gaps (step 3) |
| `GET /api/gaps/analyses?projectId=` | list a project's saved analyses |
| `GET /api/gaps/analyses/[id]` | full analysis view |
| `PATCH /api/gaps/gap/[id]` | reviewer marking + notes (step 4) |

All owner-scoped.

## Gap evaluation suite (spec section 9)

`tests/unit/gap-resolve.test.ts` — the fabrication firewall in isolation:
menu-building and de-duplication; real ids resolve to real passages; **invented
ids are dropped** and flag NEEDS_REVIEW; a gap citing only invented ids is
UNVERIFIED; REFUTED when contradiction dominates; and **verification is
independent of the model's stated confidence**.

`tests/integration/gap-evaluation.test.ts` — a curated, manually-authored
corpus run end-to-end, measuring the section-9 properties: every cited source
exists in the corpus; every cited passage is verbatim corpus text (not
invented); extracted limitations match the originals; contradictory evidence is
surfaced where a conflict exists; each gap carries the reviewer-useful fields;
confidence rationale references observable evidence; and the system **abstains
with an explanation** for 1-paper and empty projects.
