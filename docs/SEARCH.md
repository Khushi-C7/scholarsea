# Academic search & recommendations

Search arXiv for papers, preview abstracts, import real results into the
library, and get related-paper recommendations from your own corpus. Spec
section K. No migration — imports reuse the existing `Paper` model with
`source = ACADEMIC_SEARCH`.

## Honesty guarantee

**The app never fabricates search results.** Every `ArxivResult` is a real
entry parsed from the arXiv Atom feed. If arXiv cannot be reached, the API
returns a typed error and the UI shows an explicit "arXiv could not be
reached" state — there is deliberately **no demo/offline mode** that invents
papers, because an invented result is worse than no result. (In this sandbox
arXiv is blocked by the network allowlist, so search returns
`search_unavailable`; the client and import/recommend paths are otherwise
fully exercised by tests and runtime checks.)

## Query builder (`src/lib/search/arxiv-query.ts`)

`buildArxivUrl(q)` is pure and deterministic (no network), so it is unit
tested directly:

- keyword → `all:`, title → `ti:`, author → `au:`; multi-word values are
  phrase-quoted. Clauses are AND-combined.
- year range → `submittedDate:[YYYY0101 TO YYYY1231]` (open ends default to
  arXiv's first year / the current year).
- `sortBy=relevance`, `max_results` capped at `MAX_RESULTS_CAP` (50).
- Throws `SearchQueryError` when there is nothing searchable.

## Feed parser (`src/lib/search/arxiv-parse.ts`)

`parseArxivFeed(xml)` is pure and emits **only** entries actually present in
the feed:

- Extracts id + version, title, authors, abstract, published year,
  categories, PDF/abstract links, and `arxiv:doi`.
- Missing fields become `null`/empty — never invented values.
- An entry with no usable id or title is skipped.
- Decodes XML entities (named, decimal, hex; `&amp;` resolved last).

## Fetch client (`src/lib/search/arxiv.ts`)

`searchArxiv(q)` is the only networked piece:

- Module-level rate guard (`MIN_INTERVAL_MS = 3000`) respects arXiv's request
  etiquette; a descriptive User-Agent is sent.
- `AbortSignal.timeout(15s)`; network failure → `SearchUnavailableError`;
  429/503 → `SearchRateLimitedError`; other non-OK → `SearchUnavailableError`.
- Validates the body is actually an Atom feed before parsing. Never fabricates
  on error.

## API

- `GET /api/search?q=&title=&author=&yearFrom=&yearTo=&start=&maxResults=` —
  owner-authenticated (`requireUser`), validated by `searchQuerySchema`
  (requires at least one of q/title/author). Returns `{ results, totalResults,
  start }` or a typed error (`search_unavailable` 503, `search_rate_limited`
  429, `search_bad_query` 400).
- `POST /api/search/import` — imports a real result
  (`importArxivSchema`). Returns the paper summary (201) or `409` with
  `existingPaperId` on a duplicate.
- `GET /api/papers/[id]/related` — related papers for an owned paper (404 if
  not owned).

## Import (`src/lib/search/import.ts`)

`importArxivPaper(userId, input)` takes a trusted `userId` (auth is enforced
at the route). It stores metadata + abstract (no PDF fetch), so:

- The abstract becomes the paper's `fullText` when present; an import with no
  abstract is stored with `extractionStatus = FAILED` and an explanatory
  message rather than invented text.
- Deduplicates by `(ownerId, arxivId)` and by content hash; a re-import throws
  `DuplicatePaperError` carrying the existing paper's id. Dedup is
  **owner-scoped** — two users may each import the same arXiv id.
- Provenance (`provider: arxiv`, arxiv id + version) is recorded in
  `metadata`.

## Recommendations (`src/lib/search/recommend.ts`)

`recommendRelated(userId, paperId, limit = 5)` suggests related papers from
the user's **own** library (owner-scoped; 404 for a paper they don't own):

- Similarity is lexical Jaccard overlap of title + abstract tokens (reusing
  `@/lib/gaps/text`).
- Requires **at least two shared content terms** — weak matches are dropped
  rather than padding the list.
- Every recommendation carries an `explanation` that names the actual shared
  terms ("Shares key terms with this paper: …"). The explanation is derived
  from real overlap, so it can never cite a reason that isn't present in both
  papers.

## UI

- `src/components/papers/academic-search.tsx` — a tab in New Research
  (keyword/title + author + year-range inputs, abstract previews, per-result
  Import buttons with imported/duplicate states, and an honest error banner).
- `src/components/papers/related-papers.tsx` — a "Related papers" section on
  the paper detail page, fetching `/api/papers/[id]/related` and showing each
  suggestion's explanation.

## Tests

- `tests/unit/arxiv.test.ts` — query builder (field mapping, phrase quoting,
  year range, cap, empty-query error); entity decoding; parser against fixture
  XML including a metadata-sparse entry (asserts nulls, not invention) and an
  id/title-less entry (asserts it is skipped); empty-feed returns no results.
- `tests/integration/search.test.ts` — import stores abstract as text and
  flags abstract-less imports; owner-scoped dedup (same id rejected for the
  owner, allowed for another user); recommendation ranking, owner-scoping
  (404), and that every named term in an explanation is a real term from the
  source paper.
