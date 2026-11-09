"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Bookmark a paper. A paper "bookmark" is stored as a bookmarked note on the
 * paper (the schema's bookmark lives on notes), so the first bookmark creates
 * a marker note and un-bookmarking deletes it. `noteId` is the existing marker
 * note's id when already bookmarked.
 */
export function BookmarkButton({
  paperId,
  initialNoteId,
}: {
  paperId: string;
  initialNoteId: string | null;
}) {
  const router = useRouter();
  const [noteId, setNoteId] = React.useState<string | null>(initialNoteId);
  const [busy, setBusy] = React.useState(false);
  const bookmarked = noteId !== null;

  async function toggle() {
    setBusy(true);
    try {
      if (bookmarked) {
        await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
        setNoteId(null);
      } else {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            paperId,
            body: "Bookmarked",
            bookmarked: true,
          }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok) setNoteId(data.note.id);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={busy}
      aria-pressed={bookmarked}
    >
      <Bookmark className={cn("size-4", bookmarked && "fill-current text-primary")} />
      {bookmarked ? "Bookmarked" : "Bookmark"}
    </Button>
  );
}
