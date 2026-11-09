import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { listProjects } from "@/lib/projects/service";
import { listAgentSessions } from "@/lib/agent/service";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { NewRun } from "@/components/agent/new-run";

export const metadata = { title: "Autonomous Research Agent" };

const STATUS_VARIANT: Record<
  string,
  "success" | "destructive" | "warning" | "muted"
> = {
  COMPLETED: "success",
  FAILED: "destructive",
  CANCELLED: "muted",
  PROCESSING: "warning",
  PENDING: "muted",
};

export default async function AgentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [projects, sessions] = await Promise.all([
    listProjects(user.id),
    listAgentSessions(user.id),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Autonomous Research Agent"
        description="Give a goal; the agent plans bounded steps, searches your papers, analyzes and compares them, and synthesizes an evidence-backed answer with citations."
      />
      <NewRun projects={projects.map((p) => ({ id: p.id, name: p.name }))} />

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Past runs
        </h2>
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
            No runs yet. Set a research goal above to get started.
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/agent/${s.id}`}
                  className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Bot className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-medium">{s.goal}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {s.stepCount} steps ·{" "}
                        {new Date(s.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANT[s.status] ?? "muted"}>
                    {s.status.toLowerCase()}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageContainer>
  );
}
