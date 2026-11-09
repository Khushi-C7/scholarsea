import net from "node:net";
import dns from "node:dns";
import { Agent, request as undiciRequest } from "undici";

import { isBlockedIp } from "@/lib/documents/ip";
import { SsrfError, FetchError, FileTooLargeError } from "@/lib/documents/errors";

const USER_AGENT = "ScholarSea/0.1 (+research paper ingestion)";

/**
 * Validate a user-supplied URL before any network access. Synchronous checks
 * only (no DNS): protocol, credentials, port, and IP-literal hosts. DNS-based
 * host validation happens in `guardedLookup` at connect time.
 */
export function validatePublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError("That doesn't look like a valid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError("Only http and https URLs are allowed");
  }
  if (url.username || url.password) {
    throw new SsrfError("URLs containing credentials are not allowed");
  }
  if (!url.hostname) {
    throw new SsrfError("URL has no host");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new SsrfError("Only standard web ports (80, 443) are allowed");
  }

  // If the host is a literal IP, reject private/reserved ranges right away.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && isBlockedIp(host)) {
    throw new SsrfError("That address is not allowed");
  }
  return url;
}

/**
 * A dns.lookup-compatible function for undici's connect step. It resolves the
 * hostname and rejects if ANY resolved address is private/reserved. Because
 * this is the same resolution used to open the socket, there is no
 * time-of-check/time-of-use gap for DNS rebinding.
 */
export function guardedLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (
    err: NodeJS.ErrnoException | null,
    address: string | dns.LookupAddress[],
    family?: number
  ) => void
): void {
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) {
      callback(err, "", undefined);
      return;
    }
    for (const a of addresses) {
      if (isBlockedIp(a.address)) {
        callback(
          new SsrfError("URL resolves to a disallowed address") as unknown as NodeJS.ErrnoException,
          "",
          undefined
        );
        return;
      }
    }
    if (options.all) {
      callback(null, addresses);
    } else {
      callback(null, addresses[0].address, addresses[0].family);
    }
  });
}

export interface SafeFetchOptions {
  maxBytes: number;
  timeoutMs: number;
  maxRedirects?: number;
  /** Optional Accept header value. */
  accept?: string;
}

export interface SafeFetchResult {
  body: Buffer;
  contentType: string;
  finalUrl: string;
}

async function readCapped(
  stream: AsyncIterable<Buffer>,
  maxBytes: number
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new FileTooLargeError("The document exceeds the maximum size");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Fetch a public URL with SSRF protection. Validates the URL and every
 * redirect hop, pins connections to validated IPs, and enforces a byte cap and
 * timeout. Returns the raw body plus content type and the final URL.
 */
export async function safeFetch(
  rawUrl: string,
  opts: SafeFetchOptions
): Promise<SafeFetchResult> {
  const maxRedirects = opts.maxRedirects ?? 3;
  let current = validatePublicUrl(rawUrl);

  const agent = new Agent({
    connect: { lookup: guardedLookup, timeout: opts.timeoutMs },
    headersTimeout: opts.timeoutMs,
    bodyTimeout: opts.timeoutMs,
  });

  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      // undici.request does not follow redirects by default, so 3xx responses
      // come back for us to validate and follow manually.
      const res = await undiciRequest(current.toString(), {
        dispatcher: agent,
        method: "GET",
        headers: {
          "user-agent": USER_AGENT,
          accept: opts.accept ?? "*/*",
        },
        signal: AbortSignal.timeout(opts.timeoutMs),
      });

      const status = res.statusCode;

      if (status >= 300 && status < 400) {
        const loc = res.headers.location;
        res.body.dump();
        const location = Array.isArray(loc) ? loc[0] : loc;
        if (!location) throw new FetchError("Redirect without a location");
        if (hop === maxRedirects) throw new FetchError("Too many redirects");
        current = validatePublicUrl(new URL(location, current).toString());
        continue;
      }

      if (status < 200 || status >= 300) {
        res.body.dump();
        throw new FetchError(`The server responded with status ${status}`);
      }

      const contentType = String(res.headers["content-type"] ?? "");
      const declaredLen = Number(res.headers["content-length"] ?? 0);
      if (declaredLen && declaredLen > opts.maxBytes) {
        res.body.dump();
        throw new FileTooLargeError("The document exceeds the maximum size");
      }

      const body = await readCapped(
        res.body as AsyncIterable<Buffer>,
        opts.maxBytes
      );
      return { body, contentType, finalUrl: current.toString() };
    }
    throw new FetchError("Too many redirects");
  } catch (err) {
    if (err instanceof SsrfError || err instanceof FileTooLargeError) throw err;
    if (err instanceof FetchError) throw err;
    // Normalize network/abort errors (including SsrfError surfaced via lookup).
    if (err instanceof Error && err.message.includes("disallowed address")) {
      throw new SsrfError("URL resolves to a disallowed address");
    }
    throw new FetchError("Could not reach the URL");
  } finally {
    await agent.close().catch(() => {});
  }
}
