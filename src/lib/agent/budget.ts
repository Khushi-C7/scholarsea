import type { AgentLimits } from "@/lib/agent/types";

export interface BudgetState {
  toolCallsUsed: number;
  tokensUsed: number;
  /** Epoch ms when the run started. */
  startedAtMs: number;
}

export type BudgetBreach = "tool_calls" | "runtime" | "tokens" | null;

/**
 * Check the hard limits before executing a step. Returns the breached limit,
 * or null if there is budget to proceed. Enforced on every advance so a run
 * can never exceed its tool-call, runtime, or token ceiling.
 */
export function checkBudget(
  state: BudgetState,
  limits: AgentLimits,
  nowMs: number
): BudgetBreach {
  if (state.toolCallsUsed >= limits.maxToolCalls) return "tool_calls";
  if (nowMs - state.startedAtMs >= limits.maxRuntimeMs) return "runtime";
  if (state.tokensUsed >= limits.tokenBudget) return "tokens";
  return null;
}

export function breachMessage(breach: BudgetBreach, limits: AgentLimits): string {
  switch (breach) {
    case "tool_calls":
      return `Tool-call limit reached (${limits.maxToolCalls}). The run was stopped to stay within bounds.`;
    case "runtime":
      return `Runtime limit reached (${Math.round(limits.maxRuntimeMs / 1000)}s). The run was stopped to stay within bounds.`;
    case "tokens":
      return `Token budget reached (${limits.tokenBudget}). The run was stopped to stay within bounds.`;
    default:
      return "";
  }
}
