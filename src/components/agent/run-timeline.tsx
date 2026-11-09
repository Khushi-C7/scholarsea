"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  Ban,
  CircleDot,
  Play,
  RotateCcw,
  Quote,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AgentSessionView, AgentStepView } from "@/lib/agent/types";

function StepIcon({ status }: { status: AgentStepView["status"] }) {
  switch (status) {
    case "COMPLETED":
      return <CheckCircle2 className="size-5 text-[color:var(--success)]" />;
    case "FAILED":
      return <XCircle className="size-5 text-[color:var(--destructive)]" />;
    case "PROCESSING":
      return <Loader2 className="size-5 animate-spin text-primary" />;
    case "CANCELLED":
      return <Ban className="size-5 text-muted-foreground" />;
    default:
      return <Circle className="size-5 text-muted-foreground/40" />;
  }
}

export function RunTimeline({ initial }: { initial: AgentSessionView }) {
  const params = useSearchParams();
  const [session, setSession] = React.useState(initial);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // A ref the advance loop checks so Cancel stops it promptly.
  const stop = React.useRef(false);

  const post = React.useCallback(
    async (path: string, body?: unknown): Promise<AgentSessionView | null> => {
      const res = await fetch(path, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "Something went wrong.");
        return null;
      }
      if (data.session) setSession(data.session);
      return data.session ?? null;
    },
    []
  );

  const drive = React.useCallback(async () => {
    if (running) return;
    setError(null);
    setRunning(true);
    stop.current = false;
    try {
      // Advance one step at a time so the timeline updates live.
      for (let i = 0; i < 20; i++) {
        if (stop.current) break;
        const res = await fetch(`/api/agent/sessions/${initial.id}/advance`, {
          method: "POST",
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError(data?.error?.message ?? "A step failed.");
          if (data?.session) setSession(data.session);
          break;
        }
        setSession(data.session);
        if (data.done) break;
        await new Promise((r) => setTimeout(r, 450)); // let the UI breathe
      }
    } finally {
      setRunning(false);
    }
  }, [initial.id, running]);

  // Auto-start when arriving from "Start research run".
  const autostart = params.get("autostart") === "1";
  const started = React.useRef(false);
  React.useEffect(() => {
    if (autostart && !started.current && session.status === "PENDING") {
      started.current = true;
      void drive();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autostart]);

  async function cancel() {
    stop.current = true;
    await post(`/api/agent/sessions/${session.id}/cancel`);
    setRunning(false);
  }

  async function retry(stepIndex: number) {
    const updated = await post(`/api/agent/sessions/${session.id}/retry`, {
      stepIndex,
    });
    if (updated) void drive();
  }

  const active = session.status === "PENDING" || session.status === "PROCESSING";
  const failedStep = session.steps.find((s) => s.status === "FAILED");

  return (
    <div className="space-y-5">
      {/* Controls + budget */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {active && !running ? (
            <Button onClick={drive} size="sm">
              <Play /> {session.steps.some((s) => s.status === "COMPLETED") ? "Resume" : "Run"}
            </Button>
          ) : null}
          {running ? (
            <Button onClick={cancel} size="sm" variant="outline">
              <Ban /> Cancel
            </Button>
          ) : null}
          {failedStep && !running ? (
            <Button onClick={() => retry(failedStep.index)} size="sm" variant="outline">
              <RotateCcw /> Retry from failed step
            </Button>
          ) : null}
          <StatusBadge status={session.status} />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            Tools {session.toolCallsUsed}/{session.limits.maxToolCalls}
          </span>
          <span>
            Tokens {session.tokensUsed}/{session.limits.tokenBudget}
          </span>
          <span>Max {Math.round(session.limits.maxRuntimeMs / 1000)}s</span>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-[color:var(--destructive)]">{error}</p>
      ) : null}
      {session.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-[color:var(--destructive)]">
          {session.error}
        </div>
      ) : null}

      {/* Execution timeline */}
      <ol className="space-y-2">
        {session.steps.map((s) => (
          <li
            key={s.index}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3",
              s.status === "PROCESSING" && "border-primary/40 bg-accent/30"
            )}
          >
            <div className="mt-0.5">
              <StepIcon status={s.status} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium capitalize">
                  {s.type.toLowerCase()}
                </span>
                {s.toolName ? (
                  <Badge variant="muted" className="font-mono text-[10px]">
                    {s.toolName}
                  </Badge>
                ) : null}
              </div>
              {s.summary ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{s.summary}</p>
              ) : s.status === "PENDING" ? (
                <p className="mt-0.5 text-sm text-muted-foreground/60">Queued</p>
              ) : null}
              {s.error ? (
                <p className="mt-0.5 text-sm text-[color:var(--destructive)]">
                  {s.error}
                </p>
              ) : null}
            </div>
            {s.status === "PROCESSING" ? (
              <CircleDot className="size-4 shrink-0 animate-pulse text-primary" />
            ) : null}
          </li>
        ))}
      </ol>

      {/* Final answer */}
      {session.status === "COMPLETED" && session.finalAnswer ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">Answer</h2>
            <p className="whitespace-pre-wrap text-sm text-foreground/90">
              {session.finalAnswer}
            </p>
            {session.citations.length > 0 ? (
              <div className="space-y-1.5 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Sources ({session.citations.length})
                </p>
                {session.citations.map((c, i) => (
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
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: AgentSessionView["status"] }) {
  const map: Record<string, { variant: "success" | "destructive" | "warning" | "muted"; label: string }> = {
    COMPLETED: { variant: "success", label: "Completed" },
    FAILED: { variant: "destructive", label: "Failed" },
    CANCELLED: { variant: "muted", label: "Cancelled" },
    PROCESSING: { variant: "warning", label: "Running" },
    PENDING: { variant: "muted", label: "Ready" },
  };
  const m = map[status] ?? map.PENDING;
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
