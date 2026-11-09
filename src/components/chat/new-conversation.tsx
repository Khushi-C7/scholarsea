"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessagesSquare, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface ChatPaperOption {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
}

export function NewConversationButton({
  papers,
  presetPaperIds = [],
}: {
  papers: ChatPaperOption[];
  presetPaperIds?: string[];
}) {
  const router = useRouter();
  // Initialize from the scope preset (e.g. arriving from a paper/project):
  // open the dialog with those papers already selected, no effect needed.
  const [open, setOpen] = React.useState(presetPaperIds.length > 0);
  const [selected, setSelected] = React.useState<string[]>(presetPaperIds);
  const [q, setQ] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const filtered = papers.filter((p) =>
    q.trim() ? p.title.toLowerCase().includes(q.trim().toLowerCase()) : true
  );

  function toggle(id: string) {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  }

  async function create() {
    if (selected.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paperIds: selected }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not start the conversation.");
        return;
      }
      router.push(`/chat/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={papers.length === 0}>
        <MessagesSquare /> New conversation
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chat with your papers</DialogTitle>
          </DialogHeader>
          <p className="mb-3 text-sm text-muted-foreground">
            Pick one paper or a collection to ground the conversation. Answers
            will come only from the papers you select.
          </p>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter papers…"
              className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No matching papers.
              </p>
            ) : (
              filtered.map((p) => {
                const checked = selected.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors",
                      checked ? "border-primary/50 bg-accent/50" : "hover:bg-accent/40"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(p.id)}
                      className="mt-0.5 size-4 accent-[color:var(--primary)]"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {p.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[p.authors.slice(0, 2).join(", "), p.year]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
          {error ? (
            <p className="mt-2 text-sm text-[color:var(--destructive)]">{error}</p>
          ) : null}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {selected.length} selected
            </span>
            <Button onClick={create} disabled={creating || selected.length === 0}>
              {creating ? <Loader2 className="animate-spin" /> : null}
              Start conversation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
