"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus, X, FileSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TagEditor } from "@/components/projects/tag-editor";
import { AddPaperDialog } from "@/components/projects/add-paper-dialog";
import { NotesPanel, type NoteItem } from "@/components/projects/notes-panel";
import {
  PaperStatusBadge,
  type ExtractionStatus,
} from "@/components/papers/status-badge";

export interface ProjectPaperItem {
  projectPaperId: string;
  paperId: string;
  title: string;
  authors: string[];
  year: number | null;
  extractionStatus: string;
  tags: string[];
}

export interface SavedReportItem {
  analysisId: string;
  paperId: string;
  paperTitle: string;
  version: number;
  status: string;
  createdAt: string;
}

export function ProjectWorkspace({
  projectId,
  initialPapers,
  initialNotes,
  reports,
}: {
  projectId: string;
  initialPapers: ProjectPaperItem[];
  initialNotes: NoteItem[];
  reports: SavedReportItem[];
}) {
  const router = useRouter();
  const [papers, setPapers] = React.useState(initialPapers);
  const [addOpen, setAddOpen] = React.useState(false);
  const [activeTag, setActiveTag] = React.useState<string | null>(null);

  const allTags = React.useMemo(() => {
    const s = new Set<string>();
    for (const p of papers) for (const t of p.tags) s.add(t);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [papers]);

  const shown = activeTag
    ? papers.filter((p) => p.tags.includes(activeTag))
    : papers;

  async function saveTags(paperId: string, tags: string[]) {
    const prev = papers;
    setPapers((ps) =>
      ps.map((p) => (p.paperId === paperId ? { ...p, tags } : p))
    );
    const res = await fetch(
      `/api/projects/${projectId}/papers/${paperId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tags }),
      }
    );
    if (!res.ok) setPapers(prev); // revert
  }

  async function removePaper(paperId: string) {
    const prev = papers;
    setPapers((ps) => ps.filter((p) => p.paperId !== paperId));
    const res = await fetch(
      `/api/projects/${projectId}/papers/${paperId}`,
      { method: "DELETE" }
    );
    if (!res.ok) setPapers(prev);
    else router.refresh();
  }

  return (
    <Tabs defaultValue="papers">
      <TabsList>
        <TabsTrigger value="papers">
          <FileText /> Papers ({papers.length})
        </TabsTrigger>
        <TabsTrigger value="notes">Notes ({initialNotes.length})</TabsTrigger>
        <TabsTrigger value="reports">Reports ({reports.length})</TabsTrigger>
      </TabsList>

      {/* Papers */}
      <TabsContent value="papers">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {allTags.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTag(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <Badge variant={activeTag === null ? "default" : "outline"}>
                    All
                  </Badge>
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                  >
                    <Badge
                      variant={activeTag === tag ? "default" : "outline"}
                    >
                      {tag}
                    </Badge>
                  </button>
                ))}
              </>
            ) : null}
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus /> Add papers
          </Button>
        </div>

        {shown.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
            {papers.length === 0
              ? "No papers in this project yet. Add some from your library."
              : "No papers match this tag."}
          </div>
        ) : (
          <ul className="space-y-2.5">
            {shown.map((p) => (
              <li key={p.projectPaperId} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/library/${p.paperId}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {p.title}
                    </Link>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {[p.authors.slice(0, 3).join(", "), p.year]
                        .filter(Boolean)
                        .join(" · ") || "Metadata not detected"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <PaperStatusBadge
                      status={p.extractionStatus as ExtractionStatus}
                    />
                    <button
                      type="button"
                      onClick={() => removePaper(p.paperId)}
                      aria-label="Remove from project"
                      className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-[color:var(--destructive)]"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  <TagEditor
                    tags={p.tags}
                    onChange={(tags) => saveTags(p.paperId, tags)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      {/* Notes */}
      <TabsContent value="notes">
        <NotesPanel projectId={projectId} initialNotes={initialNotes} />
      </TabsContent>

      {/* Reports */}
      <TabsContent value="reports">
        {reports.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
            No saved reports yet. Run analysis on a paper in this project to
            generate its Research Insight Report.
          </div>
        ) : (
          <ul className="space-y-2">
            {reports.map((r) => (
              <li
                key={r.analysisId}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileSearch className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <Link
                      href={`/library/${r.paperId}`}
                      className="truncate text-sm font-medium hover:text-primary hover:underline"
                    >
                      {r.paperTitle}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Report v{r.version} ·{" "}
                      {new Date(r.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/library/${r.paperId}`}>View</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <AddPaperDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        projectId={projectId}
        excludeIds={papers.map((p) => p.paperId)}
        onAdded={() => router.refresh()}
      />
    </Tabs>
  );
}
