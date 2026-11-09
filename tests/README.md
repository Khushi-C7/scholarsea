# tests

- `unit/` — pure logic: schema validation, parsing, comparison,
  citation/evidence linking, export formatting, authorization utils.
- `integration/` — service flows against a test database and mocked
  providers.
- `e2e/` — Playwright browser tests of the primary user workflows.
- `fixtures/` — curated inputs, including the research-gap evaluation set.
