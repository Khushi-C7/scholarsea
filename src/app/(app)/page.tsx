import Link from "next/link";
import {
  FilePlus2,
  Telescope,
  GitCompareArrows,
  Bot,
  FolderKanban,
  Library,
  FileText,
  Activity,
} from "lucide-react";

import { PageContainer, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Dashboard" };

// Step 1 renders an empty workspace. Every number here is a real zero,
// not a placeholder figure — live stats arrive once persistence does.
const STATS = [
  { label: "Projects", value: 0, icon: FolderKanban },
  { label: "Papers", value: 0, icon: Library },
  { label: "Reports", value: 0, icon: FileText },
  { label: "Agent runs", value: 0, icon: Activity },
];

const QUICK_ACTIONS = [
  {
    label: "New research",
    href: "/new",
    icon: FilePlus2,
    hint: "Ingest a paper",
  },
  {
    label: "Find gaps",
    href: "/gaps",
    icon: Telescope,
    hint: "Cross-paper analysis",
  },
  {
    label: "Compare papers",
    href: "/compare",
    icon: GitCompareArrows,
    hint: "Side by side",
  },
  {
    label: "Run agent",
    href: "/agent",
    icon: Bot,
    hint: "Goal-based research",
  },
];

function EmptyList({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Welcome to ScholarSea"
        description="Your research workspace. Ingest papers, compare methods, and surface evidence-linked gaps across the literature."
        actions={
          <Button asChild>
            <Link href="/new">
              <FilePlus2 /> New research
            </Link>
          </Button>
        }
      />

      {/* Stats — all genuine zeros for a new workspace. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATS.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
                  <Icon className="size-4" />
                </div>
                <div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {s.value}
                  </div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="group flex items-center gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{a.label}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {a.hint}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent activity — empty states until data exists. */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent projects</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyList message="No projects yet. Create one to group papers, notes, and reports." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recently analyzed papers</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyList message="No papers analyzed yet. Start from New research." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Saved reports</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyList message="No saved reports yet." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent agent runs</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyList message="No agent runs yet. Give the agent a goal to get started." />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
