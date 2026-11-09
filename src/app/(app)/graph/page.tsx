import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { KnowledgeGraph } from "@/components/graph/knowledge-graph";

export const metadata = { title: "Knowledge Graph" };

export default async function GraphPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <PageContainer className="max-w-none">
      <PageHeader
        title="Knowledge Graph"
        description="Papers, authors, concepts, methods, datasets, and topics — every link derived from stored metadata or analysis, never invented."
      />
      <KnowledgeGraph />
    </PageContainer>
  );
}
