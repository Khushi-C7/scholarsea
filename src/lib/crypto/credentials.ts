import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

import { getServerEnv } from "@/lib/env";

/**
 * Authenticated symmetric encryption for user-supplied provider API keys.
 *
 * Keys are encrypted with AES-256-GCM at the application layer before they are
 * ever written to the database; only this ciphertext envelope is persisted.
 * Plaintext keys never touch the DB, never leave the server, and are never
 * returned to the browser (the API only ever reports whether a key is set).
 *
 * The master key comes from CREDENTIAL_ENCRYPTION_KEY; if that is unset we
 * fall back to deriving from AUTH_SECRET so development works, but production
 * should set a dedicated key.
 */

const ALGO = "aes-256-gcm";
const SALT = "scholarsea.credential.v1"; // fixed salt → stable key derivation

export interface EncryptedEnvelope {
  v: 1;
  iv: string; // base64
  tag: string; // base64 auth tag
  ct: string; // base64 ciphertext
}

function masterKey(): Buffer {
  const env = getServerEnv();
  const secret = env.CREDENTIAL_ENCRYPTION_KEY || env.AUTH_SECRET;
  // scrypt derives a 32-byte key regardless of the secret's length.
  return scryptSync(secret, SALT, 32);
}

/** Encrypt a plaintext secret into a storable envelope. */
export function encryptSecret(plaintext: string): EncryptedEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, masterKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ct: ct.toString("base64"),
  };
}

/** Decrypt an envelope back to plaintext. Throws if tampered or wrong key. */
export function decryptSecret(env: EncryptedEnvelope): string {
  const decipher = createDecipheriv(
    ALGO,
    masterKey(),
    Buffer.from(env.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(env.tag, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(env.ct, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}

/** Narrow unknown JSON (from the DB) to a valid envelope, or null. */
export function asEnvelope(value: unknown): EncryptedEnvelope | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  if (
    o.v === 1 &&
    typeof o.iv === "string" &&
    typeof o.tag === "string" &&
    typeof o.ct === "string"
  ) {
    return { v: 1, iv: o.iv, tag: o.tag, ct: o.ct };
  }
  return null;
}
