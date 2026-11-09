"use client";

import * as React from "react";
import { X, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Inline tag editor. Shows the current tags as removable chips and an input to
 * add more. Calls onChange with the new tag array; the parent persists it.
 */
export function TagEditor({
  tags,
  onChange,
  disabled,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  function add() {
    const t = draft.trim();
    if (!t || t.includes(",")) {
      setDraft("");
      return;
    }
    if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      onChange([...tags, t]);
    }
    setDraft("");
  }

  function remove(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1">
          {tag}
          {!disabled ? (
            <button
              type="button"
              onClick={() => remove(tag)}
              className="rounded-sm hover:text-foreground"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="size-3" />
            </button>
          ) : null}
        </Badge>
      ))}
      {disabled ? null : adding ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            add();
            setAdding(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            } else if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          placeholder="tag"
          autoFocus
          className={cn(
            "h-6 w-20 rounded-md border border-input bg-transparent px-1.5 text-xs",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-0.5 rounded-md border border-dashed px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-3" /> tag
        </button>
      )}
    </div>
  );
}
