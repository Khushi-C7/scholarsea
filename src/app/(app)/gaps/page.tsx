import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { listProjects } from "@/lib/projects/service";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { GapExplorer } from "@/components/gaps/gap-explorer";

export const metadata = { title: "Research Gap Explorer" };

export default async function GapsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { project } = await searchParams;
  const projects = await listProjects(user.id);

  return (
    <PageContainer>
      <PageHeader
        title="Research Gap Explorer"
        description="Build an evidence corpus from a project's analyzed papers, then surface candidate patterns — each linked to real supporting passages, and scoped honestly to what the corpus actually contains."
      />
      <GapExplorer
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          paperCount: p.paperCount,
        }))}
        initialProjectId={project}
      />
    </PageContainer>
  );
}
