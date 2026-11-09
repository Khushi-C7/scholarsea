# Literature review workspace

Projects, paper collections, tags, notes, bookmarks, and library
search/filter/sort. All state persists in PostgreSQL via Prisma — no schema
change was needed (the `ResearchProject`, `ProjectPaper`, `ResearchNote`, and
`PaperAnalysis` models from the data model already cover it).

## Projects (`/projects`, `/projects/[id]`)

- Create, rename, and edit the description of a project; delete it. A user
  cannot have two projects with the same name (`@@unique([ownerId, name])`,
  surfaced as a 409 `ProjectNameTakenError`).
- Deleting a project removes its membership rows and gap analyses (cascade) but
  **keeps the papers** in the library and keeps notes (their `projectId` is set
  null). Verified by test.
- The project page is a three-tab workspace: **Papers**, **Notes**, **Reports**.

## Collections & tags

- `ProjectPaper` joins a paper into a project with a per-project `tags[]`.
- Adding a paper verifies the user owns **both** the project and the paper.
- Tags are deduplicated case-insensitively and capped at 30. Tag chips filter
  the project's papers client-side; distinct tags are aggregated for the chips.
- Removing a paper from a project deletes only the membership, not the paper.

## Notes & bookmarks

- A `ResearchNote` attaches to a project, a paper, and/or a gap. Creation
  verifies ownership of every referenced entity.
- Notes can be edited, bookmarked, and deleted. A paper "bookmark" is modeled
  as a bookmarked note on that paper (the schema's `bookmarked` flag lives on
  notes), created/removed by the bookmark button on the paper detail page.

## Saved reports

A project's **Reports** tab lists the latest analysis of each paper in the
project — the per-paper Research Insight Reports from the analysis pipeline.

## Library search / filter / sort (`/library`)

URL-param-driven and server-rendered, so filters are shareable and
back/forward works:

- **Search** (`q`) over title, abstract, and author (case-insensitive).
- **Filters**: extraction status, source, year, tag, and bookmarked-only.
- **Sort**: newest, oldest, title A–Z, year ↓/↑.

Query params are validated with `libraryQuerySchema`; anything invalid falls
back to defaults. Every query is scoped to `ownerId`, and the tag filter joins
through project memberships. An empty library shows an onboarding state; a
filtered query with no matches shows a distinct "no matches" state.

## API

| Route | Methods |
|-------|---------|
| `/api/projects` | GET list, POST create |
| `/api/projects/[id]` | GET detail, PATCH update, DELETE |
| `/api/projects/[id]/papers` | POST add paper |
| `/api/projects/[id]/papers/[paperId]` | PATCH tags, DELETE remove |
| `/api/notes` | GET (by project/paper/bookmarked), POST create |
| `/api/notes/[id]` | PATCH (body/bookmark), DELETE |

Every route goes through `requireUser` + the ownership-scoped service layer, so
one user can never read or mutate another's projects, papers, notes, or tags.

## Tests

`tests/integration/projects.test.ts` (21 cases): project CRUD with name-uniqueness
and cross-user 404 isolation; membership add/dedupe/remove and the rule that a
paper must be owned to be added; tag replacement and aggregation; note creation
ownership checks and bookmark listing isolation; library search, title sort,
bookmarked-only filter, and cross-user leakage; and that deleting a project
keeps its papers.
