import "server-only";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/lib/auth/errors";

/**
 * Authorization helpers.
 *
 * Two layers of defense:
 *  1. `requireUser` ensures there is an authenticated caller at all.
 *  2. The `getOwned*` fetchers scope every query by owner, so a user can never
 *     read another user's data — the row simply isn't returned, and a missing
 *     row raises NotFound (404, never revealing that it exists for someone
 *     else). `assertOwner` is the explicit form for cases where a row has
 *     already been loaded.
 *
 * Every route that touches a private resource goes through one of these.
 */

/** Require an authenticated user, or throw 401. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Throw 403 unless `userId` owns the resource. */
export function assertOwner(resourceOwnerId: string, userId: string): void {
  if (resourceOwnerId !== userId) {
    throw new ForbiddenError();
  }
}

// --- Ownership-scoped fetchers ---------------------------------------------
// Each filters by the owning user at the query level and throws NotFound when
// nothing matches, so cross-user access is indistinguishable from a 404.

export async function getOwnedProject(projectId: string, userId: string) {
  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, ownerId: userId },
  });
  if (!project) throw new NotFoundError("Project not found");
  return project;
}

export async function getOwnedPaper(paperId: string, userId: string) {
  const paper = await prisma.paper.findFirst({
    where: { id: paperId, ownerId: userId },
  });
  if (!paper) throw new NotFoundError("Paper not found");
  return paper;
}

/** Paper analyses ("reports") are owned via their paper. */
export async function getOwnedAnalysis(analysisId: string, userId: string) {
  const analysis = await prisma.paperAnalysis.findFirst({
    where: { id: analysisId, paper: { ownerId: userId } },
  });
  if (!analysis) throw new NotFoundError("Report not found");
  return analysis;
}

export async function getOwnedGapAnalysis(
  gapAnalysisId: string,
  userId: string
) {
  const analysis = await prisma.researchGapAnalysis.findFirst({
    where: { id: gapAnalysisId, ownerId: userId },
  });
  if (!analysis) throw new NotFoundError("Gap analysis not found");
  return analysis;
}

/** A single gap is owned via its gap analysis. */
export async function getOwnedGap(gapId: string, userId: string) {
  const gap = await prisma.researchGap.findFirst({
    where: { id: gapId, analysis: { ownerId: userId } },
  });
  if (!gap) throw new NotFoundError("Gap not found");
  return gap;
}

export async function getOwnedConversation(
  conversationId: string,
  userId: string
) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, ownerId: userId },
  });
  if (!conversation) throw new NotFoundError("Conversation not found");
  return conversation;
}

export async function getOwnedAgentSession(sessionId: string, userId: string) {
  const session = await prisma.agentSession.findFirst({
    where: { id: sessionId, ownerId: userId },
  });
  if (!session) throw new NotFoundError("Agent session not found");
  return session;
}

export async function getOwnedNote(noteId: string, userId: string) {
  const note = await prisma.researchNote.findFirst({
    where: { id: noteId, ownerId: userId },
  });
  if (!note) throw new NotFoundError("Note not found");
  return note;
}
