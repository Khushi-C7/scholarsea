import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { getAgentSessionView } from "@/lib/agent/service";
import { NotFoundError } from "@/lib/auth/errors";
import { PageContainer } from "@/components/layout/page";
import { RunTimeline } from "@/components/agent/run-timeline";

export const metadata = { title: "Research Run" };

export default async function AgentRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  let session;
  try {
    session = await getAgentSessionView(user.id, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <PageContainer className="max-w-3xl">
      <Link
        href="/agent"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All runs
      </Link>
      <h1 className="mb-1 text-lg font-semibold tracking-tight">Research run</h1>
      <p className="mb-5 text-sm text-muted-foreground">{session.goal}</p>
      <RunTimeline initial={session} />
    </PageContainer>
  );
}
