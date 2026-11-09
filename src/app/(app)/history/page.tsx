import { History } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/layout/page";
import { PlaceholderPanel } from "@/components/common/placeholder-panel";

export const metadata = { title: "Research History" };

export default function HistoryPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Research History"
        description="A record of past analyses, gap runs, agent sessions, and exports."
      />
      <PlaceholderPanel
        icon={History}
        title="Research History"
        description="A record of past analyses, gap runs, agent sessions, and exports."
        planned={["Timeline of analyses, gap analyses, and agent sessions","Reopen any past run and its results","Filter by project, type, and date"]}
      />
    </PageContainer>
  );
}
