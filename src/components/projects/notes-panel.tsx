"use client";

import * as React from "react";
import { Bookmark, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface NoteItem {
  id: string;
  body: string;
  bookmarked: boolean;
  updatedAt: string;
}

/** Notes for a project: add, edit inline, bookmark, delete. */
export function NotesPanel({
  projectId,
  initialNotes,
}: {
  projectId: string;
  initialNotes: NoteItem[];
}) {
  const [notes, setNotes] = React.useState<NoteItem[]>(initialNotes);
  const [draft, setDraft] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  async function add() {
    if (!draft.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, body: draft }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotes((n) => [data.note, ...n]);
        setDraft("");
      }
    } finally {
      setAdding(false);
    }
  }

  async function toggleBookmark(note: NoteItem) {
    const next = !note.bookmarked;
    setNotes((n) =>
      n.map((x) => (x.id === note.id ? { ...x, bookmarked: next } : x))
    );
    await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookmarked: next }),
    }).catch(() => {
      // revert on failure
      setNotes((n) =>
        n.map((x) => (x.id === note.id ? { ...x, bookmarked: !next } : x))
      );
    });
  }

  async function remove(note: NoteItem) {
    setNotes((n) => n.filter((x) => x.id !== note.id));
    await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note for this project…"
          className="min-h-20"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={add} disabled={adding || !draft.trim()}>
            {adding ? <Loader2 className="animate-spin" /> : null} Add note
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No notes yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border bg-card p-3">
              <p className="whitespace-pre-wrap text-sm">{note.body}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {new Date(note.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleBookmark(note)}
                    aria-label={note.bookmarked ? "Remove bookmark" : "Bookmark"}
                    className={cn(
                      "rounded-md p-1 hover:bg-accent",
                      note.bookmarked
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    <Bookmark
                      className={cn("size-4", note.bookmarked && "fill-current")}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(note)}
                    aria-label="Delete note"
                    className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-[color:var(--destructive)]"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
