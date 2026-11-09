import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, MessagesSquare } from "lucide-react";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/ai/provider";
import { toInsightReportView } from "@/lib/documents/analysis-view";
import { PageContainer } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PaperStatusBadge,
  type ExtractionStatus,
} from "@/components/papers/status-badge";
import { AnalyzeButton } from "@/components/papers/analyze-button";
import { BookmarkButton } from "@/components/papers/bookmark-button";
import { DemoBanner } from "@/components/papers/demo-banner";
import { InsightReport } from "@/components/papers/insight-report";
import { ReportExport } from "@/components/papers/report-export";
import { RelatedPapers } from "@/components/papers/related-papers";

export default async function PaperDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  // Ownership enforced in the query; a miss is a 404.
  const paper = await prisma.paper.findFirst({
    where: { id, ownerId: user.id },
  });
  if (!paper) notFound();

  const analysisRow = await prisma.paperAnalysis.findFirst({
    where: { paperId: paper.id },
    orderBy: { version: "desc" },
  });
  const claims = analysisRow
    ? await prisma.extractedClaim.findMany({
        where: { analysisId: analysisRow.id },
        select: { type: true, text: true, supportingPassage: true },
      })
    : [];

  // A paper "bookmark" is a bookmarked note on the paper.
  const bookmarkNote = await prisma.researchNote.findFirst({
    where: { ownerId: user.id, paperId: paper.id, bookmarked: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  const report = analysisRow ? toInsightReportView(analysisRow) : null;
  const canAnalyze =
    Boolean(paper.fullText) && paper.extractionStatus === "COMPLETED";
  const showDemoBanner = report?.demo || (isDemoMode() && !report);

  const meta = [
    paper.authors.slice(0, 6).join(", "),
    paper.year?.toString(),
    paper.venue,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PageContainer className="max-w-4xl">
      <Link
        href="/library"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to library
      </Link>

      {/* Paper header */}
      <div className="mb-6 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            {paper.title}
          </h1>
          {meta ? (
            <p className="text-sm text-muted-foreground">{meta}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <PaperStatusBadge
              status={paper.extractionStatus as ExtractionStatus}
            />
            {paper.doi ? (
              <Badge variant="outline">DOI: {paper.doi}</Badge>
            ) : null}
            {paper.arxivId ? (
              <Badge variant="outline">arXiv: {paper.arxivId}</Badge>
            ) : null}
            {paper.url ? (
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Source <ExternalLink className="size-3" />
              </a>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canAnalyze ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/chat?paper=${paper.id}`}>
                <MessagesSquare /> Ask
              </Link>
            </Button>
          ) : null}
          <BookmarkButton
            paperId={paper.id}
            initialNoteId={bookmarkNote?.id ?? null}
          />
          {report ? (
            <ReportExport
              paper={{
                id: paper.id,
                title: paper.title,
                authors: paper.authors,
                year: paper.year,
                doi: paper.doi,
                url: paper.url,
              }}
              report={report}
            />
          ) : null}
          {canAnalyze ? (
            <AnalyzeButton paperId={paper.id} hasAnalysis={Boolean(report)} />
          ) : null}
        </div>
      </div>

      {paper.abstract ? (
        <div className="mb-6">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Abstract
          </p>
          <p className="text-sm leading-relaxed text-foreground/90">
            {paper.abstract}
          </p>
        </div>
      ) : null}

      {showDemoBanner ? <DemoBanner className="mb-6" /> : null}

      {/* Report or empty state */}
      {!canAnalyze ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
          This paper has no extracted text, so it can&apos;t be analyzed.
          {paper.extractionError ? (
            <p className="mt-1 text-[color:var(--destructive)]">
              {paper.extractionError}
            </p>
          ) : null}
        </div>
      ) : !report ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No analysis yet. Run the multi-agent analysis to generate a research
            insight report.
          </p>
          <div className="mt-4 flex justify-center">
            <AnalyzeButton paperId={paper.id} hasAnalysis={false} />
          </div>
        </div>
      ) : (
        <>
          {report.status === "FAILED" ? (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-[color:var(--destructive)]">
              Analysis failed: {report.error ?? "unknown error"}. You can try
              again.
            </div>
          ) : null}
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>Version {report.version}</span>
            <span>
              Model: {report.modelProvider ?? "—"}
              {report.modelName ? ` (${report.modelName})` : ""}
            </span>
            {report.tokensUsed ? <span>{report.tokensUsed} tokens</span> : null}
            <span>
              {new Date(report.createdAt).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>
          <InsightReport report={report} claims={claims} />
        </>
      )}

      <div className="mt-8">
        <RelatedPapers paperId={paper.id} />
      </div>
    </PageContainer>
  );
}
