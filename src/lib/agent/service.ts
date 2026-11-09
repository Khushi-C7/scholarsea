import "server-only";

import { prisma } from "@/lib/db/prisma";
import { requireUser, getOwnedAgentSession } from "@/lib/auth/guards";
import { DEFAULT_LIMITS } from "@/lib/agent/plan";
import type {
  AgentSessionView,
  AgentStepView,
  AgentCitation,
  AgentLimits,
} from "@/lib/agent/types";

export interface AgentSessionListItem {
  id: string;
  goal: string;
  status: string;
  stepCount: number;
  createdAt: string;
}

export async function listAgentSessions(
  userId: string
): Promise<AgentSessionListItem[]> {
  await requireUser();
  const rows = await prisma.agentSession.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      goal: true,
      status: true,
      createdAt: true,
      _count: { select: { steps: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    goal: r.goal,
    status: r.status,
    stepCount: r._count.steps,
    createdAt: r.createdAt.toISOString(),
  }));
}

function toCitations(v: unknown): AgentCitation[] {
  if (!Array.isArray(v)) return [];
  const out: AgentCitation[] = [];
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

function stepSummary(output: unknown): string | null {
  if (output && typeof output === "object") {
    const s = (output as Record<string, unknown>).summary;
    if (typeof s === "string") return s;
  }
  return null;
}

/** Full session view: limits, counters, and the ordered step timeline. */
export async function getAgentSessionView(
  userId: string,
  sessionId: string
): Promise<AgentSessionView> {
  const session = await getOwnedAgentSession(sessionId, userId); // 404 if not owned
  const steps = await prisma.agentStep.findMany({
    where: { sessionId },
    orderBy: { index: "asc" },
  });

  const toolCallsUsed = steps.filter(
    (s) => s.toolName && (s.status === "COMPLETED" || s.status === "FAILED")
  ).length;

  const stepViews: AgentStepView[] = steps.map((s) => ({
    index: s.index,
    type: s.type as AgentStepView["type"],
    toolName: s.toolName,
    status: s.status as AgentStepView["status"],
    summary: stepSummary(s.output),
    error: s.error,
    startedAt: s.startedAt?.toISOString() ?? null,
    finishedAt: s.finishedAt?.toISOString() ?? null,
  }));

  return {
    id: session.id,
    goal: session.goal,
    projectId: session.projectId,
    status: session.status as AgentSessionView["status"],
    finalAnswer: session.finalAnswer,
    citations: toCitations(session.citations),
    limits: (session.limits as unknown as AgentLimits) ?? DEFAULT_LIMITS,
    tokensUsed: session.tokensUsed ?? 0,
    toolCallsUsed,
    error: session.error,
    steps: stepViews,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}
