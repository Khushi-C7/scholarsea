import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getOwnedProject, getOwnedPaper } from "@/lib/auth/guards";
import { NotFoundError } from "@/lib/auth/errors";
import { AppError } from "@/lib/auth/errors";
import type {
  CreateProjectInput,
  UpdateProjectInput,
} from "@/lib/validation/project";

/** Conflict when a project name is already taken by this user. */
export class ProjectNameTakenError extends AppError {
  constructor(message = "You already have a project with that name") {
    super(message, 409, "project_name_taken");
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2002"
  );
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  paperCount: number;
  noteCount: number;
  gapAnalysisCount: number;
  createdAt: Date;
  updatedAt: Date;
}

function toSummary(p: {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { projectPapers: number; notes: number; gapAnalyses: number };
}): ProjectSummary {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    paperCount: p._count.projectPapers,
    noteCount: p._count.notes,
    gapAnalysisCount: p._count.gapAnalyses,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

const COUNT_SELECT = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { projectPapers: true, notes: true, gapAnalyses: true } },
} satisfies Prisma.ResearchProjectSelect;

export async function listProjects(userId: string): Promise<ProjectSummary[]> {
  const rows = await prisma.researchProject.findMany({
    where: { ownerId: userId },
    select: COUNT_SELECT,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toSummary);
}

export async function createProject(
  userId: string,
  input: CreateProjectInput
): Promise<ProjectSummary> {
  try {
    const row = await prisma.researchProject.create({
      data: {
        ownerId: userId,
        name: input.name,
        description: input.description ?? null,
      },
      select: COUNT_SELECT,
    });
    return toSummary(row);
  } catch (err) {
    if (isUniqueViolation(err)) throw new ProjectNameTakenError();
    throw err;
  }
}

export async function updateProject(
  userId: string,
  projectId: string,
  input: UpdateProjectInput
): Promise<ProjectSummary> {
  await getOwnedProject(projectId, userId); // 404 if not owned
  try {
    const row = await prisma.researchProject.update({
      where: { id: projectId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
      },
      select: COUNT_SELECT,
    });
    return toSummary(row);
  } catch (err) {
    if (isUniqueViolation(err)) throw new ProjectNameTakenError();
    throw err;
  }
}

export async function deleteProject(
  userId: string,
  projectId: string
): Promise<void> {
  await getOwnedProject(projectId, userId);
  // Cascades remove project-papers, gap analyses; notes SetNull (kept).
  await prisma.researchProject.delete({ where: { id: projectId } });
}

// --- Membership & tags -----------------------------------------------------

export interface ProjectPaperView {
  projectPaperId: string;
  paperId: string;
  title: string;
  authors: string[];
  year: number | null;
  source: string;
  extractionStatus: string;
  tags: string[];
  addedAt: Date;
}

export async function addPaperToProject(
  userId: string,
  projectId: string,
  paperId: string,
  tags: string[] = []
): Promise<ProjectPaperView> {
  // Both the project AND the paper must belong to the user.
  await getOwnedProject(projectId, userId);
  await getOwnedPaper(paperId, userId);
  try {
    const row = await prisma.projectPaper.create({
      data: { projectId, paperId, tags: normalizeTags(tags) },
      include: { paper: true },
    });
    // Touch the project so its updatedAt reflects the change.
    await prisma.researchProject.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });
    return toPaperView(row);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError("That paper is already in this project", 409, "already_in_project");
    }
    throw err;
  }
}

export async function removePaperFromProject(
  userId: string,
  projectId: string,
  paperId: string
): Promise<void> {
  await getOwnedProject(projectId, userId);
  const deleted = await prisma.projectPaper.deleteMany({
    where: { projectId, paperId },
  });
  if (deleted.count === 0) throw new NotFoundError("Paper is not in this project");
}

export async function setPaperTags(
  userId: string,
  projectId: string,
  paperId: string,
  tags: string[]
): Promise<ProjectPaperView> {
  await getOwnedProject(projectId, userId);
  const existing = await prisma.projectPaper.findFirst({
    where: { projectId, paperId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Paper is not in this project");
  const row = await prisma.projectPaper.update({
    where: { id: existing.id },
    data: { tags: normalizeTags(tags) },
    include: { paper: true },
  });
  return toPaperView(row);
}

export async function listProjectPapers(
  userId: string,
  projectId: string
): Promise<ProjectPaperView[]> {
  await getOwnedProject(projectId, userId);
  const rows = await prisma.projectPaper.findMany({
    where: { projectId },
    include: { paper: true },
    orderBy: { addedAt: "desc" },
  });
  return rows.map(toPaperView);
}

/** Distinct tags used across a project's papers, for filter chips. */
export async function listProjectTags(
  userId: string,
  projectId: string
): Promise<string[]> {
  await getOwnedProject(projectId, userId);
  const rows = await prisma.projectPaper.findMany({
    where: { projectId },
    select: { tags: true },
  });
  const set = new Set<string>();
  for (const r of rows) for (const t of r.tags) set.add(t);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.slice(0, 30);
}

function toPaperView(row: {
  id: string;
  paperId: string;
  tags: string[];
  addedAt: Date;
  paper: {
    title: string;
    authors: string[];
    year: number | null;
    source: string;
    extractionStatus: string;
  };
}): ProjectPaperView {
  return {
    projectPaperId: row.id,
    paperId: row.paperId,
    title: row.paper.title,
    authors: row.paper.authors,
    year: row.paper.year,
    source: row.paper.source,
    extractionStatus: row.paper.extractionStatus,
    tags: row.tags,
    addedAt: row.addedAt,
  };
}
