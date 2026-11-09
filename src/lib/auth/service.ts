import "server-only";

import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  EmailInUseError,
  InvalidCredentialsError,
} from "@/lib/auth/errors";
import type { SignupInput, LoginInput } from "@/lib/validation/auth";
import type { SessionUser } from "@/lib/auth/session";

/** Normalize emails so lookups and uniqueness are case-insensitive. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Register a new account. Creates the user with a hashed password and a default
 * preferences row in one transaction. Throws EmailInUseError if taken.
 */
export async function registerUser(input: SignupInput): Promise<SessionUser> {
  const email = normalizeEmail(input.email);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) throw new EmailInUseError();

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name?.trim() || null,
      passwordHash,
      preference: { create: {} },
    },
    select: { id: true, email: true, name: true, image: true },
  });

  return user;
}

/**
 * Verify credentials. Returns the user on success, else throws
 * InvalidCredentialsError. Always runs a hash comparison, even when the user is
 * missing, to avoid leaking account existence through timing.
 */
export async function authenticateUser(
  input: LoginInput
): Promise<SessionUser> {
  const email = normalizeEmail(input.email);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      passwordHash: true,
    },
  });

  // Dummy hash used when the account does not exist, so the work done is
  // indistinguishable from a real verification.
  const hash =
    user?.passwordHash ??
    "$2b$12$C6UzMDM.H6dfI/f/IKcEeO0000000000000000000000000000000000";

  const ok = await verifyPassword(input.password, hash);
  if (!user || !user.passwordHash || !ok) {
    throw new InvalidCredentialsError();
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
  };
}
