import { describe, it, expect, beforeAll } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { registerUser } from "@/lib/auth/service";
import { ingestPaper } from "@/lib/documents/ingest";
import {
  getPreferences,
  updatePreferences,
  setApiKey,
  clearApiKey,
  getDecryptedKey,
} from "@/lib/preferences/service";
import { exportUserData, deleteUserData } from "@/lib/preferences/data-management";
import { getUsageSummary } from "@/lib/usage/service";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
let userA = "";
let userB = "";

beforeAll(async () => {
  userA = (await registerUser({ email: `set-${RUN}-a@example.test`, password: "password-123" })).id;
  userB = (await registerUser({ email: `set-${RUN}-b@example.test`, password: "password-123" })).id;
});

describe("preferences", () => {
  it("returns defaults for a new user", async () => {
    const p = await getPreferences(userA);
    expect(p.aiProvider).toBeNull();
    expect(p.outputLanguage).toBe("en");
    expect(p.theme).toBe("SYSTEM");
    expect(p.providersWithKey).toEqual([]);
  });

  it("updates provider/model/language/theme/prompts", async () => {
    const p = await updatePreferences(userA, {
      aiProvider: "openai",
      aiModel: "gpt-4o-mini",
      outputLanguage: "es",
      theme: "DARK",
      promptOverrides: { customInstructions: "Be concise." },
    });
    expect(p.aiProvider).toBe("openai");
    expect(p.aiModel).toBe("gpt-4o-mini");
    expect(p.outputLanguage).toBe("es");
    expect(p.theme).toBe("DARK");
    expect(p.promptOverrides.customInstructions).toBe("Be concise.");
  });
});

describe("API key storage", () => {
  it("stores a key encrypted and reports it as present without exposing it", async () => {
    await setApiKey(userA, "openai", "sk-live-SECRETKEY-123456");
    const p = await getPreferences(userA);
    expect(p.providersWithKey).toContain("openai");
    // The client-safe view must not carry the key anywhere.
    expect(JSON.stringify(p)).not.toContain("sk-live-SECRETKEY-123456");

    // The raw DB column holds ciphertext only, never the plaintext.
    const row = await prisma.userPreference.findUnique({ where: { userId: userA } });
    expect(JSON.stringify(row?.encryptedCredentials)).not.toContain(
      "sk-live-SECRETKEY-123456"
    );

    // Server-side decryption recovers it for provider calls.
    expect(await getDecryptedKey(userA, "openai")).toBe("sk-live-SECRETKEY-123456");
  });

  it("clears a stored key", async () => {
    await clearApiKey(userA, "openai");
    const p = await getPreferences(userA);
    expect(p.providersWithKey).not.toContain("openai");
    expect(await getDecryptedKey(userA, "openai")).toBeNull();
  });

  it("keys are per-user — user B cannot see user A's key", async () => {
    await setApiKey(userA, "openai", "sk-A-only-999");
    expect(await getDecryptedKey(userB, "openai")).toBeNull();
    await clearApiKey(userA, "openai");
  });
});

describe("usage summary", () => {
  it("aggregates real token counts and estimates cost (labeled estimate)", async () => {
    const paperId = (
      await ingestPaper(userA, {
        source: "PASTED_TEXT",
        title: "Usage Paper",
        text: "Some analyzable text for the usage aggregation integration test here.",
      })
    ).id;
    await prisma.paperAnalysis.create({
      data: { paperId, version: 1, status: "COMPLETED", tokensUsed: 2000 },
    });

    const u = await getUsageSummary(userA, "openai", "gpt-4o");
    expect(u.analysisTokens).toBeGreaterThanOrEqual(2000);
    expect(u.totalTokens).toBe(u.analysisTokens + u.chatTokens + u.agentTokens);
    expect(u.isEstimate).toBe(true);
    expect(u.estimatedCostUsd).not.toBeNull();

    // Demo/custom model → no cost estimate.
    const demoU = await getUsageSummary(userA, "demo", "demo");
    expect(demoU.estimatedCostUsd).toBeNull();
  });
});

describe("data management", () => {
  it("exports only the owner's data, without secrets", async () => {
    await setApiKey(userB, "openai", "sk-should-not-appear");
    await ingestPaper(userB, {
      source: "PASTED_TEXT",
      title: "User B Paper",
      text: "A paper that belongs to user B and should be in B's export only.",
    });
    const exp = await exportUserData(userB);
    expect(exp.papers.every((p) => p.ownerId === userB)).toBe(true);
    expect(exp.papers.some((p) => p.title === "User B Paper")).toBe(true);
    // No secrets leak into an export.
    expect(JSON.stringify(exp)).not.toContain("sk-should-not-appear");
    await clearApiKey(userB, "openai");
  });

  it("deletes the owner's research data but keeps the account + settings", async () => {
    await deleteUserData(userA);
    const papers = await prisma.paper.count({ where: { ownerId: userA } });
    expect(papers).toBe(0);
    // Account + preferences survive.
    const prefs = await getPreferences(userA);
    expect(prefs.outputLanguage).toBe("es"); // set earlier, still there
    const user = await prisma.user.findUnique({ where: { id: userA } });
    expect(user).not.toBeNull();
  });
});
