import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { COMPARE_MAX } from "@/lib/compare/config";
import { PageContainer, PageHeader } from "@/components/layout/page";
import {
  CompareWorkspace,
  type PaperOption,
} from "@/components/compare/compare-workspace";

export const metadata = { title: "Paper Comparison" };

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ papers?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { papers: preselect } = await searchParams;

  // Only completed papers can be meaningfully compared; list them for the
  // picker, flagging which have an analysis to draw from.
  const rows = await prisma.paper.findMany({
    where: { ownerId: user.id, extractionStatus: "COMPLETED" },
    select: {
      id: true,
      title: true,
      authors: true,
      year: true,
      _count: { select: { analyses: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const papers: PaperOption[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    authors: r.authors,
    year: r.year,
    analyzed: r._count.analyses > 0,
  }));

  const valid = new Set(papers.map((p) => p.id));
  const initialSelected = (preselect ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => valid.has(s))
    .slice(0, COMPARE_MAX);

  return (
    <PageContainer>
      <PageHeader
        title="Paper Comparison"
        description={`Compare up to ${COMPARE_MAX} papers across consistent dimensions, with source-linked claims.`}
      />
      <CompareWorkspace papers={papers} initialSelected={initialSelected} />
    </PageContainer>
  );
}
