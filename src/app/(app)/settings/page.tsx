import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { SettingsClient } from "@/components/settings/settings-client";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="Settings"
        description="AI provider and model, secure API keys, output language, prompts, theme, usage, and data management."
      />
      <SettingsClient />
    </PageContainer>
  );
}
