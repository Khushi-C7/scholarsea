import type { RetrievedPassage } from "@/lib/chat/types";
import type { Prompt } from "@/prompts/analysis";

export const CHAT_PROMPT_VERSION = "2026-10-18";

/**
 * Grounded-answer prompt. The model may use ONLY the numbered passages, and
 * must cite the ones it uses by passageId. It must never use outside knowledge
 * or invent sources, and must say the corpus is insufficient when the passages
 * do not answer the question.
 */
export function chatAnswerPrompt(input: {
  question: string;
  passages: RetrievedPassage[];
  history: { role: string; content: string }[];
  /** User's optional custom instructions (from Settings). */
  customInstructions?: string;
  /** User's output language code (e.g. "es"); English needs no note. */
  outputLanguage?: string;
}): Prompt {
  const passageText = input.passages
    .map((p) => `  ${p.passageId} (from "${p.paperTitle}"): "${p.passage}"`)
    .join("\n");

  const historyText = input.history
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  // User preferences are appended AFTER the grounding rules so they can shape
  // tone/format/language but never override the no-fabrication constraints.
  const lang =
    input.outputLanguage && input.outputLanguage !== "en"
      ? ` Write the answer in this language code: ${input.outputLanguage}.`
      : "";
  const custom = input.customInstructions?.trim()
    ? ` User preferences (do not override the rules above): ${input.customInstructions.trim()}`
    : "";

  const system =
    "You answer questions about a set of research papers using ONLY the retrieved passages provided. " +
    "Ground every claim in those passages and cite the ones you use by their passageId. " +
    "Never use outside knowledge, and never invent paper titles, authors, passages, or results. " +
    "If the passages do not contain enough to answer, set insufficient to true and say what is missing — do not guess. " +
    "Respond with ONLY a single JSON object, no prose or code fences." +
    lang +
    custom;

  const user =
    (historyText ? `Conversation so far:\n${historyText}\n\n` : "") +
    `Question: ${input.question}\n\n` +
    `Retrieved passages (cite by id; use ONLY these):\n${passageText || "  (none retrieved)"}\n\n` +
    `Return JSON:\n` +
    `- answer: your answer, grounded strictly in the passages above\n` +
    `- citedPassageIds: the passageIds you actually used\n` +
    `- insufficient: true if the passages don't contain enough to answer`;

  return { system, user };
}
