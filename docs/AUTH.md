# Authentication & authorization

## Authentication

Email + password (credentials) with signed-cookie sessions.

- **Passwords** are hashed with bcrypt (cost 12) in
  [`src/lib/auth/password.ts`](../src/lib/auth/password.ts). Plaintext is never
  stored; `User.passwordHash` holds the hash and is never selected into any
  client-facing response.
- **Sessions** are stateless JWTs (HS256, 7-day expiry) signed with
  `AUTH_SECRET`, in an httpOnly, SameSite=Lax, Secure-in-prod cookie. The
  edge-safe sign/verify lives in [`src/lib/auth/jwt.ts`](../src/lib/auth/jwt.ts)
  so it can run in both the proxy (middleware) and Node server code.
- **Login** always runs a bcrypt comparison — even for unknown emails, against
  a dummy hash — so account existence can't be inferred from timing.
- Emails are normalized to lowercase, so uniqueness and lookup are
  case-insensitive.

Endpoints: `POST /api/auth/signup`, `POST /api/auth/login`,
`POST /api/auth/logout`, `GET /api/auth/me`.

## Authorization

Two layers, in [`src/lib/auth/guards.ts`](../src/lib/auth/guards.ts):

1. **`requireUser()`** — every private route resolves the session first, or
   returns 401.
2. **`getOwned*(id, userId)`** — ownership is enforced *in the query*: each
   fetch filters by the owning user, so another user's row is never returned.
   A miss raises `NotFoundError` (404), which deliberately does not reveal that
   the resource exists for someone else. `assertOwner(ownerId, userId)` is the
   explicit form when a row is already loaded.

List/read queries always filter by `ownerId` (directly, or through a relation
for nested records like analyses and gaps). The route-protection proxy
(`src/proxy.ts`) is only a convenience redirect layer — it is **not** the
security boundary. Each resource is independently guarded server-side.

## Tests

[`tests/`](../tests) (Vitest):

- `unit/password.test.ts` — hashing, verification, salting.
- `unit/jwt.test.ts` — token round-trip, tamper/expiry/wrong-secret rejection.
- `unit/authz.test.ts` — `assertOwner` allow/deny.
- `integration/auth.test.ts` — signup (hashed, not plaintext; default prefs;
  duplicate + case-insensitive rejection), login (correct / wrong / unknown),
  and **cross-user ownership isolation**: user B gets a 404 for user A's
  project, paper, and gap analysis, and scoped list queries never leak A's rows.

Integration tests run against a dedicated `scholarsea_test` database
(`tests/setup.ts` forces `DATABASE_URL` to it, so dev data is never touched).
