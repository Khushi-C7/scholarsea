import "server-only";

import { cookies } from "next/headers";

import { prisma } from "@/lib/db/prisma";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSessionToken,
  verifySessionToken,
} from "@/lib/auth/jwt";

/** The shape of the current user exposed to server code and the UI. */
export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

/** Issue a session cookie for a user (called after login/signup). */
export async function createSession(userId: string): Promise<void> {
  const token = await signSessionToken(userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Clear the session cookie (logout). */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Resolve the current user from the session cookie, or null if not signed in.
 * Verifies the token, then loads the user so a deleted account cannot keep a
 * valid-looking session. Selects only safe fields — never the password hash.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const claims = await verifySessionToken(token);
  if (!claims) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, email: true, name: true, image: true },
  });
  return user ?? null;
}
