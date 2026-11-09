# ScholarSea

An AI research-intelligence workspace. Ingest academic papers, run multi-agent
analysis, explore evidence-linked research gaps across a corpus, compare papers,
chat over your own library, run a bounded autonomous research agent, visualize a
knowledge graph, and export traceable reports.

ScholarSea is an original implementation built incrementally, feature by
feature, with tests after each increment. Every per-feature design note lives in
[`docs/`](docs/).

> **Honesty first.** ScholarSea never fabricates search results, citations,
> statistics, or analysis. When a source can't be reached or the evidence is
> insufficient, it says so instead of inventing an answer. Without an AI key it
> runs in a clearly-labeled **demo mode** rather than pretending to call a model.

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment variables](#environment-variables)
- [Database setup & migrations](#database-setup--migrations)
- [Development commands](#development-commands)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security considerations](#security-considerations)
- [Known limitations & roadmap](#known-limitations--roadmap)
- [Credits & licenses](#credits--licenses)

---

## Overview

ScholarSea turns a pile of papers into a queryable research workspace. You add
papers (paste, PDF, URL, or arXiv search), the multi-agent pipeline extracts a
structured insight report for each, and higher-level tools work across the whole
corpus: a Research Gap Explorer that surfaces evidence-linked candidate gaps, a
comparison matrix, grounded chat, an autonomous agent, and an interactive
knowledge graph. Everything is owner-scoped and persisted in PostgreSQL.

The guiding constraint throughout is traceability: every claim, citation, and
graph edge maps back to a real stored document or is explicitly labeled
unverified.

## Features

- **Accounts & authorization** — email/password with signed-JWT sessions in
  httpOnly cookies. Every private resource is owner-scoped; cross-user access
  returns 404 (never leaking existence). See [`docs/AUTH.md`](docs/AUTH.md).
- **Paper ingestion** — pasted text, PDF upload, public URL, and arXiv search
  import. File size/type validation, duplicate detection (content hash + DOI +
  arXiv id), SSRF-protected URL fetching, metadata extraction, and clear
  extraction-failure reporting. See [`docs/INGESTION.md`](docs/INGESTION.md).
- **Multi-agent analysis** — Reader, Analyzer, Terminology analyzer, Knowledge
  builder, Comparator, and Synthesizer under a coordinator. Every model response
  is validated against a Zod schema with bounded retries and timeouts. See
  [`docs/ANALYSIS.md`](docs/ANALYSIS.md).
- **Research Insight Report** — a structured per-paper report (summary, problem,
  methodology, datasets, metrics, results, limitations, terminology, related
  work, references, follow-ups).
- **Research Gap Explorer (flagship)** — builds a structured evidence corpus,
  finds candidate patterns (repeated limitations, conflicts, uncompared methods,
  coverage gaps), and generates candidate gaps with supporting passages,
  contradictory evidence, a confidence rationale, and suggested experiments. It
  distinguishes *absence of evidence in our corpus* from *proof none exists*, and
  abstains when evidence is insufficient. Includes an evidence inspector and
  Markdown/JSON export. See [`docs/GAP_EXPLORER.md`](docs/GAP_EXPLORER.md).
- **Literature review workspace** — projects with editable names/descriptions,
  paper collections, tags, search, filters, sorting, notes, and bookmarks.
- **Paper comparison** — compare N papers across consistent dimensions with
  source-linked claims; missing fields are marked *not reported*, never invented.
  Exportable. See [`docs/COMPARISON.md`](docs/COMPARISON.md).
- **Contextual chat** — ask questions about one paper or a collection with real
  lexical retrieval, grounded answers, and source citations; says when the
  corpus is insufficient. One user's papers never leak into another's answers.
  See [`docs/CHAT.md`](docs/CHAT.md).
- **Autonomous research agent** — a goal-based agent that plans bounded steps,
  retrieves/analyzes/compares, and synthesizes an evidence-backed answer with a
  live timeline, cancellation, retry, and hard limits on tool calls, runtime,
  and tokens. Treats retrieved content as data, never instructions. See
  [`docs/AGENT.md`](docs/AGENT.md).
- **Knowledge graph** — papers, authors, concepts, methods, datasets, and topics
  with citation links, built only from stored metadata/analysis (no decorative
  edges). Zoom, pan, filter, search, details panel. See
  [`docs/KNOWLEDGE_GRAPH.md`](docs/KNOWLEDGE_GRAPH.md).
- **Academic search & recommendations** — arXiv keyword/title/author/year
  search, abstract previews, import, and related-paper recommendations with
  grounded explanations. Never shows fabricated results. See
  [`docs/SEARCH.md`](docs/SEARCH.md).
- **Settings** — AI provider/model selection, AES-256-GCM-encrypted API-key
  storage (never exposed to the browser), output language, prompt customization,
  theme, token usage with labeled cost estimates, connection test, and data
  export/delete. See [`docs/SETTINGS.md`](docs/SETTINGS.md).
- **Export** — Markdown, JSON, and BibTeX with proper escaping and citations that
  map to real sources. See [`docs/EXPORT.md`](docs/EXPORT.md).
- **Demo mode** — every AI feature works without a key using clearly-labeled
  heuristics, so the app is fully explorable offline.

### Screenshots & architecture diagram

Screenshots are not committed to the repo. To capture your own, run the app
(`npm run dev`), sign in as the demo user, and screenshot the Dashboard,
Library, a Research Insight Report, the Gap Explorer, and the Knowledge Graph.
The architecture is described textually below.

## Architecture

```
Browser (Next.js App Router, React 19, Tailwind v4, shadcn-style UI)
   │  fetch / server components
   ▼
Route handlers & server actions  ── requireUser + owner-scoped guards
   │
   ├─ src/lib/documents   ingestion, extraction, dedup, SSRF
   ├─ src/core/pipelines  analyze-paper, agent-run (coordinator)
   ├─ src/lib/ai          provider adapters (OpenAI-compatible + demo),
   │                      completeJson (schema-validated, retries, timeouts)
   ├─ src/lib/gaps        evidence corpus, pattern detection, gap generation
   ├─ src/lib/chat        lexical retrieval + grounded answering
   ├─ src/lib/graph       knowledge-graph builder (stored data only)
   ├─ src/lib/export      Markdown / JSON / BibTeX
   ├─ src/lib/preferences settings, encrypted credentials, data management
   └─ src/lib/db          Prisma client
   │
   ▼
PostgreSQL (Prisma 7)  ── users, papers, analyses, claims, gaps, evidence,
                          projects, notes, conversations, agent sessions/steps
```

Key patterns: a **fabrication firewall** (the model references evidence by ID
from a server-built menu; invented IDs are dropped and verification is computed
from resolved evidence, not model confidence); **owner-scoped guards** on every
resource; and a **client-driven step loop** for live agent/gap updates on
serverless. File layout and decisions are in [`docs/`](docs/) and
[`docs/WORKSPACE.md`](docs/WORKSPACE.md).

## Technology stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 ·
Radix primitives · Lucide icons · next-themes · Prisma 7 + PostgreSQL 16 · Zod ·
bcryptjs + jose (JWT) · @xyflow/react (knowledge graph) · Vitest (unit +
integration) · Playwright (E2E).

## Prerequisites

- **Node.js 22.x**
- **PostgreSQL 16** (local or hosted)

## Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    set DATABASE_URL and AUTH_SECRET (e.g. openssl rand -base64 48)

# 3. Generate the Prisma client, apply migrations, seed demo data
npm run db:generate
npm run db:deploy
npm run db:seed

# 4. Run
npm run dev          # http://localhost:3000
```

Demo login: `demo@scholarsea.dev` / `demo-password-123`.

## Environment variables

All server secrets live in environment variables; `.env` is git-ignored and
only `.env.example` (placeholders) is committed.

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `SHADOW_DATABASE_URL` | dev only | Shadow DB for `prisma migrate dev` |
| `AUTH_SECRET` | yes | Signs session JWTs (≥16 chars; use a long random value) |
| `CREDENTIAL_ENCRYPTION_KEY` | recommended | Derives the AES-256-GCM key for user API keys; falls back to `AUTH_SECRET` if unset |
| `AI_PROVIDER` | no | Default provider label (e.g. `openai`) |
| `AI_BASE_URL` | no | OpenAI-compatible API root; with `AI_API_KEY`, enables real analysis |
| `AI_API_KEY` | no | Server-wide default key (users can also set their own in Settings) |
| `AI_MODEL` | no | Default model id |
| `TEST_DATABASE_URL` | test | Database used by integration tests |

Without `AI_BASE_URL` + `AI_API_KEY` (and no per-user key), the app runs in demo
mode. Per-user keys set in Settings are encrypted at rest and take precedence.

## Database setup & migrations

ScholarSea uses PostgreSQL via Prisma. Migrations live in `prisma/migrations/`.
The development and production build scripts generate the Prisma client
automatically. Set `DATABASE_URL` before starting the app; `SHADOW_DATABASE_URL`
is only needed for development migrations.

```bash
npm run db:generate   # generate the Prisma client
npm run db:deploy     # apply migrations (CI/production)
npm run db:migrate    # create + apply a new dev migration
npm run db:seed       # load demo fixtures
npm run db:reset      # drop, re-migrate, and re-seed (destructive)
npm run db:studio     # browse the data
```

For integration tests, create a `scholarsea_test` database (or point
`TEST_DATABASE_URL` elsewhere) and apply migrations to it.

## Development commands

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm test` | Unit + integration tests (Vitest) |
| `npm run test:unit` / `npm run test:integration` | Subset runs |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run db:*` | Database tasks (see above) |

## Testing

```bash
npm test              # unit + integration (Vitest)
npm run test:e2e      # end-to-end (Playwright, Chromium)
```

- **Unit** (`tests/unit/`) — schema validation, PDF/arXiv parsing, comparison
  export, citation/evidence linking, gap validation, export formatting
  (BibTeX/Markdown/JSON), authorization utilities, credential encryption, cost
  estimation, SSRF/IP checks, JWT, password hashing.
- **Integration** (`tests/integration/`) — upload-and-analyze, save/retrieve a
  project, compare papers, run gap analysis, retrieve cited evidence, provider
  error/retry/timeout handling, agent cancellation and retry, owner-scoping
  across every feature, settings/key storage, and data export. These expect a
  `scholarsea_test` database (or `TEST_DATABASE_URL`).
- **End-to-end** (`tests/e2e/`) — the primary browser workflow (sign up → empty
  state → ingest → library → persistence after reload), an auth-protected
  redirect, and responsive navigation. Runs the production build via Playwright's
  web server. In CI, Chromium is installed with `npx playwright install
  --with-deps chromium`.

### Research gap evaluation

`tests/integration/gap-evaluation.test.ts` encodes the section-9 evaluation
properties against curated fixtures: whether cited sources exist, whether
citations support their claims, whether extracted limitations match the source,
whether contradictory evidence is surfaced, and whether the system abstains when
evidence is insufficient. Results are measured from the fixtures — no benchmark
numbers are fabricated and no academic novelty is claimed.

### Continuous integration

`.github/workflows/ci.yml` runs on every push and PR: a **verify** job (lint,
type-check, unit + integration tests against a Postgres service, and a
production build) and an **e2e** job (build + Playwright). Both spin up a
`postgres:16` service and apply migrations with `prisma migrate deploy`.

## Deployment

Target: **Vercel** + a managed PostgreSQL (Neon, Supabase, RDS, etc.). Full
walkthrough in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). In short:

1. Push the repo to GitHub and import it into Vercel.
2. Set env vars in Vercel (at least `DATABASE_URL`, `AUTH_SECRET`,
   `CREDENTIAL_ENCRYPTION_KEY`; optionally the `AI_*` values).
3. The build command is `npm run vercel-build`
   (`prisma generate && prisma migrate deploy && next build`), so migrations are
   applied on deploy.
4. Open the deployed URL and sign up (or seed the demo user).

## Security considerations

- **Passwords**: bcrypt-hashed; never stored or logged in plaintext.
- **Sessions**: signed JWTs (jose) in httpOnly, SameSite cookies.
- **Authorization**: every private resource is owner-scoped via central guards;
  cross-user reads return 404 to avoid existence leakage.
- **API keys**: user-supplied provider keys are encrypted with AES-256-GCM
  before storage (`CREDENTIAL_ENCRYPTION_KEY`), never returned to the browser,
  logged, or committed. The client only learns whether a key is set.
- **SSRF protection**: URL ingestion blocks private/reserved/link-local ranges
  and non-http(s) protocols, with DNS resolution checks.
- **Prompt-injection resistance**: retrieved document content is wrapped and
  treated as untrusted data; the agent never executes instructions found in
  papers.
- **No fabrication**: search results, citations, statistics, and graph edges are
  derived from real stored data or labeled unverified/estimated.
- **Secrets**: only in environment variables; `.env` is git-ignored.

## Known limitations & roadmap

These are documented honestly rather than hidden. Each has an implementation
plan.

1. **Streaming is simulated, not true SSE.** Live agent/gap/analysis updates use
   client-driven polling/step loops instead of server-sent events (chosen for
   serverless friendliness). *Plan:* add an SSE/ReadableStream transport for
   step events behind the existing step-loop API, falling back to polling.
2. **Uploaded files aren't kept in object storage.** PDFs are parsed to text on
   ingest; the original binary isn't retained (the `storageKey` column is
   reserved but unused). *Plan:* stream uploads to S3-compatible storage, store
   the `storageKey`, and add a re-extract action.
3. **No batch ingestion UI.** Papers are added one at a time. *Plan:* accept
   multiple files/URLs, fan out to the existing ingest path with a progress
   list, deduping as it goes.
4. **Prompt customization applies to chat only.** Custom instructions are wired
   into the chat system prompt but not yet the analysis/agent prompts. *Plan:*
   thread per-user overrides through the analysis coordinator and agent planner.
5. **Knowledge-graph layout isn't persisted.** Positions are computed by a
   client force simulation each load. *Plan:* persist manual positions per user
   and offer layout presets.
6. **Citation/author resolution is conservative.** Graph citation edges only
   link papers already in your library (DOI/arXiv/exact-title match); authors
   are de-duplicated by normalized name, not ORCID. *Plan:* add a resolver
   against external metadata (Crossref/OpenAlex) with manual confirmation.
7. **Cost figures are estimates.** Providers report only total tokens, so costs
   use a 50/50 input/output split against approximate list prices and are
   labeled estimates. *Plan:* capture per-call input/output splits where the API
   exposes them.
8. **Serverless limits.** On Vercel Hobby, PDF uploads over ~4.5 MB hit the body
   limit and long real-model analyses can exceed the 60s function limit; demo
   mode and paste/URL ingestion are unaffected. *Plan:* move heavy analysis to a
   background queue/worker.

**Roadmap:** true streaming, object storage, batch ingestion, external metadata
resolution, a background job queue for long analyses, and richer graph layout
controls.

## Credits & licenses

Built by the ScholarSea author as an original implementation. Third-party
components are used under their own licenses: Next.js, React (MIT), Tailwind CSS
(MIT), Radix UI (MIT), Lucide (ISC), Prisma (Apache-2.0), Zod (MIT), jose (MIT),
bcryptjs (MIT), @xyflow/react (MIT), Vitest (MIT), and Playwright (Apache-2.0).
Paper data you ingest remains subject to its original source's terms; arXiv
metadata is retrieved via the public arXiv API.

No project license is set yet. Add one (and confirm you have the right to
license all committed assets) before publishing for reuse.
