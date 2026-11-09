import { describe, it, expect } from "vitest";

import { validatePublicUrl, safeFetch } from "@/lib/documents/ssrf";
import { SsrfError } from "@/lib/documents/errors";

describe("validatePublicUrl — rejects unsafe URLs", () => {
  const bad: [string, string][] = [
    ["file:///etc/passwd", "file protocol"],
    ["ftp://example.com/x", "ftp protocol"],
    ["gopher://example.com", "gopher protocol"],
    ["data:text/plain,hi", "data protocol"],
    ["javascript:alert(1)", "javascript protocol"],
    ["http://user:pass@example.com", "embedded credentials"],
    ["http://127.0.0.1/", "loopback IP literal"],
    ["http://169.254.169.254/latest/meta-data", "metadata IP literal"],
    ["http://[::1]/", "IPv6 loopback literal"],
    ["http://10.0.0.5/", "private IP literal"],
    ["http://example.com:22/", "non-web port"],
    ["http://example.com:8080/", "non-web port 8080"],
    ["not-a-url", "malformed"],
  ];
  for (const [url, why] of bad) {
    it(`rejects ${why}: ${url}`, () => {
      expect(() => validatePublicUrl(url)).toThrow(SsrfError);
    });
  }
});

describe("validatePublicUrl — accepts safe public URLs", () => {
  const good = [
    "https://arxiv.org/abs/2401.00001",
    "http://example.com/paper.pdf",
    "https://example.com:443/x",
    "http://example.com:80/x",
  ];
  for (const url of good) {
    it(`accepts ${url}`, () => {
      expect(() => validatePublicUrl(url)).not.toThrow();
    });
  }
});

describe("safeFetch — blocks hostnames that resolve to private IPs", () => {
  it("blocks localhost (resolves to loopback)", async () => {
    await expect(
      safeFetch("http://localhost/", { maxBytes: 1000, timeoutMs: 3000 })
    ).rejects.toBeInstanceOf(SsrfError);
  });

  it("blocks a loopback IP literal before any connection", async () => {
    await expect(
      safeFetch("http://127.0.0.1:3000/", { maxBytes: 1000, timeoutMs: 3000 })
    ).rejects.toBeInstanceOf(SsrfError);
  });

  it("blocks the cloud metadata endpoint", async () => {
    await expect(
      safeFetch("http://169.254.169.254/", { maxBytes: 1000, timeoutMs: 3000 })
    ).rejects.toBeInstanceOf(SsrfError);
  });
});
