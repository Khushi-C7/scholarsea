import "server-only";

import { prisma } from "@/lib/db/prisma";
import {
  getOwnedProject,
  getOwnedPaper,
  getOwnedGap,
  getOwnedNote,
} from "@/lib/auth/guards";
import type {
  CreateNoteInput,
  UpdateNoteInput,
} from "@/lib/validation/project";

export interface NoteView {
  id: string;
  body: string;
  bookmarked: boolean;
  projectId: string | null;
  paperId: string | null;
  gapId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toNoteView(n: {
  id: string;
  body: string;
  bookmarked: boolean;
  projectId: string | null;
  paperId: string | null;
  gapId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): NoteView {
  return n;
}

/**
 * Create a note. Verifies the user owns every entity the note attaches to, so
 * a note can never be anchored to someone else's project/paper/gap.
 */
export async function createNote(
  userId: string,
  input: CreateNoteInput
): Promise<NoteView> {
  if (input.projectId) await getOwnedProject(input.projectId, userId);
  if (input.paperId) await getOwnedPaper(input.paperId, userId);
  if (input.gapId) await getOwnedGap(input.gapId, userId);

  const note = await prisma.researchNote.create({
    data: {
      ownerId: userId,
      body: input.body,
      bookmarked: input.bookmarked ?? false,
      projectId: input.projectId ?? null,
      paperId: input.paperId ?? null,
      gapId: input.gapId ?? null,
    },
  });
  return toNoteView(note);
}

export async function updateNote(
  userId: string,
  noteId: string,
  input: UpdateNoteInput
): Promise<NoteView> {
  await getOwnedNote(noteId, userId); // 404 if not owned
  const note = await prisma.researchNote.update({
    where: { id: noteId },
    data: {
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.bookmarked !== undefined
        ? { bookmarked: input.bookmarked }
        : {}),
    },
  });
  return toNoteView(note);
}

export async function deleteNote(
  userId: string,
  noteId: string
): Promise<void> {
  await getOwnedNote(noteId, userId);
  await prisma.researchNote.delete({ where: { id: noteId } });
}

export async function listNotesForProject(
  userId: string,
  projectId: string
): Promise<NoteView[]> {
  await getOwnedProject(projectId, userId);
  const rows = await prisma.researchNote.findMany({
    where: { ownerId: userId, projectId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toNoteView);
}

export async function listNotesForPaper(
  userId: string,
  paperId: string
): Promise<NoteView[]> {
  await getOwnedPaper(paperId, userId);
  const rows = await prisma.researchNote.findMany({
    where: { ownerId: userId, paperId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toNoteView);
}

/** All of a user's bookmarked notes (for the bookmarks view). */
export async function listBookmarkedNotes(userId: string): Promise<NoteView[]> {
  const rows = await prisma.researchNote.findMany({
    where: { ownerId: userId, bookmarked: true },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toNoteView);
}

export interface SavedReportView {
  analysisId: string;
  paperId: string;
  paperTitle: string;
  version: number;
  status: string;
  createdAt: Date;
}

/**
 * Saved reports for a project = the latest completed analysis of each paper in
 * the project. These are the per-paper Research Insight Reports.
 */
export async function listProjectReports(
  userId: string,
  projectId: string
): Promise<SavedReportView[]> {
  await getOwnedProject(projectId, userId);
  const memberships = await prisma.projectPaper.findMany({
    where: { projectId },
    select: { paperId: true, paper: { select: { title: true } } },
  });
  const reports: SavedReportView[] = [];
  for (const m of memberships) {
    const latest = await prisma.paperAnalysis.findFirst({
      where: { paperId: m.paperId },
      orderBy: { version: "desc" },
      select: { id: true, version: true, status: true, createdAt: true },
    });
    if (latest) {
      reports.push({
        analysisId: latest.id,
        paperId: m.paperId,
        paperTitle: m.paper.title,
        version: latest.version,
        status: latest.status,
        createdAt: latest.createdAt,
      });
    }
  }
  return reports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
