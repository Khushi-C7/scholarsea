# Settings & configuration

Spec section L. One page (`/settings`) backed by the existing `UserPreference`
model — no migration.

## What you can configure

- **AI provider & model** — pick a provider (OpenAI, Anthropic, a custom
  OpenAI-compatible endpoint) and model, or leave it blank to run in
  clearly-labeled demo mode.
- **API key** — per provider, write-only (see security below), with a **Test
  connection** button.
- **Output language** — applied to chat answers.
- **Prompt customization** — custom instructions appended to the system prompt.
- **Theme** — light / dark / system, applied immediately and persisted.
- **Usage & estimated cost** — real token totals with a clearly-labeled cost
  estimate.
- **Data management** — export everything as JSON, or delete research data.

## API-key security (the important part)

Keys are handled so they never reach a browser bundle, a log, an error
message, or source control:

- `src/lib/crypto/credentials.ts` encrypts each key with **AES-256-GCM** before
  it is written. Only the ciphertext envelope `{ iv, tag, ct }` is persisted
  (in `UserPreference.encryptedCredentials`). The master key is derived with
  `scrypt` from `CREDENTIAL_ENCRYPTION_KEY` (falling back to `AUTH_SECRET` in
  development).
- The client-safe `PreferencesView` never contains a key. The only thing the
  browser learns is **which providers have a key** (`providersWithKey`).
- `PUT /api/settings/api-key` stores (encrypts) a key and returns only
  `providersWithKey`. `DELETE` removes it.
- `getDecryptedKey` is `server-only` and used solely to construct a provider
  adapter or run a connection test — the plaintext is never returned to a
  response body.
- Integration tests assert the plaintext never appears in the client view, the
  raw DB column, or a data export.

A fresh IV per encryption means the same key encrypts to different ciphertext
each time, and the GCM auth tag makes tampering fail closed.

## Per-user provider resolution

`getProviderForUser(userId)` (in `src/lib/ai/provider.ts`) resolves the model
for a user: a Settings choice backed by a stored key wins; otherwise it falls
back to the environment-configured provider, then demo. Chat uses this, so a
user's saved provider/model/key, output language, and custom instructions take
effect on their next question. Preferences are appended **after** the
grounding rules in the chat prompt, so they shape tone/format/language but can
never override the no-fabrication constraints.

## Connection test (`src/lib/ai/connection-test.ts`)

Makes a real, minimal completion call and reports the true outcome — including
honest failure when the provider can't be reached (e.g. restricted networks).
It never reports success without a successful round-trip. A freshly-typed key
can be tested before saving.

## Usage & cost (`src/lib/usage/service.ts`)

Token counts are the **actual** totals providers reported, summed from the
persisted `tokensUsed` columns on analyses, chat messages, and agent sessions
(owner-scoped). The dollar figure is a rough **estimate**: usage records store
only a total, so it is split 50/50 input/output and multiplied by approximate
list prices from `src/lib/ai/catalog.ts`. `isEstimate` is always `true`, the
UI labels it "estimate only, not an invoice", and demo/custom models (no known
price) show no figure at all.

## Data management (`src/lib/preferences/data-management.ts`)

- `GET /api/settings/data` streams a full owner-scoped JSON export (projects,
  papers, analyses, gap analyses + evidence, notes, conversations + messages,
  agent sessions + steps). No secrets or password hashes are included.
- `DELETE /api/settings/data` deletes the user's research data in a
  transaction (cascades handle children) while keeping the account and its
  settings.

## Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/settings` | GET | preferences + usage + provider catalog |
| `/api/settings` | PATCH | update provider/model/language/theme/prompts |
| `/api/settings/api-key` | PUT / DELETE | store (encrypt) / clear a key |
| `/api/settings/test-connection` | POST | real provider connection test |
| `/api/settings/data` | GET / DELETE | export / delete research data |

All require authentication and are owner-scoped.

## Tests

- `tests/unit/credentials.test.ts` — encrypt/decrypt round-trip, no plaintext
  in the envelope, fresh IV per call, GCM tamper rejection, shape validation.
- `tests/unit/usage-cost.test.ts` — cost estimate math; null for demo/custom
  and unknown models.
- `tests/integration/settings.test.ts` — preference updates; key stored
  encrypted and absent from the client view, raw column, and export, with
  server-side decryption working; per-user key isolation; usage aggregation +
  labeled estimate; owner-scoped export without secrets; data deletion keeping
  the account and settings.
