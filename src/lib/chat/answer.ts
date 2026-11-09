/**
 * Turn retrieved passages + a model answer into a grounded, cited reply.
 * Pure (no DB/AI) so it is fully testable. The citation firewall mirrors the
 * gap explorer: the model cites passageIds, and we resolve them against the
 * real retrieved set — invented ids are dropped.
 */
import type { RetrievedPassage, Citation } from "@/lib/chat/types";
import type { ChatAnswer } from "@/lib/validation/chat";

export const INSUFFICIENT_MESSAGE =
  "I couldn't find enough in the selected papers to answer that. Try rephrasing, or add and analyze more papers to this conversation's corpus.";

export interface GroundedAnswer {
  content: string;
  citations: Citation[];
  insufficient: boolean;
}

/**
 * Resolve a model answer against the retrieved passages.
 *
 * - If retrieval found nothing, or the model flagged insufficient, or none of
 *   its cited ids resolve to a real retrieved passage, we return the explicit
 *   insufficient message with no citations — never an ungrounded answer.
 * - Otherwise citations are the real passages the model cited (invented ids
 *   dropped); if it cited none but passages were retrieved, we attach the top
 *   retrieved passage so the answer is never shown without a source.
 */
export function groundAnswer(
  model: ChatAnswer,
  retrieved: RetrievedPassage[]
): GroundedAnswer {
  if (retrieved.length === 0 || model.insufficient) {
    return { content: INSUFFICIENT_MESSAGE, citations: [], insufficient: true };
  }

  const byId = new Map(retrieved.map((p) => [p.passageId, p]));
  const seen = new Set<string>();
  const citations: Citation[] = [];
  for (const id of model.citedPassageIds) {
    const p = byId.get(id);
    if (!p) continue; // invented id — dropped
    const key = `${p.paperId}::${p.passage}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({ paperId: p.paperId, paperTitle: p.paperTitle, passage: p.passage });
  }

  if (citations.length === 0) {
    // The model produced an answer but grounded it in nothing real. Rather
    // than present an uncited claim, fall back to the top retrieved passage.
    const top = retrieved[0];
    citations.push({
      paperId: top.paperId,
      paperTitle: top.paperTitle,
      passage: top.passage,
    });
  }

  return { content: model.answer.trim(), citations, insufficient: false };
}

/**
 * Deterministic demo answerer: an extractive reply built from the top
 * retrieved passages, citing them. Used when no AI key is configured and in
 * tests, exercising the same grounding path as the real model.
 */
export function demoAnswer(
  question: string,
  retrieved: RetrievedPassage[]
): ChatAnswer {
  if (retrieved.length === 0) {
    return { answer: "", citedPassageIds: [], insufficient: true };
  }
  const used = retrieved.slice(0, 3);
  const answer =
    `Based on the selected papers, the most relevant passages are:\n\n` +
    used
      .map((p) => `• (${p.paperTitle}) ${p.passage}`)
      .join("\n\n") +
    `\n\n(Demo mode: this is an extractive answer drawn directly from the retrieved passages, not a model-generated synthesis.)`;
  return {
    answer,
    citedPassageIds: used.map((p) => p.passageId),
    insufficient: false,
  };
}
