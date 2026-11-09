import { SignJWT, jwtVerify } from "jose";

/**
 * Edge-safe session token helpers. Only depends on `jose`, so this module is
 * safe to import from middleware (Edge runtime) as well as from Node server
 * code. No database or Node-only APIs here.
 */

export const SESSION_COOKIE = "scholarsea_session";
const ALG = "HS256";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is not set or too short");
  }
  return new TextEncoder().encode(secret);
}

export interface SessionClaims {
  /** User id. */
  sub: string;
}

/** Sign a session token for a user id. */
export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

/**
 * Verify a session token. Returns the claims on success, or null if the token
 * is missing, malformed, tampered with, or expired. Never throws for an
 * invalid token — callers treat null as "not authenticated".
 */
export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: [ALG],
    });
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      return null;
    }
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE_SECONDS = MAX_AGE_SECONDS;
