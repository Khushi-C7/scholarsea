"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const EXAMPLES = [
  "Compare recent approaches to few-shot plant disease classification and identify the most commonly reported evaluation limitations.",
  "What datasets recur across these papers, and which methods were never compared on the same one?",
];

export function NewRun({
  projects,
}: {
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [goal, setGoal] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function start() {
    if (goal.trim().length < 5) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          goal,
          projectId: projectId || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not start the run.");
        return;
      }
      router.push(`/agent/${data.id}?autostart=1`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <label htmlFor="goal" className="text-sm font-medium">
        Research goal
      </label>
      <Textarea
        id="goal"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="Give the agent a goal to research across your papers…"
        className="mt-1.5 min-h-24"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setGoal(ex)}
            className="rounded-full border px-2.5 py-1 text-left text-xs text-muted-foreground hover:bg-accent"
          >
            {ex.length > 60 ? ex.slice(0, 60) + "…" : ex}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          aria-label="Scope"
          className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All my papers</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              Project: {p.name}
            </option>
          ))}
        </select>
        <Button onClick={start} disabled={creating || goal.trim().length < 5}>
          {creating ? <Loader2 className="animate-spin" /> : <Bot />}
          Start research run
        </Button>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-[color:var(--destructive)]">{error}</p>
      ) : null}
    </div>
  );
}
