import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { getConversationView } from "@/lib/chat/service";
import { NotFoundError } from "@/lib/auth/errors";
import { PageContainer } from "@/components/layout/page";
import { ConversationThread } from "@/components/chat/conversation-thread";

export const metadata = { title: "Research Chat" };

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  let conversation;
  try {
    conversation = await getConversationView(user.id, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <PageContainer className="max-w-3xl">
      <Link
        href="/chat"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All conversations
      </Link>
      <h1 className="mb-1 truncate text-lg font-semibold tracking-tight">
        {conversation.title ?? "Conversation"}
      </h1>
      <p className="mb-4 text-xs text-muted-foreground">
        Grounded in {conversation.paperIds.length} paper
        {conversation.paperIds.length === 1 ? "" : "s"}
      </p>
      <ConversationThread conversation={conversation} />
    </PageContainer>
  );
}
