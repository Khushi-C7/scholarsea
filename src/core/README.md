# core

Application logic that is independent of the HTTP layer: agent
orchestration, analysis pipelines, and the individual specialist
agents (reader, analyzer, terminology, knowledge builder, comparator,
synthesizer, recommender).

- `agents/` — one module per specialist agent, each with a single
  responsibility and a schema-validated output.
- `orchestration/` — the coordinator that sequences agents, runs
  independent work concurrently, and manages retries/timeouts.
- `pipelines/` — end-to-end flows (paper analysis, gap analysis,
  autonomous agent run) composed from agents.

Route handlers call into this layer; business logic does not live in
route handlers.
