import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * Full, owner-scoped export of a user's research data as a plain object. No
 * secrets are included — encrypted credentials and password hashes are never
 * read here.
 */
export async function exportUserData(userId: string) {
  const [projects, papers, analyses, gaps, notes, conversations, agents] =
    await Promise.all([
      prisma.researchProject.findMany({ where: { ownerId: userId } }),
      prisma.paper.findMany({ where: { ownerId: userId } }),
      prisma.paperAnalysis.findMany({
        where: { paper: { ownerId: userId } },
      }),
      prisma.researchGapAnalysis.findMany({
        where: { project: { ownerId: userId } },
        include: { gaps: { include: { evidence: true } } },
      }),
      prisma.researchNote.findMany({ where: { ownerId: userId } }),
      prisma.conversation.findMany({
        where: { ownerId: userId },
        include: { messages: true },
      }),
      prisma.agentSession.findMany({
        where: { ownerId: userId },
        include: { steps: true },
      }),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    schema: "scholarsea.export.v1",
    counts: {
      projects: projects.length,
      papers: papers.length,
      analyses: analyses.length,
      gapAnalyses: gaps.length,
      notes: notes.length,
      conversations: conversations.length,
      agentSessions: agents.length,
    },
    projects,
    papers,
    analyses,
    gapAnalyses: gaps,
    notes,
    conversations,
    agentSessions: agents,
  };
}

/**
 * Delete all of a user's research data (owner-scoped), keeping the account and
 * its settings. Cascades handle children (analyses, messages, steps, evidence)
 * via the schema's onDelete rules.
 */
export async function deleteUserData(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.agentSession.deleteMany({ where: { ownerId: userId } }),
    prisma.conversation.deleteMany({ where: { ownerId: userId } }),
    prisma.researchGapAnalysis.deleteMany({
      where: { project: { ownerId: userId } },
    }),
    prisma.researchNote.deleteMany({ where: { ownerId: userId } }),
    // Papers cascade to analyses/claims; projects cascade to project papers.
    prisma.paper.deleteMany({ where: { ownerId: userId } }),
    prisma.researchProject.deleteMany({ where: { ownerId: userId } }),
  ]);
}
