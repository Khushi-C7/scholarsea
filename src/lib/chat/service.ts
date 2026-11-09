import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  getOwnedProject,
  getOwnedConversation,
} from "@/lib/auth/guards";
import { NotFoundError } from "@/lib/auth/errors";
import { getProviderForUser } from "@/lib/ai/provider";
import { getPreferences } from "@/lib/preferences/service";
import { completeJson } from "@/lib/ai/complete";
import { retrieve } from "@/lib/chat/retrieval";
import { groundAnswer, demoAnswer, INSUFFICIENT_MESSAGE } from "@/lib/chat/answer";
import { chatAnswerSchema } from "@/lib/validation/chat";
import { chatAnswerPrompt } from "@/prompts/chat";
import type {
  ConversationView,
  ChatMessageView,
  Citation,
  RetrievalDoc,
} from "@/lib/chat/types";
import type {
  CreateConversationInput,
} from "@/lib/validation/chat";

function toCitations(v: unknown): Citation[] {
  if (!Array.isArray(v)) return [];
  const out: Citation[] = [];
  for (const c of v) {
    if (c && typeof c === "object") {
      const o = c as Record<string, unknown>;
      if (typeof o.paperId === "string" && typeof o.passage === "string") {
        out.push({
          paperId: o.paperId,
          paperTitle: typeof o.paperTitle === "string" ? o.paperTitle : "",
          passage: o.passage,
        });
      }
    }
  }
  return out;
}

/**
 * Load the conversation's corpus, strictly filtered to papers the user owns
 * AND that are in the conversation's scope. This is the single choke point
 * that prevents one user's papers from leaking into another's answers.
 */
async function loadCorpus(
  userId: string,
  paperIds: string[]
): Promise<RetrievalDoc[]> {
  if (paperIds.length === 0) return [];
  const papers = await prisma.paper.findMany({
    where: { id: { in: paperIds }, ownerId: userId }, // owner + scope
    select: { id: true, title: true, fullText: true },
  });
  const docs: RetrievalDoc[] = [];
  for (const p of papers) {
    const claims = await prisma.extractedClaim.findMany({
      where: { paperId: p.id, paper: { ownerId: userId } },
      select: { supportingPassage: true },
    });
    docs.push({
      paperId: p.id,
      paperTitle: p.title,
      fullText: p.fullText,
      claimPassages: claims.map((c) => c.supportingPassage),
    });
  }
  return docs;
}

export async function createConversation(
  userId: string,
  input: CreateConversationInput
): Promise<string> {
  // Every scoped paper must belong to the user.
  const owned = await prisma.paper.findMany({
    where: { id: { in: input.paperIds }, ownerId: userId },
    select: { id: true, title: true },
  });
  if (owned.length !== new Set(input.paperIds).size) {
    throw new NotFoundError("One or more papers were not found");
  }
  if (input.projectId) await getOwnedProject(input.projectId, userId);

  const title =
    input.title?.trim() ||
    (owned.length === 1 ? owned[0].title.slice(0, 120) : `${owned.length} papers`);

  const conv = await prisma.conversation.create({
    data: {
      ownerId: userId,
      projectId: input.projectId ?? null,
      title,
      paperIds: Array.from(new Set(input.paperIds)),
    },
    select: { id: true },
  });
  return conv.id;
}

export interface ConversationListItem {
  id: string;
  title: string | null;
  paperCount: number;
  messageCount: number;
  updatedAt: string;
}

export async function listConversations(
  userId: string
): Promise<ConversationListItem[]> {
  const rows = await prisma.conversation.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      title: true,
      paperIds: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    paperCount: r.paperIds.length,
    messageCount: r._count.messages,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

function toMessageView(m: {
  id: string;
  role: string;
  content: string;
  citations: unknown;
  createdAt: Date;
}): ChatMessageView {
  const citations = toCitations(m.citations);
  return {
    id: m.id,
    role: m.role as ChatMessageView["role"],
    content: m.content,
    citations,
    insufficient:
      m.role === "ASSISTANT" && citations.length === 0 && m.content === INSUFFICIENT_MESSAGE,
    createdAt: m.createdAt.toISOString(),
  };
}

export async function getConversationView(
  userId: string,
  conversationId: string
): Promise<ConversationView> {
  const conv = await getOwnedConversation(conversationId, userId); // 404 if not owned
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, citations: true, createdAt: true },
  });
  return {
    id: conv.id,
    title: conv.title,
    projectId: conv.projectId,
    paperIds: conv.paperIds,
    messages: messages.map(toMessageView),
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
  };
}

export interface AskResult {
  userMessage: ChatMessageView;
  assistantMessage: ChatMessageView;
  insufficient: boolean;
  demo: boolean;
}

/**
 * Ask a question in a conversation. Retrieves over the owner+scope-filtered
 * corpus, grounds the answer in retrieved passages, persists both messages,
 * and bumps the conversation timestamp. Abstains (insufficient message) when
 * retrieval finds nothing relevant.
 */
export async function ask(
  userId: string,
  conversationId: string,
  question: string
): Promise<AskResult> {
  const conv = await getOwnedConversation(conversationId, userId);

  const priorRows = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });
  const history = priorRows.map((m) => ({ role: m.role, content: m.content }));

  const docs = await loadCorpus(userId, conv.paperIds);
  const retrieval = retrieve(question, docs);

  let content: string;
  let citations: Citation[];
  let insufficient: boolean;
  let demo = true;

  if (retrieval.insufficient) {
    content = INSUFFICIENT_MESSAGE;
    citations = [];
    insufficient = true;
  } else {
    const [provider, prefs] = await Promise.all([
      getProviderForUser(userId),
      getPreferences(userId),
    ]);
    const { data: answer, demo: isDemo } = await completeJson({
      provider,
      schema: chatAnswerSchema,
      ...chatAnswerPrompt({
        question,
        passages: retrieval.passages,
        history,
        customInstructions: prefs.promptOverrides.customInstructions,
        outputLanguage: prefs.outputLanguage,
      }),
      demo: () => demoAnswer(question, retrieval.passages),
    });
    demo = isDemo;
    const grounded = groundAnswer(answer, retrieval.passages);
    content = grounded.content;
    citations = grounded.citations;
    insufficient = grounded.insufficient;
  }

  const [userMessage, assistantMessage] = await prisma.$transaction(async (tx) => {
    const u = await tx.chatMessage.create({
      data: { conversationId, role: "USER", content: question },
      select: { id: true, role: true, content: true, citations: true, createdAt: true },
    });
    const a = await tx.chatMessage.create({
      data: {
        conversationId,
        role: "ASSISTANT",
        content,
        citations: citations.length
          ? (citations as unknown as Prisma.InputJsonValue)
          : undefined,
      },
      select: { id: true, role: true, content: true, citations: true, createdAt: true },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return [u, a];
  });

  return {
    userMessage: toMessageView(userMessage),
    assistantMessage: toMessageView(assistantMessage),
    insufficient,
    demo,
  };
}
