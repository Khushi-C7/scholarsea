# Data model

PostgreSQL via Prisma 7. Schema: [`prisma/schema.prisma`](../prisma/schema.prisma).

## Entities

15 models, grouped by concern:

- **Identity** — `User`, `UserPreference` (1:1).
- **Library** — `Paper` (the single source of truth for paper metadata),
  `ResearchProject`, and the `ProjectPaper` join (per-project tags).
- **Analysis** — `PaperAnalysis` (versioned structured report per paper) and
  `ExtractedClaim` (granular, source-linked claims with verbatim passages and
  locations).
- **Gap explorer** — `ResearchGapAnalysis` (one run over a project's corpus),
  `ResearchGap` (candidate gap), `GapEvidence` (links a gap to a real passage
  in a real `Paper`, with a supporting/contradicting/contextual stance).
- **Notes & chat** — `ResearchNote`, `Conversation`, `ChatMessage`.
- **Agent** — `AgentSession`, `AgentStep`.

## Design decisions

- **Single source of truth for papers.** Paper metadata lives only on `Paper`.
  Everything else references it by id, so there is no duplicated metadata to
  keep in sync.
- **Evidence integrity at the schema level.** `GapEvidence.paperId` and
  `ChatMessage` citations point at real `Paper` rows. A gap physically cannot
  cite a document that does not exist. `GapEvidence.verified` records whether a
  passage has been checked against its source.
- **Ownership.** Every top-level entity has an `ownerId → User`. Nested records
  inherit ownership through their parent (e.g. a gap belongs to a gap analysis,
  which has an `ownerId`). Authorization checks resolve to these owners.
- **Deletion behavior.** Owned data cascades on `User` delete. Within a user:
  deleting a `Paper`, `ResearchProject`, gap analysis, conversation, or agent
  session cascades to its children. Optional cross-links (a note or
  conversation that merely references a project/paper/gap) use `SET NULL` so
  the record survives when a sibling container is removed.
- **Indexes & uniqueness.** Foreign keys and common filter columns are indexed.
  Duplicate detection is enforced per owner with unique constraints on
  `(ownerId, contentHash)`, `(ownerId, doi)`, and `(ownerId, arxivId)` — NULLs
  are distinct in Postgres, so papers without a DOI/arXiv id are not blocked.
- **Versioned analyses.** Re-running analysis creates a new `PaperAnalysis`
  version (`@@unique([paperId, version])`) rather than overwriting history.
- **Secrets.** `UserPreference.encryptedCredentials` stores ciphertext only;
  plaintext API keys never reach the database.

## Runtime connection

Prisma 7 is "Rust-free": the client talks to Postgres through the `pg` driver
adapter (`@prisma/adapter-pg`), not a native query engine. The singleton lives
in [`src/lib/db/prisma.ts`](../src/lib/db/prisma.ts) and reads a validated
`DATABASE_URL` from [`src/lib/env.ts`](../src/lib/env.ts).

## Migrations

Migrations live in `prisma/migrations/`. In a normal environment:

```bash
npm run db:migrate      # create & apply a dev migration
npm run db:deploy       # apply migrations in CI/production
npm run db:seed         # load development fixtures
npm run db:studio       # browse data
```

### Note on this build environment

The sandbox this project was first built in blocks `binaries.prisma.sh`, the CDN
Prisma downloads its native **schema engine** from. Consequences:

- `prisma generate` works (the client is WASM-based) once the engine-ensure
  prelude is satisfied; it does not need the native engine to run.
- `prisma migrate` / `db push` could not run, because they execute the native
  schema engine, which could not be downloaded.

So the initial migration (`20261017064500_init`) was authored by hand to match
the schema exactly, applied with `psql`, and registered in Prisma's
`_prisma_migrations` table. The schema remains the source of truth; in any
environment with network access to the Prisma CDN, the standard `prisma migrate`
workflow applies unchanged.

## Seed fixtures

[`prisma/seed.ts`](../prisma/seed.ts) builds a small, internally consistent demo
dataset owned by `demo@scholarsea.dev`: one project, three **synthetic** sample
papers (no real DOIs), their analyses and claims, one gap analysis with two
candidate gaps and supporting + contradicting evidence, a note, a conversation,
and an agent session. It is transactional and idempotent — re-running wipes and
rebuilds the demo user's data.
