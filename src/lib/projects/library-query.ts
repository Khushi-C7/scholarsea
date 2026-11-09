import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  PAPER_SUMMARY_SELECT,
  toPaperSummary,
  type PaperSummary,
} from "@/lib/documents/serialize";
import type { LibraryQuery } from "@/lib/validation/project";

const SORT_ORDER: Record<
  LibraryQuery["sort"],
  Prisma.PaperOrderByWithRelationInput | Prisma.PaperOrderByWithRelationInput[]
> = {
  recent: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  title: { title: "asc" },
  year_desc: [{ year: "desc" }, { createdAt: "desc" }],
  year_asc: [{ year: "asc" }, { createdAt: "desc" }],
};

/**
 * Query the current user's papers with search, filters, and sorting. Always
 * scoped to ownerId; a tag filter joins through the project-paper membership
 * (so a paper tagged in any of the user's projects matches).
 */
export async function queryLibrary(
  userId: string,
  q: LibraryQuery
): Promise<PaperSummary[]> {
  const where: Prisma.PaperWhereInput = { ownerId: userId };

  if (q.q) {
    where.OR = [
      { title: { contains: q.q, mode: "insensitive" } },
      { abstract: { contains: q.q, mode: "insensitive" } },
      { authors: { has: q.q } },
    ];
  }
  if (q.status) where.extractionStatus = q.status;
  if (q.source) where.source = q.source;
  if (q.year) where.year = q.year;
  if (q.bookmarked) {
    // Papers that have at least one bookmarked note by this user.
    where.notes = { some: { ownerId: userId, bookmarked: true } };
  }
  if (q.tag) {
    where.projectPapers = { some: { tags: { has: q.tag } } };
  }

  const rows = await prisma.paper.findMany({
    where,
    select: PAPER_SUMMARY_SELECT,
    orderBy: SORT_ORDER[q.sort],
  });
  return rows.map(toPaperSummary);
}

/** Distinct years present in the user's library (for the year filter). */
export async function libraryYears(userId: string): Promise<number[]> {
  const rows = await prisma.paper.findMany({
    where: { ownerId: userId, year: { not: null } },
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "desc" },
  });
  return rows.map((r) => r.year).filter((y): y is number => y !== null);
}

/** Distinct tags used across all of the user's project memberships. */
export async function libraryTags(userId: string): Promise<string[]> {
  const rows = await prisma.projectPaper.findMany({
    where: { project: { ownerId: userId } },
    select: { tags: true },
  });
  const set = new Set<string>();
  for (const r of rows) for (const t of r.tags) set.add(t);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
