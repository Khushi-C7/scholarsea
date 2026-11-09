/**
 * Autonomous research agent — shared, client-safe types (no server-only, no DB).
 */

export type StepType =
  | "PLAN"
  | "SEARCH"
  | "RETRIEVE"
  | "ANALYZE"
  | "COMPARE"
  | "SYNTHESIZE";

export type StepStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type SessionStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

/** Hard limits enforced on every run. */
export interface AgentLimits {
  maxToolCalls: number;
  maxRuntimeMs: number;
  tokenBudget: number;
}

export interface AgentStepView {
  index: number;
  type: StepType;
  toolName: string | null;
  status: StepStatus;
  /** One-line human-readable progress/result summary. */
  summary: string | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface AgentCitation {
  paperId: string;
  paperTitle: string;
  passage: string;
}

export interface AgentSessionView {
  id: string;
  goal: string;
  projectId: string | null;
  status: SessionStatus;
  finalAnswer: string | null;
  citations: AgentCitation[];
  limits: AgentLimits;
  tokensUsed: number;
  toolCallsUsed: number;
  error: string | null;
  steps: AgentStepView[];
  createdAt: string;
  updatedAt: string;
}
