import "server-only";

import type { Prisma, ThemePreference } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  encryptSecret,
  decryptSecret,
  asEnvelope,
  type EncryptedEnvelope,
} from "@/lib/crypto/credentials";

/**
 * Client-safe view of a user's settings. Note what is NOT here: no API keys,
 * encrypted or otherwise. The only thing the browser learns about a stored key
 * is which providers have one (`providersWithKey`).
 */
export interface PreferencesView {
  aiProvider: string | null;
  aiModel: string | null;
  outputLanguage: string;
  theme: ThemePreference;
  promptOverrides: Record<string, string>;
  /** Provider ids that currently have a stored (encrypted) key. */
  providersWithKey: string[];
}

const DEFAULTS: Omit<PreferencesView, "providersWithKey"> = {
  aiProvider: null,
  aiModel: null,
  outputLanguage: "en",
  theme: "SYSTEM",
  promptOverrides: {},
};

function overridesFromJson(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string" && val.trim()) out[k] = val;
  }
  return out;
}

function credentialsMap(v: unknown): Record<string, EncryptedEnvelope> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, EncryptedEnvelope> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const env = asEnvelope(val);
    if (env) out[k] = env;
  }
  return out;
}

export async function getPreferences(userId: string): Promise<PreferencesView> {
  const row = await prisma.userPreference.findUnique({ where: { userId } });
  if (!row) return { ...DEFAULTS, providersWithKey: [] };
  return {
    aiProvider: row.aiProvider,
    aiModel: row.aiModel,
    outputLanguage: row.outputLanguage,
    theme: row.theme,
    promptOverrides: overridesFromJson(row.promptOverrides),
    providersWithKey: Object.keys(credentialsMap(row.encryptedCredentials)),
  };
}

export interface PreferencesPatch {
  aiProvider?: string | null;
  aiModel?: string | null;
  outputLanguage?: string;
  theme?: ThemePreference;
  promptOverrides?: Record<string, string>;
}

export async function updatePreferences(
  userId: string,
  patch: PreferencesPatch
): Promise<PreferencesView> {
  const data: Prisma.UserPreferenceUncheckedUpdateInput = {};
  if (patch.aiProvider !== undefined) data.aiProvider = patch.aiProvider;
  if (patch.aiModel !== undefined) data.aiModel = patch.aiModel;
  if (patch.outputLanguage !== undefined) data.outputLanguage = patch.outputLanguage;
  if (patch.theme !== undefined) data.theme = patch.theme;
  if (patch.promptOverrides !== undefined) {
    data.promptOverrides = patch.promptOverrides as Prisma.InputJsonValue;
  }

  await prisma.userPreference.upsert({
    where: { userId },
    create: {
      userId,
      aiProvider: patch.aiProvider ?? null,
      aiModel: patch.aiModel ?? null,
      outputLanguage: patch.outputLanguage ?? "en",
      theme: patch.theme ?? "SYSTEM",
      promptOverrides: (patch.promptOverrides ?? {}) as Prisma.InputJsonValue,
    },
    update: data,
  });
  return getPreferences(userId);
}

/** Store (encrypt) an API key for a provider. Plaintext is never persisted. */
export async function setApiKey(
  userId: string,
  providerId: string,
  key: string
): Promise<void> {
  const row = await prisma.userPreference.findUnique({ where: { userId } });
  const map = credentialsMap(row?.encryptedCredentials);
  map[providerId] = encryptSecret(key);
  const json = map as unknown as Prisma.InputJsonValue;
  await prisma.userPreference.upsert({
    where: { userId },
    create: { userId, encryptedCredentials: json },
    update: { encryptedCredentials: json },
  });
}

/** Remove a stored key for a provider. */
export async function clearApiKey(
  userId: string,
  providerId: string
): Promise<void> {
  const row = await prisma.userPreference.findUnique({ where: { userId } });
  if (!row) return;
  const map = credentialsMap(row.encryptedCredentials);
  delete map[providerId];
  await prisma.userPreference.update({
    where: { userId },
    data: { encryptedCredentials: map as unknown as Prisma.InputJsonValue },
  });
}

/**
 * Decrypt a stored key for server-side use only (provider calls, connection
 * tests). Returns null when no key is stored. Never call this from a path that
 * returns the value to the client.
 */
export async function getDecryptedKey(
  userId: string,
  providerId: string
): Promise<string | null> {
  const row = await prisma.userPreference.findUnique({ where: { userId } });
  if (!row) return null;
  const env = credentialsMap(row.encryptedCredentials)[providerId];
  if (!env) return null;
  try {
    return decryptSecret(env);
  } catch {
    return null;
  }
}
