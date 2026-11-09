# Paper comparison

Compares 2–6 papers across nine consistent dimensions, in a table with
source-linked claims. Built deterministically from each paper's stored
analysis, so **no value is ever invented** — a field a paper does not report is
marked **Not reported**.

## Dimensions (`src/lib/compare/config.ts`)

Research objective · Methodology · Model architecture · Datasets · Evaluation
metrics · Results · Limitations · Contributions · Future work — the exact set
from spec section G, in a fixed order so every paper is compared on the same
fields.

The upper limit is a single configurable constant: `COMPARE_MAX` (default 6),
with `COMPARE_MIN = 2`.

## How a cell is filled (`src/lib/compare/build.ts`)

`buildComparison(userId, paperIds)`:

1. Fetches the papers **owner-scoped**; if any requested paper isn't the
   user's, the whole request is a 404 (no existence leakage).
2. Loads each paper's **latest** `PaperAnalysis` and its `ExtractedClaim`s.
3. Maps each dimension to the stored analysis fields (objective ←
   researchProblem, datasets ← datasets[], metrics ← metrics[], etc.).
4. A dimension with no stored value produces an empty cell flagged
   `reported: false` → rendered/exported as "Not reported". Nothing is
   generated at compare time, so nothing can be hallucinated.
5. Source passages come from the matching `ExtractedClaim`s (e.g. OBJECTIVE
   claims back the objective row), giving each claim a verifiable source link.

A paper with no analysis at all compares as all-not-reported and is flagged
"Not analyzed yet" in the header.

## UI (`/compare`)

- A checkbox picker over the user's completed papers, enforcing the 2..MAX
  bounds (the picker disables further selection at MAX).
- The matrix renders dimensions down the left and one column per paper.
  "Not reported" cells are visibly muted; cells with source passages expand to
  show the verbatim quotes.
- Deep-link: `/compare?papers=id,id,…` pre-selects papers. The project page's
  **Compare** button links here with the project's papers.

## Export (`src/lib/compare/export.ts`)

The built table exports to **Markdown**, **CSV**, and **JSON** (JSON preserves
source passages and the reported/not-reported flags). Formatters are pure
functions, unit-tested independently of the DB.

## Tests

- `tests/unit/compare-export.test.ts` — request-schema min/max and dedupe
  enforcement; Markdown/CSV/JSON formatting including the Not-reported sentinel.
- `tests/integration/compare.test.ts` — matrix shape (9 dimensions, one column
  per paper); reported vs not-reported for present/missing fields; claim-based
  source-linking; unanalyzed-paper handling; cross-user 404; and an assertion
  that the "Not reported" sentinel is never emitted as a real value.
