# Contextual research chat

Ask questions about one paper or a collection, answered **only** from those
papers, with source citations. Spec section H. Uses the existing
`Conversation` / `ChatMessage` models — no migration.

## Retrieval (`src/lib/chat/retrieval.ts`)

Real, deterministic lexical retrieval (BM25-style), no embeddings/network — so
it runs offline and is fully testable:

- Each scoped paper's `fullText` is split into overlapping, sentence-aware
  chunks; extracted-claim passages are added as high-value units.
- A query is matched with BM25 scoring plus light stemming (so "condition"
  matches "conditions", "robustness" matches "robust").
- **Relevance is gated on query-term coverage, not an absolute score.** This
  matters because BM25's IDF collapses toward zero in a one-paper corpus (the
  common case); gating on coverage keeps a correct match relevant regardless of
  corpus size. `retrieve` returns an explicit `insufficient` flag when nothing
  clears the gate.

## Grounding (`src/lib/chat/answer.ts`)

The model answers using only the numbered retrieved passages and cites them by
`passageId`. `groundAnswer` is the firewall:

- Empty retrieval, or the model's own `insufficient` flag, or **no cited id
  resolving to a real retrieved passage** → the explicit insufficient message,
  no citations. An answer is never shown ungrounded.
- Cited ids are resolved to real passages; invented ids are dropped. If the
  model cited nothing real, the top retrieved passage is attached so every
  answer carries a source.
- A deterministic demo answerer (extractive, citing the top passages) runs when
  no AI key is configured and in tests, exercising the same grounding path.

## Cross-user isolation (the headline guarantee)

`loadCorpus` in `src/lib/chat/service.ts` is the single choke point: it fetches
papers `where { id in scope, ownerId: user }`. Retrieval only ever sees that
owner- and scope-filtered set, so one user's papers can never appear in
another's answers. Conversation creation rejects any paper the user doesn't own
(404), and every conversation read/ask is `getOwnedConversation`-guarded.

## History

`Conversation` + `ChatMessage` persist every turn (USER then ASSISTANT, with
the assistant's citations stored as JSON). Recent turns are fed back into the
prompt as context. `getConversationView` returns the full ordered history.

## API & UI

- `POST/GET /api/chat/conversations`, `GET /api/chat/conversations/[id]`,
  `POST /api/chat/conversations/[id]/messages` — all owner-guarded.
- `/chat` lists conversations and starts new ones (scope = a paper or a
  collection). `/chat/[id]` is the thread: messages, citations (expandable
  passages linking to the source paper), insufficient-evidence styling, and a
  demo-mode notice. Entry points: an **Ask** button on the paper detail page
  (`/chat?paper=`) and a **Chat** button on the project page
  (`/chat?project=`). A **Research Chat** item was added to the sidebar nav.

## Tests

- `tests/unit/chat-retrieval.test.ts` — chunking; relevance ranking; the
  insufficient flag for irrelevant/empty queries; and the grounding firewall
  (insufficient on empty retrieval, invented ids dropped, citations always from
  the retrieved set).
- `tests/integration/chat.test.ts` — ownership on creation (can't scope to
  another user's paper; 404 on cross-user view); grounded answer cites the
  user's own paper; **cross-user leakage test** (asking about user B's unique
  secret token returns insufficient, with no leak); abstention on off-corpus
  questions; and history persisted in order across turns.
