import Link from "next/link";
import { redirect } from "next/navigation";
import { FilePlus2, FileText, Link2, ClipboardType, Search } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import {
  queryLibrary,
  libraryYears,
  libraryTags,
} from "@/lib/projects/library-query";
import { libraryQuerySchema } from "@/lib/validation/project";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LibraryControls } from "@/components/papers/library-controls";
import { ExportMenu } from "@/components/papers/export-menu";
import {
  PaperStatusBadge,
  type ExtractionStatus,
} from "@/components/papers/status-badge";

export const metadata = { title: "Paper Library" };

const SOURCE_LABEL: Record<string, { label: string; icon: typeof FileText }> = {
  PASTED_TEXT: { label: "Pasted text", icon: ClipboardType },
  PDF_UPLOAD: { label: "PDF", icon: FileText },
  URL: { label: "URL", icon: Link2 },
  ACADEMIC_SEARCH: { label: "Search", icon: Search },
};

type RawParams = Record<string, string | string[] | undefined>;

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const raw = await searchParams;
  // Validate/coerce the query; fall back to defaults on anything invalid.
  const parsed = libraryQuerySchema.safeParse(raw);
  const query = parsed.success
    ? parsed.data
    : libraryQuerySchema.parse({});
  const highlight = typeof raw.highlight === "string" ? raw.highlight : undefined;

  const [papers, years, tags] = await Promise.all([
    queryLibrary(user.id, query),
    libraryYears(user.id),
    libraryTags(user.id),
  ]);

  // Distinguish "no papers at all" from "none match the filters".
  const anyFilter = Boolean(
    query.q ||
      query.status ||
      query.source ||
      query.year ||
      query.tag ||
      query.bookmarked
  );
  const libraryEmpty = papers.length === 0 && !anyFilter;

  return (
    <PageContainer>
      <PageHeader
        title="Paper Library"
        description="Every paper you have ingested, with its extraction status."
        actions={
          <>
            <ExportMenu disabled={libraryEmpty} />
            <Button asChild>
              <Link href="/new">
                <FilePlus2 /> New research
              </Link>
            </Button>
          </>
        }
      />

      {libraryEmpty ? (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
            <FileText className="size-6" />
          </div>
          <h2 className="text-base font-semibold">No papers yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Add your first paper by pasting text, uploading a PDF, or giving a
            public URL.
          </p>
          <Button asChild className="mt-5">
            <Link href="/new">
              <FilePlus2 /> Add a paper
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <LibraryControls years={years} tags={tags} />

          {papers.length === 0 ? (
            <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
              No papers match these filters.
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                {papers.length} {papers.length === 1 ? "paper" : "papers"}
              </p>
              <ul className="space-y-3">
                {papers.map((p) => {
                  const src =
                    SOURCE_LABEL[p.source] ?? SOURCE_LABEL.PASTED_TEXT;
                  const SourceIcon = src.icon;
                  const meta = [
                    p.authors.slice(0, 4).join(", "),
                    p.year?.toString(),
                    p.venue,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li
                      key={p.id}
                      className={
                        "rounded-xl border bg-card p-4 transition-colors" +
                        (highlight === p.id ? " ring-2 ring-primary" : "")
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <h3 className="truncate font-medium">
                            <Link
                              href={`/library/${p.id}`}
                              className="hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {p.title}
                            </Link>
                          </h3>
                          {meta ? (
                            <p className="truncate text-sm text-muted-foreground">
                              {meta}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Metadata not detected
                            </p>
                          )}
                          {p.abstract ? (
                            <p className="line-clamp-2 pt-0.5 text-sm text-muted-foreground">
                              {p.abstract}
                            </p>
                          ) : null}
                          {p.extractionStatus === "FAILED" &&
                          p.extractionError ? (
                            <p className="pt-1 text-sm text-[color:var(--destructive)]">
                              {p.extractionError}
                            </p>
                          ) : null}
                        </div>
                        <PaperStatusBadge
                          status={p.extractionStatus as ExtractionStatus}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="gap-1">
                          <SourceIcon /> {src.label}
                        </Badge>
                        {p.doi ? <span>DOI: {p.doi}</span> : null}
                        {p.arxivId ? <span>arXiv: {p.arxivId}</span> : null}
                        {p.pageCount ? <span>{p.pageCount} pp.</span> : null}
                        <span className="ml-auto">
                          {new Date(p.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
    </PageContainer>
  );
}
