import { describe, it, expect } from "vitest";

import { signSessionToken, verifySessionToken } from "@/lib/auth/jwt";

describe("session tokens", () => {
  it("round-trips a signed token back to its user id", async () => {
    const token = await signSessionToken("user_123");
    const claims = await verifySessionToken(token);
    expect(claims?.sub).toBe("user_123");
  });

  it("returns null for a tampered token", async () => {
    const token = await signSessionToken("user_123");
    // Flip the FIRST character of the signature — those bits are always
    // significant, so the HMAC no longer matches.
    const parts = token.split(".");
    const sig = parts[2];
    parts[2] = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
    expect(await verifySessionToken(parts.join("."))).toBeNull();
  });

  it("returns null for a garbage or empty token", async () => {
    expect(await verifySessionToken("not.a.jwt")).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
    expect(await verifySessionToken(undefined)).toBeNull();
  });

  it("returns null when signed with a different secret", async () => {
    const token = await signSessionToken("user_123");
    const original = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "a-completely-different-secret-value";
    try {
      expect(await verifySessionToken(token)).toBeNull();
    } finally {
      process.env.AUTH_SECRET = original;
    }
  });
});
