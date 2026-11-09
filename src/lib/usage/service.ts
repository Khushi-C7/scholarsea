import "server-only";

import { prisma } from "@/lib/db/prisma";
import { findModel, estimateCost } from "@/lib/ai/catalog";

/**
 * Real token usage for a user, aggregated from persisted `tokensUsed` columns
 * on analyses, chat messages, and agent sessions. These are the actual counts
 * providers reported at generation time — not a guess.
 *
 * The dollar figure is a rough ESTIMATE: provider usage records only store a
 * total token count, so we split it 50/50 between input/output and multiply by
 * approximate list prices. Callers must label it as an estimate; `isEstimate`
 * is always true.
 */
export interface UsageSummary {
  analysisTokens: number;
  chatTokens: number;
  agentTokens: number;
  totalTokens: number;
  /** Null when the active model has no known price (e.g. demo/custom). */
  estimatedCostUsd: number | null;
  isEstimate: true;
  pricedModel: string | null;
}

export async function getUsageSummary(
  userId: string,
  providerId: string | null,
  modelId: string | null
): Promise<UsageSummary> {
  const [analysis, chat, agent] = await Promise.all([
    prisma.paperAnalysis.aggregate({
      _sum: { tokensUsed: true },
      where: { paper: { ownerId: userId } },
    }),
    prisma.chatMessage.aggregate({
      _sum: { tokensUsed: true },
      where: { conversation: { ownerId: userId } },
    }),
    prisma.agentSession.aggregate({
      _sum: { tokensUsed: true },
      where: { ownerId: userId },
    }),
  ]);

  const analysisTokens = analysis._sum.tokensUsed ?? 0;
  const chatTokens = chat._sum.tokensUsed ?? 0;
  const agentTokens = agent._sum.tokensUsed ?? 0;
  const totalTokens = analysisTokens + chatTokens + agentTokens;

  const model = findModel(providerId, modelId);
  // Usage records store only a total; split evenly for the estimate.
  const half = totalTokens / 2;
  const estimatedCostUsd = estimateCost(model, half, half);

  return {
    analysisTokens,
    chatTokens,
    agentTokens,
    totalTokens,
    estimatedCostUsd,
    isEstimate: true,
    pricedModel: model ? model.label : null,
  };
}
