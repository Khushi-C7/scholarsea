import Link from "next/link";
import { redirect } from "next/navigation";
import { MessagesSquare } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { listConversations } from "@/lib/chat/service";
import { listProjectPapers } from "@/lib/projects/service";
import { PageContainer, PageHeader } from "@/components/layout/page";
import {
  NewConversationButton,
  type ChatPaperOption,
} from "@/components/chat/new-conversation";

export const metadata = { title: "Research Chat" };

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ paper?: string; project?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { paper, project } = await searchParams;

  const [conversations, paperRows] = await Promise.all([
    listConversations(user.id),
    prisma.paper.findMany({
      where: { ownerId: user.id, extractionStatus: "COMPLETED" },
      select: { id: true, title: true, authors: true, year: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const papers: ChatPaperOption[] = paperRows.map((p) => ({
    id: p.id,
    title: p.title,
    authors: p.authors,
    year: p.year,
  }));
  const valid = new Set(papers.map((p) => p.id));

  // Resolve a scope preset from ?paper= or ?project=.
  let preset: string[] = [];
  if (paper && valid.has(paper)) {
    preset = [paper];
  } else if (project) {
    const members = await listProjectPapers(user.id, project).catch(() => []);
    preset = members.map((m) => m.paperId).filter((id) => valid.has(id));
  }

  return (
    <PageContainer>
      <PageHeader
        title="Research Chat"
        description="Ask questions grounded in one paper or a collection. Answers cite the passages they come from."
        actions={
          <NewConversationButton papers={papers} presetPaperIds={preset} />
        }
      />

      {conversations.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
            <MessagesSquare className="size-6" />
          </div>
          <h2 className="text-base font-semibold">No conversations yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Start a conversation scoped to one paper or a collection, and ask
            questions answered only from those papers.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/chat/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <MessagesSquare className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {c.title ?? "Untitled conversation"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.paperCount} paper{c.paperCount === 1 ? "" : "s"} ·{" "}
                      {c.messageCount} message{c.messageCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(c.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
