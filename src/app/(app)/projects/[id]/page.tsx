import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Telescope, GitCompareArrows, MessagesSquare } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { getOwnedProject } from "@/lib/auth/guards";
import { NotFoundError } from "@/lib/auth/errors";
import { listProjectPapers, listProjectTags } from "@/lib/projects/service";
import { listNotesForProject, listProjectReports } from "@/lib/projects/notes";
import { PageContainer } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { ProjectWorkspace } from "@/components/projects/project-workspace";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  let project;
  try {
    project = await getOwnedProject(id, user.id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const [papers, tags, notes, reports] = await Promise.all([
    listProjectPapers(user.id, id),
    listProjectTags(user.id, id),
    listNotesForProject(user.id, id),
    listProjectReports(user.id, id),
  ]);
  void tags; // tag chips are derived client-side from the papers

  return (
    <PageContainer className="max-w-4xl">
      <Link
        href="/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All projects
      </Link>

      <div className="mb-6 flex flex-col gap-3 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            {project.name}
          </h1>
          {project.description ? (
            <p className="max-w-2xl text-sm text-muted-foreground">
              {project.description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {papers.length >= 1 ? (
            <Button variant="outline" asChild>
              <Link href={`/chat?project=${project.id}`}>
                <MessagesSquare /> Chat
              </Link>
            </Button>
          ) : null}
          {papers.length >= 2 ? (
            <Button variant="outline" asChild>
              <Link
                href={`/compare?papers=${papers
                  .map((p) => p.paperId)
                  .join(",")}`}
              >
                <GitCompareArrows /> Compare
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link href={`/gaps?project=${project.id}`}>
              <Telescope /> Find gaps
            </Link>
          </Button>
        </div>
      </div>

      <ProjectWorkspace
        projectId={project.id}
        initialPapers={papers}
        initialNotes={notes.map((n) => ({
          id: n.id,
          body: n.body,
          bookmarked: n.bookmarked,
          updatedAt: n.updatedAt.toISOString(),
        }))}
        reports={reports.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </PageContainer>
  );
}
