import bcrypt from "bcryptjs";

// Work factor for bcrypt. 12 is a reasonable 2020s default: strong, and still
// fast enough for interactive login.
const ROUNDS = 12;

/** Hash a plaintext password for storage. Never store plaintext. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

/** Verify a plaintext password against a stored bcrypt hash. */
export function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
