import "server-only";

import { prisma } from "@/lib/db/prisma";
import { getOwnedPaper } from "@/lib/auth/guards";
import { tokenSet, jaccard } from "@/lib/gaps/text";

export interface Recommendation {
  paperId: string;
  title: string;
  authors: string[];
  year: number | null;
  score: number;
  /** Concrete, grounded reason this paper is related (shared terms etc.). */
  explanation: string;
}

/** Text used to represent a paper for similarity: title + abstract. */
function profileText(p: { title: string; abstract: string | null }): string {
  return `${p.title} ${p.abstract ?? ""}`;
}

/**
 * Recommend related papers from the user's OWN library for a given paper.
 * Owner-scoped. Similarity is lexical overlap of title+abstract; every
 * recommendation carries an explanation naming the shared terms — the reason
 * is derived from real overlap, never fabricated. Returns [] when nothing
 * meaningfully overlaps rather than padding with weak matches.
 */
export async function recommendRelated(
  userId: string,
  paperId: string,
  limit = 5
): Promise<Recommendation[]> {
  const source = await getOwnedPaper(paperId, userId); // 404 if not owned
  const sourceTokens = tokenSet(profileText(source));
  if (sourceTokens.size === 0) return [];

  const others = await prisma.paper.findMany({
    where: { ownerId: userId, id: { not: paperId } },
    select: { id: true, title: true, authors: true, year: true, abstract: true },
  });

  const scored = others
    .map((p) => {
      const theirTokens = tokenSet(profileText(p));
      const score = jaccard(sourceTokens, theirTokens);
      const shared = Array.from(sourceTokens)
        .filter((t) => theirTokens.has(t))
        .slice(0, 5);
      return { p, score, shared };
    })
    // Require real overlap: at least two shared content terms.
    .filter((r) => r.shared.length >= 2 && r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((r) => ({
    paperId: r.p.id,
    title: r.p.title,
    authors: r.p.authors,
    year: r.p.year,
    score: Number(r.score.toFixed(4)),
    explanation: `Shares key terms with this paper: ${r.shared.join(", ")}.`,
  }));
}
