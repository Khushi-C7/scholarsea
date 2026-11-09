# Multi-agent paper analysis

Pipeline that turns one paper's text into a structured Research Insight Report.

## Agents (`src/core/agents/`)

Each agent has one job, its own Zod output schema, a versioned prompt, and a
grounded `demo()` generator:

| Agent | Job | Output |
|-------|-----|--------|
| **Reader** | understand the document | summary, key points, document type, sections |
| **Analyzer** | extract the research structure | problem, methodology, datasets, metrics, results, contributions, limitations, source-linked claims |
| **Terminology** | identify technical terms | terms with definitions and relations |
| **Knowledge builder** | synthesize motivation | motivation, significance, related-work *themes*, follow-up questions |
| **Synthesizer** | draw conclusions from evidence | conclusions, takeaways, evidence-confidence + rationale |
| **Comparator** | compare multiple papers | per-dimension matrix + summary (used by the comparison feature) |

The Knowledge builder describes related work only as **themes**, and references
come from a non-AI extractor (`references.ts`) — the model is never asked to
produce citations, per the no-fabrication rule.

## Coordinator (`src/core/orchestration/coordinator.ts`)

Sequences the agents and manages dependencies:

```
Reader → (Analyzer ∥ Terminology) → Knowledge → Synthesizer
```

Analyzer and Terminology run concurrently. Reader and Analyzer are required
(their failure fails the run); Terminology, Knowledge, and Synthesizer degrade
to null so a partial report is still produced. The coordinator records
per-stage status, attempts, token usage, and timing, and totals usage.

## Validation, retries, timeouts (`src/lib/ai/complete.ts`)

Every model response goes through `completeJson`, which:

- validates the parsed JSON against the agent's Zod schema;
- retries on provider error, invalid JSON, or schema mismatch (bounded, default
  2 retries), nudging the model toward valid JSON between attempts;
- enforces a per-attempt timeout via an AbortController;
- short-circuits on the demo provider, returning the agent's `demo()` output —
  which is still schema-validated, so a broken demo generator is caught.

## Provider abstraction (`src/lib/ai/`)

`AIProvider` is implemented by an OpenAI Chat Completions-compatible adapter
(works with OpenAI, OpenRouter, local servers, …) and a demo provider. Other
vendors can be added as new adapters. `getProvider()` uses the real adapter
when `AI_API_KEY` + `AI_BASE_URL` are set, otherwise the demo provider.

## Demo mode

When no API key is configured, analysis runs in **demo mode**: each agent
produces deterministic output derived heuristically from the document text
(e.g. the summary is the first few sentences; claims quote real passages). It
is clearly labeled in the UI (`DemoBanner`) and stored with
`modelProvider = "demo"`. Nothing is presented as AI-generated when it isn't.

## Persistence (`src/core/pipelines/analyze-paper.ts`)

`analyzePaper(userId, paperId)` enforces ownership, runs the coordinator, and
in one transaction writes a new **versioned** `PaperAnalysis` (normalized
columns plus the full `report` JSON artifact) and the `ExtractedClaim` rows.
`POST /api/papers/[id]/analyze` triggers it.

## Report UI (`/library/[id]`)

Renders the report in modular sections (summary, problem, motivation &
contributions, methodology, datasets, results & metrics, limitations,
conclusions, terminology, related work, references & source passages, follow-up
questions), with Markdown / JSON / BibTeX export and run metadata.

## Tests

- `tests/unit/analysis-schemas.test.ts` — valid/invalid cases for every agent
  schema (required fields, enums, bounds, claim types).
- `tests/unit/complete-json.test.ts` — fence stripping, retry-then-succeed on
  bad JSON and on schema mismatch, failure after exhausting retries, timeout,
  and demo-output validation.
- `tests/unit/agent-demos.test.ts` — every agent's `demo()` output validates
  against its schema across normal and degenerate inputs.
