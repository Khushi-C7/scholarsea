# Export system

Spec section M. Export paper metadata and reports in several formats, with
proper escaping and citations that map to real sources.

## Formats

| Format | Module | Notes |
|--------|--------|-------|
| BibTeX | `src/lib/export/bibtex.ts` | `@article`/`@misc`, LaTeX escaping, case-preserving titles |
| Markdown | `src/lib/export/papers.ts` | human-readable list with source links |
| JSON | `src/lib/export/papers.ts` | structured stored fields |
| Comparison (MD/CSV/JSON) | `src/lib/compare/export.ts` | from step 7 |
| Gap report (MD/JSON) | `src/lib/gaps/report-export.ts` | from step 9 |

## Citations map to real sources

Every exported entry is built from a stored `Paper` row. No field is invented:
a BibTeX field is emitted **only** when the source row actually has it, and an
untitled paper is skipped entirely (`isExportable`). So an exported citation
always corresponds to a real ingested document — there are no placeholder or
fabricated references.

## BibTeX details

- Entry type is `@article` when a venue is present, else `@misc`; arXiv papers
  get `eprint` + `archivePrefix = {arXiv}`.
- Cite keys are `lastnameYEARword` (ASCII, lowercased), disambiguated with a
  trailing letter on collision (`smith2023nets`, `smith2023netsa`).
- Titles are double-braced (`{{Title}}`) to preserve capitalization.
- `escapeBibtex` escapes `\ & % $ # _ { } ~ ^`.
- Authors are joined with ` and `.

## Markdown / JSON

`escapeMarkdown` escapes structural characters (`* _ \` [ ] ( ) # > | ~`) so a
title or abstract can't break the document. JSON export is a validated
envelope (`schema`, `count`, `papers`) of the real stored fields.

## Route

`GET /api/export/papers?format=bibtex|md|json&ids=<csv>` — authenticated and
owner-scoped. `ids` optionally restricts to a selection; otherwise all of the
user's papers are exported. Responds with the correct content-type and a
dated `attachment` filename (`.bib` / `.md` / `.json`).

The full data export (`GET /api/settings/data`) is documented in
`docs/SETTINGS.md`.

## UI

`src/components/papers/export-menu.tsx` — a dropdown in the library header
offering BibTeX / Markdown / JSON downloads (disabled when the library is
empty). The existing per-report exports (comparison table, gap report) remain
on their own pages.

## Tests

`tests/unit/export-bibtex.test.ts` — BibTeX special-char escaping; `@article`
with a venue; omission of absent fields (no invention); arXiv eprint fields;
cite-key collision disambiguation; untitled entries skipped; Markdown escaping
and metadata; valid JSON envelope. Runtime checks confirmed all three formats
download with correct content types from real stored rows.
