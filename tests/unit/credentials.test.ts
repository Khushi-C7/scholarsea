import { describe, it, expect } from "vitest";

import {
  encryptSecret,
  decryptSecret,
  asEnvelope,
} from "@/lib/crypto/credentials";

describe("credential encryption", () => {
  it("round-trips a secret through encrypt/decrypt", () => {
    const secret = "sk-test-ABCDEF0123456789";
    const env = encryptSecret(secret);
    expect(decryptSecret(env)).toBe(secret);
  });

  it("never stores the plaintext in the envelope", () => {
    const secret = "sk-super-secret-value-xyz";
    const env = encryptSecret(secret);
    const serialized = JSON.stringify(env);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("super-secret");
  });

  it("produces a fresh IV each time (ciphertext differs for same input)", () => {
    const a = encryptSecret("same-input");
    const b = encryptSecret("same-input");
    expect(a.ct).not.toBe(b.ct);
    expect(a.iv).not.toBe(b.iv);
  });

  it("rejects a tampered ciphertext (GCM auth tag)", () => {
    const env = encryptSecret("tamper-me");
    const bad = { ...env, ct: Buffer.from("garbage").toString("base64") };
    expect(() => decryptSecret(bad)).toThrow();
  });

  it("asEnvelope validates shape", () => {
    const env = encryptSecret("x-value-123");
    expect(asEnvelope(env)).not.toBeNull();
    expect(asEnvelope({ v: 2, iv: "a", tag: "b", ct: "c" })).toBeNull();
    expect(asEnvelope(null)).toBeNull();
    expect(asEnvelope("nope")).toBeNull();
  });
});
