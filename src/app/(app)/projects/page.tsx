import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { listProjects } from "@/lib/projects/service";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { ProjectsList } from "@/components/projects/projects-list";

export const metadata = { title: "Research Projects" };

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const projects = await listProjects(user.id);

  return (
    <PageContainer>
      <PageHeader
        title="Research Projects"
        description="Group papers into literature reviews: tag them, keep notes, and collect reports."
      />
      <ProjectsList
        projects={projects.map((p) => ({
          ...p,
          updatedAt: p.updatedAt.toISOString(),
        }))}
      />
    </PageContainer>
  );
}
