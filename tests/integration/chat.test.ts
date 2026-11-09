import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { registerUser } from "@/lib/auth/service";
import { ingestPaper } from "@/lib/documents/ingest";
import {
  createConversation,
  getConversationView,
  ask,
} from "@/lib/chat/service";
import { INSUFFICIENT_MESSAGE } from "@/lib/chat/answer";
import { NotFoundError } from "@/lib/auth/errors";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const emailA = `chat-${RUN}-a@example.test`;
const emailB = `chat-${RUN}-b@example.test`;
let userA = "";
let userB = "";
let paperA = "";
let paperB = "";

beforeAll(async () => {
  userA = (await registerUser({ email: emailA, password: "password-123" })).id;
  userB = (await registerUser({ email: emailB, password: "password-123" })).id;

  paperA = (
    await ingestPaper(userA, {
      source: "PASTED_TEXT",
      title: "A: Prototypical Leaf Disease",
      text:
        "We study few-shot leaf disease classification with prototypical networks. " +
        "On the PlantVillage benchmark we reach 78.4 percent accuracy. " +
        "Performance drops sharply under field conditions, which we do not evaluate.",
    })
  ).id;

  // User B owns a paper with a VERY distinctive secret token.
  paperB = (
    await ingestPaper(userB, {
      source: "PASTED_TEXT",
      title: "B: Secret Research",
      text:
        "This confidential study introduces the ZORBLAX quantum coherence protocol " +
        "achieving unprecedented ZORBLAX stability across all ZORBLAX regimes.",
    })
  ).id;
}, 60000);

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
  await prisma.$disconnect();
});

describe("conversation creation + ownership", () => {
  it("creates a conversation scoped to the user's own paper", async () => {
    const id = await createConversation(userA, { paperIds: [paperA] });
    const view = await getConversationView(userA, id);
    expect(view.paperIds).toEqual([paperA]);
  });

  it("refuses to scope a conversation to another user's paper", async () => {
    await expect(
      createConversation(userA, { paperIds: [paperB] })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses a mixed set containing another user's paper", async () => {
    await expect(
      createConversation(userA, { paperIds: [paperA, paperB] })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("hides another user's conversation (404 on view)", async () => {
    const id = await createConversation(userA, { paperIds: [paperA] });
    await expect(getConversationView(userB, id)).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});

describe("grounded answers + history", () => {
  it("answers from the scoped paper with a real citation, and persists history", async () => {
    const id = await createConversation(userA, { paperIds: [paperA] });
    const res = await ask(userA, id, "What accuracy on PlantVillage?");
    expect(res.insufficient).toBe(false);
    expect(res.assistantMessage.citations.length).toBeGreaterThan(0);
    // The cited passage must come from the user's own paper.
    for (const c of res.assistantMessage.citations) {
      expect(c.paperId).toBe(paperA);
    }

    // History preserved in order: USER then ASSISTANT.
    const view = await getConversationView(userA, id);
    expect(view.messages).toHaveLength(2);
    expect(view.messages[0].role).toBe("USER");
    expect(view.messages[1].role).toBe("ASSISTANT");
    expect(view.messages[0].content).toBe("What accuracy on PlantVillage?");

    // A second turn appends, preserving the first.
    await ask(userA, id, "What is the main limitation?");
    const view2 = await getConversationView(userA, id);
    expect(view2.messages).toHaveLength(4);
    expect(view2.messages[2].content).toBe("What is the main limitation?");
  }, 60000);

  it("abstains when the corpus has nothing relevant", async () => {
    const id = await createConversation(userA, { paperIds: [paperA] });
    const res = await ask(userA, id, "Explain lattice quantum chromodynamics");
    expect(res.insufficient).toBe(true);
    expect(res.assistantMessage.content).toBe(INSUFFICIENT_MESSAGE);
    expect(res.assistantMessage.citations).toHaveLength(0);
  }, 60000);
});

describe("cross-user leakage prevention", () => {
  it("never retrieves another user's paper content, even for its unique token", async () => {
    // User A asks about B's secret token. B's paper is not in A's corpus and
    // A does not own it, so retrieval can't reach it → abstain, no leak.
    const id = await createConversation(userA, { paperIds: [paperA] });
    const res = await ask(userA, id, "Tell me about the ZORBLAX quantum coherence protocol");
    expect(res.assistantMessage.content).not.toMatch(/ZORBLAX/i);
    for (const c of res.assistantMessage.citations) {
      expect(c.paperId).toBe(paperA);
      expect(c.passage).not.toMatch(/ZORBLAX/i);
    }
  }, 60000);
});
