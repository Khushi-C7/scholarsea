"use client";

import * as React from "react";
import { Loader2, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LibraryPaper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
}

export function AddPaperDialog({
  open,
  onOpenChange,
  projectId,
  excludeIds,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  excludeIds: string[];
  onAdded: () => void;
}) {
  const [papers, setPapers] = React.useState<LibraryPaper[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [addingId, setAddingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const r = await fetch("/api/papers");
        const d = await r.json();
        if (!cancelled) setPapers(d.papers ?? []);
      } catch {
        if (!cancelled) setPapers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const exclude = new Set(excludeIds);
  const available = papers
    .filter((p) => !exclude.has(p.id))
    .filter((p) =>
      q.trim() ? p.title.toLowerCase().includes(q.trim().toLowerCase()) : true
    );

  async function add(paperId: string) {
    setAddingId(paperId);
    try {
      const res = await fetch(`/api/projects/${projectId}/papers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paperId }),
      });
      if (res.ok) {
        setPapers((ps) => ps.filter((p) => p.id !== paperId));
        onAdded();
      }
    } finally {
      setAddingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add papers to this project</DialogTitle>
        </DialogHeader>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter your library…"
            className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : available.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {papers.length === 0
                ? "Your library is empty. Add papers from New Research first."
                : "No matching papers not already in this project."}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {available.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.authors.slice(0, 2).join(", "), p.year]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => add(p.id)}
                    disabled={addingId === p.id}
                  >
                    {addingId === p.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Plus />
                    )}
                    Add
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
