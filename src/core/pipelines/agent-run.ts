import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  getOwnedProject,
  getOwnedAgentSession,
} from "@/lib/auth/guards";
import { AppError } from "@/lib/auth/errors";
import { getProvider } from "@/lib/ai/provider";
import { completeJson } from "@/lib/ai/complete";
import { retrieve } from "@/lib/chat/retrieval";
import type { RetrievalDoc } from "@/lib/chat/types";
import { PLAN, DEFAULT_LIMITS, goalToQuery } from "@/lib/agent/plan";
import { checkBudget, breachMessage } from "@/lib/agent/budget";
import { wrapUntrusted } from "@/lib/agent/sanitize";
import { agentSynthesisPrompt } from "@/prompts/agent";
import { agentSynthesisSchema, type AgentSynthesis } from "@/lib/validation/agent";
import type { AgentLimits, AgentCitation } from "@/lib/agent/types";

const RETRIEVE_TOP_PAPERS = 5;
const SYNTH_PASSAGES = 8;

function asJson(v: unknown): Prisma.InputJsonValue | undefined {
  return v === null || v === undefined ? undefined : (v as Prisma.InputJsonValue);
}

/** Create a session with the fixed bounded plan; all steps start PENDING. */
export async function createAgentSession(
  userId: string,
  goal: string,
  projectId?: string
): Promise<string> {
  if (projectId) await getOwnedProject(projectId, userId);
  const session = await prisma.agentSession.create({
    data: {
      ownerId: userId,
      projectId: projectId ?? null,
      goal,
      status: "PENDING",
      limits: DEFAULT_LIMITS as unknown as Prisma.InputJsonValue,
      tokensUsed: 0,
      steps: {
        create: PLAN.map((p, i) => ({
          index: i,
          type: p.type,
          toolName: p.toolName,
          status: "PENDING",
          input: { intent: p.intent },
        })),
      },
    },
    select: { id: true },
  });
  return session.id;
}

/** Load the owner's scoped corpus (project papers, or all completed papers). */
async function loadScopeDocs(
  userId: string,
  projectId: string | null
): Promise<RetrievalDoc[]> {
  const paperWhere = projectId
    ? { ownerId: userId, projectPapers: { some: { projectId } } }
    : { ownerId: userId, extractionStatus: "COMPLETED" as const };
  const papers = await prisma.paper.findMany({
    where: paperWhere,
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

interface StepOutputs {
  [index: number]: Record<string, unknown>;
}

/** Read completed steps' stored outputs so a step can use prior results. */
async function priorOutputs(sessionId: string): Promise<StepOutputs> {
  const rows = await prisma.agentStep.findMany({
    where: { sessionId, status: "COMPLETED" },
    select: { index: true, output: true },
  });
  const out: StepOutputs = {};
  for (const r of rows) {
    out[r.index] =
      r.output && typeof r.output === "object"
        ? (r.output as Record<string, unknown>)
        : {};
  }
  return out;
}

export interface AdvanceResult {
  done: boolean;
  status: string;
}

/**
 * Execute the next PENDING step of a session. Enforces the budget before
 * running, persists the step's status/output, and on the final step writes the
 * session's answer + citations. Returns whether the run is finished.
 */
export async function advanceAgent(
  userId: string,
  sessionId: string
): Promise<AdvanceResult> {
  const session = await getOwnedAgentSession(sessionId, userId);
  if (session.status === "CANCELLED")
    throw new AppError("This run was cancelled", 409, "run_cancelled");
  if (session.status === "COMPLETED" || session.status === "FAILED") {
    return { done: true, status: session.status };
  }

  const limits = (session.limits as unknown as AgentLimits) ?? DEFAULT_LIMITS;
  const next = await prisma.agentStep.findFirst({
    where: { sessionId, status: "PENDING" },
    orderBy: { index: "asc" },
  });
  if (!next) {
    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: "COMPLETED" },
    });
    return { done: true, status: "COMPLETED" };
  }

  // Count prior tool calls (completed/failed steps that used a tool).
  const usedToolCalls = await prisma.agentStep.count({
    where: { sessionId, status: { in: ["COMPLETED", "FAILED"] }, NOT: { toolName: null } },
  });
  const startedAtMs = session.createdAt.getTime();
  const breach = checkBudget(
    { toolCallsUsed: usedToolCalls, tokensUsed: session.tokensUsed ?? 0, startedAtMs },
    limits,
    Date.now()
  );
  if (breach) {
    await prisma.$transaction([
      prisma.agentStep.update({
        where: { id: next.id },
        data: { status: "CANCELLED", error: breachMessage(breach, limits) },
      }),
      prisma.agentSession.update({
        where: { id: sessionId },
        data: { status: "FAILED", error: breachMessage(breach, limits) },
      }),
    ]);
    return { done: true, status: "FAILED" };
  }

  // Mark session running + step processing.
  await prisma.agentStep.update({
    where: { id: next.id },
    data: { status: "PROCESSING", startedAt: new Date() },
  });
  if (session.status !== "PROCESSING") {
    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: "PROCESSING" },
    });
  }

  try {
    const outputs = await priorOutputs(sessionId);
    const { output, summary, tokens, final } = await runStep(
      userId,
      session,
      next.type,
      outputs
    );

    await prisma.$transaction(async (tx) => {
      await tx.agentStep.update({
        where: { id: next.id },
        data: {
          status: "COMPLETED",
          output: asJson({ ...output, summary }),
          finishedAt: new Date(),
        },
      });
      const data: Prisma.AgentSessionUpdateInput = {
        tokensUsed: (session.tokensUsed ?? 0) + tokens,
      };
      if (final) {
        data.finalAnswer = final.answer;
        data.citations = asJson(final.citations);
        data.status = "COMPLETED";
      }
      await tx.agentSession.update({ where: { id: sessionId }, data });
    });

    return { done: Boolean(final), status: final ? "COMPLETED" : "PROCESSING" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Step failed";
    await prisma.agentStep.update({
      where: { id: next.id },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    });
    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: "FAILED", error: message },
    });
    return { done: true, status: "FAILED" };
  }
}

interface StepResult {
  output: Record<string, unknown>;
  summary: string;
  tokens: number;
  final?: { answer: string; citations: AgentCitation[] };
}

/** Execute one step's logic. Pure-ish: reads DB for corpus, no mutation. */
async function runStep(
  userId: string,
  session: { goal: string; projectId: string | null },
  type: string,
  outputs: StepOutputs
): Promise<StepResult> {
  const query = goalToQuery(session.goal);

  switch (type) {
    case "PLAN":
      return {
        output: { query, steps: PLAN.map((p) => p.type) },
        summary: `Planned ${PLAN.length} bounded steps.`,
        tokens: 0,
      };

    case "SEARCH": {
      const docs = await loadScopeDocs(userId, session.projectId);
      const result = retrieve(query, docs, { topK: 12 });
      // Rank candidate papers by their best passage score.
      const best = new Map<string, { title: string; score: number }>();
      for (const p of result.passages) {
        const cur = best.get(p.paperId);
        if (!cur || p.score > cur.score)
          best.set(p.paperId, { title: p.paperTitle, score: p.score });
      }
      const candidates = Array.from(best.entries())
        .map(([paperId, v]) => ({ paperId, title: v.title, score: v.score }))
        .sort((a, b) => b.score - a.score);
      return {
        output: { candidates, corpusPapers: docs.length },
        summary:
          candidates.length === 0
            ? `No relevant papers found among ${docs.length} in scope.`
            : `Found ${candidates.length} relevant paper(s) in a corpus of ${docs.length}.`,
        tokens: 0,
      };
    }

    case "RETRIEVE": {
      const candidates = (outputs[1]?.candidates as { paperId: string; title: string }[]) ?? [];
      const selected = candidates.slice(0, RETRIEVE_TOP_PAPERS);
      return {
        output: { selected },
        summary: `Selected ${selected.length} paper(s) into the working set.`,
        tokens: 0,
      };
    }

    case "ANALYZE": {
      const selected = (outputs[2]?.selected as { paperId: string }[]) ?? [];
      const ids = selected.map((s) => s.paperId);
      const papers = await prisma.paper.findMany({
        where: { id: { in: ids }, ownerId: userId },
        select: {
          id: true,
          title: true,
          analyses: {
            orderBy: { version: "desc" },
            take: 1,
            select: { researchProblem: true, methodology: true, results: true, limitations: true },
          },
        },
      });
      const analyzed = papers.map((p) => {
        const a = p.analyses[0];
        return {
          paperId: p.id,
          title: p.title,
          hasAnalysis: Boolean(a),
          researchProblem: a?.researchProblem ?? null,
        };
      });
      const withAnalysis = analyzed.filter((a) => a.hasAnalysis).length;
      return {
        output: { analyzed },
        summary: `Analyzed ${analyzed.length} paper(s); ${withAnalysis} had a prior analysis.`,
        tokens: 0,
      };
    }

    case "COMPARE": {
      const selected = (outputs[2]?.selected as { paperId: string }[]) ?? [];
      const ids = selected.map((s) => s.paperId);
      const docs = (await loadScopeDocs(userId, session.projectId)).filter((d) =>
        ids.includes(d.paperId)
      );
      // Light cross-paper observation: shared vs distinct via retrieval overlap.
      const summary =
        docs.length < 2
          ? "Only one paper in the working set — no cross-paper comparison."
          : `Compared ${docs.length} papers for shared themes and differences.`;
      return {
        output: {
          patternSummary:
            docs.length >= 2
              ? `${docs.length} papers compared for overlapping findings and gaps.`
              : "",
          comparedPapers: docs.length,
        },
        summary,
        tokens: 0,
      };
    }

    case "SYNTHESIZE": {
      const selected = (outputs[2]?.selected as { paperId: string }[]) ?? [];
      const ids = selected.map((s) => s.paperId);
      const allDocs = await loadScopeDocs(userId, session.projectId);
      const docs = allDocs.filter((d) => ids.includes(d.paperId));
      const retrieval = retrieve(query, docs, { topK: SYNTH_PASSAGES });
      const patternSummary = (outputs[4]?.patternSummary as string) ?? "";

      if (retrieval.insufficient) {
        return {
          output: { citations: [] },
          summary: "Insufficient evidence in the working set.",
          tokens: 0,
          final: {
            answer:
              "The selected papers do not contain enough to answer this goal. Add or analyze more relevant papers and run the agent again.",
            citations: [],
          },
        };
      }

      const provider = getProvider();
      const passages = retrieval.passages.map((p) => ({
        passageId: p.passageId,
        wrapped: wrapUntrusted(p.paperTitle, p.paperId, p.passage),
      }));
      const { data, usage, demo } = await completeJson<AgentSynthesis>({
        provider,
        schema: agentSynthesisSchema,
        ...agentSynthesisPrompt({ goal: session.goal, passages, patternSummary }),
        demo: () => demoSynthesis(retrieval.passages),
      });

      // Resolve cited ids to real passages (drop invented ids).
      const byId = new Map(retrieval.passages.map((p) => [p.passageId, p]));
      const seen = new Set<string>();
      const citations: AgentCitation[] = [];
      for (const id of data.citedPassageIds) {
        const p = byId.get(id);
        if (!p) continue;
        const key = `${p.paperId}::${p.passage}`;
        if (seen.has(key)) continue;
        seen.add(key);
        citations.push({ paperId: p.paperId, paperTitle: p.paperTitle, passage: p.passage });
      }
      // Never present an answer with no real source.
      if (citations.length === 0 && !data.insufficient) {
        const top = retrieval.passages[0];
        citations.push({ paperId: top.paperId, paperTitle: top.paperTitle, passage: top.passage });
      }

      const answer = data.insufficient
        ? "The selected papers do not contain enough to answer this goal confidently."
        : data.answer.trim();

      return {
        output: { citations },
        summary: `Synthesized an answer with ${citations.length} citation(s).${demo ? " (demo mode)" : ""}`,
        tokens: usage.totalTokens,
        final: { answer, citations },
      };
    }

    default:
      return { output: {}, summary: "No-op.", tokens: 0 };
  }
}

/** Deterministic demo synthesis: extractive, citing the top passages. */
function demoSynthesis(
  passages: { passageId: string; paperTitle: string; passage: string }[]
): AgentSynthesis {
  const used = passages.slice(0, 4);
  return {
    answer:
      `Drawing on the selected papers, the most relevant evidence for this goal is:\n\n` +
      used.map((p) => `• (${p.paperTitle}) ${p.passage}`).join("\n\n") +
      `\n\n(Demo mode: an extractive synthesis of retrieved passages, not a model-generated narrative.)`,
    citedPassageIds: used.map((p) => p.passageId),
    insufficient: false,
  };
}

/** Cancel a run: mark the session and its pending steps cancelled. */
export async function cancelAgent(userId: string, sessionId: string): Promise<void> {
  await getOwnedAgentSession(sessionId, userId);
  await prisma.$transaction([
    prisma.agentStep.updateMany({
      where: { sessionId, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "CANCELLED" },
    }),
    prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: "CANCELLED", error: "Cancelled by user." },
    }),
  ]);
}

/** Retry a failed/cancelled step: reset it (and later steps) to PENDING. */
export async function retryAgentStep(
  userId: string,
  sessionId: string,
  stepIndex: number
): Promise<void> {
  await getOwnedAgentSession(sessionId, userId);
  await prisma.$transaction([
    prisma.agentStep.updateMany({
      where: { sessionId, index: { gte: stepIndex } },
      data: { status: "PENDING", error: null, output: Prisma.JsonNull, startedAt: null, finishedAt: null },
    }),
    prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: "PROCESSING", error: null, finalAnswer: null, citations: Prisma.JsonNull },
    }),
  ]);
}
