# Paper ingestion

Three sources, one pipeline in [`src/lib/documents/`](../src/lib/documents).

- **Pasted text** — validated for length, metadata inferred heuristically.
- **PDF upload** — multipart; validated by **magic bytes** (`%PDF-`), not the
  declared MIME or filename, then parsed with `unpdf` for text + info-dict
  metadata.
- **Public URL** — fetched through the SSRF-safe client, then handled as a PDF
  (magic bytes) or HTML page (scholarly meta tags).

Entry point: `ingestPaper(userId, input)` in `ingest.ts`. API:
`POST /api/papers` (JSON for text/URL, multipart for PDF), `GET /api/papers`
(owner-scoped list), `GET /api/papers/[id]`.

## SSRF protection (`ssrf.ts`, `ip.ts`)

Defense in depth for user-supplied URLs:

1. **URL validation** (sync): only `http`/`https`; no embedded credentials;
   only ports 80/443; reject private/reserved IP **literals** up front.
2. **Guarded DNS lookup**: a custom `lookup` passed to the undici dispatcher
   resolves the host and rejects if **any** resolved address is
   private/reserved. Because this is the same resolution used to open the
   socket, there is no DNS-rebinding (TOCTOU) window.
3. **Redirects** are followed manually, re-validating every hop.
4. **Caps**: byte limit (streamed, aborts when exceeded) and a request timeout.

`isBlockedIp` covers IPv4 (loopback, private, CGNAT, link-local incl. the
`169.254.169.254` cloud-metadata address, benchmarking, TEST-NET, multicast,
reserved) and IPv6 (loopback, ULA, link-local, multicast, documentation), plus
IPv4 embedded in IPv6 (mapped / NAT64). It **fails closed** on anything it
can't parse.

## File & content validation (`validate.ts`, `limits.ts`)

- PDF: non-empty, ≤ 20 MB, real `%PDF-` header.
- Text: ≥ 20 and ≤ 2,000,000 characters.
- Fetched bytes are classified PDF-vs-HTML by magic bytes first, content-type
  second.

## Duplicate detection

Content is hashed (SHA-256 of file bytes for PDFs; of normalized text
otherwise) and stored on `Paper.contentHash`. Ingestion checks for an existing
hash for that user and returns a 409 with the existing paper's id; the DB
unique constraints `(ownerId, contentHash | doi | arxivId)` are the backstop.

## Metadata (`metadata.ts`)

Title, authors, year, abstract (and DOI/arXiv id where present) are extracted
from PDF info dictionaries, scholarly HTML meta tags (`citation_*`, Dublin
Core, Open Graph), or plain-text heuristics. **Nothing is invented** — fields
stay null/empty when the source doesn't supply them.

## Status & failures

Each paper carries `extractionStatus` + `extractionError`:

- Pre-flight failures (bad type/size, blocked URL, duplicate) are rejected with
  a clear 4xx and **no** row is created.
- A valid source whose text can't be extracted (e.g. a scanned, text-less PDF)
  is stored as a **FAILED** record with an explanatory message, visible in the
  library — so the failure is surfaced, not hidden.

## Tests

- `tests/unit/ip.test.ts` — the full blocked/allowed IP matrix (v4, v6,
  mapped, NAT64, garbage).
- `tests/unit/ssrf.test.ts` — URL validation + `safeFetch` blocking loopback,
  localhost (via DNS), and the metadata endpoint.
- `tests/unit/file-validation.test.ts` — PDF magic/size, text limits,
  classification, metadata helpers.
- `tests/unit/pdf.test.ts` — real text extraction from a generated PDF.
- `tests/integration/ingest.test.ts` — pasted-text + PDF ingest, duplicate
  rejection, and SSRF-guarded URL ingestion.
