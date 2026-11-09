"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FolderKanban,
  FilePlus2,
  FileText,
  StickyNote,
  Telescope,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectDialog } from "@/components/projects/project-dialog";

export interface ProjectCard {
  id: string;
  name: string;
  description: string | null;
  paperCount: number;
  noteCount: number;
  gapAnalysisCount: number;
  updatedAt: string;
}

export function ProjectsList({ projects }: { projects: ProjectCard[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProjectCard | null>(null);

  async function remove(p: ProjectCard) {
    if (
      !window.confirm(
        `Delete "${p.name}"? Its papers stay in your library, but the project, its tags, and its gap analyses are removed.`
      )
    )
      return;
    const res = await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <FilePlus2 /> New project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
            <FolderKanban className="size-6" />
          </div>
          <h2 className="text-base font-semibold">No projects yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create a project to group papers, tag them, keep notes, and collect
            reports for a literature review.
          </p>
          <Button className="mt-5" onClick={() => setCreateOpen(true)}>
            <FilePlus2 /> New project
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <li
              key={p.id}
              className="group relative rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/projects/${p.id}`}
                  className="min-w-0 flex-1 focus-visible:outline-none"
                >
                  <h3 className="truncate font-medium group-hover:text-primary">
                    {p.name}
                  </h3>
                  {p.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {p.description}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground/70">
                      No description
                    </p>
                  )}
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label="Project actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(p)}>
                      <Pencil /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => remove(p)}
                      className="text-[color:var(--destructive)] focus:text-[color:var(--destructive)]"
                    >
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <FileText className="size-3.5" /> {p.paperCount} papers
                </span>
                <span className="inline-flex items-center gap-1">
                  <StickyNote className="size-3.5" /> {p.noteCount} notes
                </span>
                <span className="inline-flex items-center gap-1">
                  <Telescope className="size-3.5" /> {p.gapAnalysisCount} gap runs
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ProjectDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        project={editing ?? undefined}
      />
    </>
  );
}
