import type { StepType, AgentLimits } from "@/lib/agent/types";

/** Default hard limits for a run. Deliberately conservative and bounded. */
export const DEFAULT_LIMITS: AgentLimits = {
  maxToolCalls: 12,
  maxRuntimeMs: 120_000,
  tokenBudget: 60_000,
};

/**
 * The bounded research plan. A fixed, finite sequence — the agent cannot loop
 * forever or invent unbounded steps. Each entry becomes one AgentStep.
 */
export interface PlannedStep {
  type: StepType;
  toolName: string | null;
  /** Static description shown before the step runs. */
  intent: string;
}

export const PLAN: PlannedStep[] = [
  { type: "PLAN", toolName: null, intent: "Break the goal into bounded research steps." },
  { type: "SEARCH", toolName: "library_search", intent: "Search your analyzed papers for relevant sources." },
  { type: "RETRIEVE", toolName: "retrieve", intent: "Select the most relevant papers into a working set." },
  { type: "ANALYZE", toolName: "analyze", intent: "Gather each selected paper's structured findings." },
  { type: "COMPARE", toolName: "compare", intent: "Compare findings and detect patterns across papers." },
  { type: "SYNTHESIZE", toolName: "synthesize", intent: "Write an evidence-backed answer with citations." },
];

/** Normalize a free-text goal into a search query (strip filler punctuation). */
export function goalToQuery(goal: string): string {
  return goal.replace(/\s+/g, " ").trim();
}
