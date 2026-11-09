/**
 * Contextual research chat — shared, client-safe types (no server-only, no DB).
 */

/** A source document available to a conversation (owner + scope filtered). */
export interface RetrievalDoc {
  paperId: string;
  paperTitle: string;
  /** Full extracted text of the paper, if any. */
  fullText: string | null;
  /** Source-linked claim passages (high-value retrieval units). */
  claimPassages: string[];
}

/** A retrieved passage with its source and relevance score. */
export interface RetrievedPassage {
  /** Stable id used to cite this passage (resolved server-side). */
  passageId: string;
  paperId: string;
  paperTitle: string;
  passage: string;
  score: number;
}

/** A citation shown with an assistant answer. */
export interface Citation {
  paperId: string;
  paperTitle: string;
  passage: string;
}

export type ChatRole = "USER" | "ASSISTANT" | "SYSTEM";

export interface ChatMessageView {
  id: string;
  role: ChatRole;
  content: string;
  citations: Citation[];
  /** True when the assistant answered "not enough in the corpus". */
  insufficient: boolean;
  createdAt: string;
}

export interface ConversationView {
  id: string;
  title: string | null;
  projectId: string | null;
  paperIds: string[];
  messages: ChatMessageView[];
  createdAt: string;
  updatedAt: string;
}
