"use client";

import * as React from "react";
import Link from "next/link";
import {
  SendHorizontal,
  Loader2,
  Quote,
  ExternalLink,
  Info,
  FlaskConical,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatMessageView, ConversationView } from "@/lib/chat/types";

export function ConversationThread({
  conversation,
}: {
  conversation: ConversationView;
}) {
  const [messages, setMessages] = React.useState<ChatMessageView[]>(
    conversation.messages
  );
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [demo, setDemo] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  async function send() {
    const q = input.trim();
    if (!q || pending) return;
    setInput("");
    setError(null);
    // Optimistic user message.
    const optimistic: ChatMessageView = {
      id: `tmp-${Date.now()}`,
      role: "USER",
      content: q,
      citations: [],
      insufficient: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setPending(true);
    try {
      const res = await fetch(
        `/api/chat/conversations/${conversation.id}/messages`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question: q }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "Something went wrong.");
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setInput(q);
        return;
      }
      setDemo(Boolean(data.demo));
      setMessages((m) => [
        ...m.filter((x) => x.id !== optimistic.id),
        data.userMessage,
        data.assistantMessage,
      ]);
    } catch {
      setError("Network error. Please try again.");
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setInput(q);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-13rem)] flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
            Ask a question about{" "}
            {conversation.paperIds.length === 1
              ? "this paper"
              : `these ${conversation.paperIds.length} papers`}
            . Answers come only from their content, with sources shown.
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
        {pending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Searching the papers…
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      {demo ? (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <FlaskConical className="size-3.5 text-[color:var(--warning)]" />
          Demo mode: answers are extractive (retrieved passages), not model-synthesized.
        </div>
      ) : null}
      {error ? (
        <p className="mb-2 text-sm text-[color:var(--destructive)]">{error}</p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2 border-t pt-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask about the selected papers…"
          rows={1}
          className="max-h-32 min-h-10 flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" size="icon" disabled={pending || !input.trim()}>
          <SendHorizontal className="size-4" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessageView }) {
  const isUser = message.role === "USER";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : message.insufficient
              ? "border border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10"
              : "border bg-card"
        )}
      >
        {message.insufficient ? (
          <p className="flex items-start gap-1.5">
            <Info className="mt-0.5 size-4 shrink-0 text-[color:var(--warning)]" />
            <span className="whitespace-pre-wrap">{message.content}</span>
          </p>
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}

        {message.citations.length > 0 ? (
          <div className="mt-2.5 space-y-1.5 border-t border-border/60 pt-2">
            <p className="text-xs font-medium opacity-70">
              Sources ({message.citations.length})
            </p>
            {message.citations.map((c, i) => (
              <div key={i} className="rounded-md bg-muted/40 p-2">
                <Link
                  href={`/library/${c.paperId}`}
                  className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                >
                  {c.paperTitle}
                  <ExternalLink className="size-3" />
                </Link>
                <p className="mt-0.5 flex gap-1 text-xs italic text-muted-foreground">
                  <Quote className="mt-0.5 size-3 shrink-0" />
                  <span>&ldquo;{c.passage}&rdquo;</span>
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
