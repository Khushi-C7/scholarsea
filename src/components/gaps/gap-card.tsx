"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  HelpCircle,
  XCircle,
  ShieldQuestion,
  ThumbsUp,
  ThumbsDown,
  Search,
  ExternalLink,
  Quote,
  Loader2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { GapView } from "@/lib/gaps/report-types";

function VerificationBadge({ status }: { status: GapView["verificationStatus"] }) {
  switch (status) {
    case "VERIFIED":
      return (
        <Badge variant="success">
          <CheckCircle2 /> Verified
        </Badge>
      );
    case "REFUTED":
      return (
        <Badge variant="destructive">
          <XCircle /> Refuted by evidence
        </Badge>
      );
    case "NEEDS_REVIEW":
      return (
        <Badge variant="warning">
          <ShieldQuestion /> Needs review
        </Badge>
      );
    default:
      return (
        <Badge variant="muted">
          <HelpCircle /> Unverified
        </Badge>
      );
  }
}

function EvidenceList({
  title,
  items,
  tone,
}: {
  title: string;
  items: GapView["supporting"];
  tone: "support" | "contra";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        {title} ({items.length})
      </p>
      <ul className="space-y-1.5">
        {items.map((e) => (
          <li
            key={e.id}
            className={cn(
              "rounded-md border bg-muted/30 p-2.5",
              tone === "contra" && "border-[color:var(--warning)]/30"
            )}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <Link
                href={`/library/${e.paperId}`}
                className="inline-flex items-center gap-1 truncate text-xs font-medium hover:text-primary hover:underline"
              >
                {e.paperTitle}
                <ExternalLink className="size-3 shrink-0" />
              </Link>
              {e.verified ? (
                <Badge variant="muted" className="shrink-0">
                  verified source
                </Badge>
              ) : (
                <Badge variant="warning" className="shrink-0">
                  unverified
                </Badge>
              )}
            </div>
            <p className="flex gap-1.5 text-xs italic text-muted-foreground">
              <Quote className="mt-0.5 size-3 shrink-0" />
              <span>&ldquo;{e.passage}&rdquo;</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

const REVIEW_OPTS: { value: GapView["reviewStatus"]; label: string; icon: typeof ThumbsUp }[] = [
  { value: "USEFUL", label: "Useful", icon: ThumbsUp },
  { value: "NEEDS_INVESTIGATION", label: "Investigate", icon: Search },
  { value: "REJECTED", label: "Reject", icon: ThumbsDown },
];

export function GapCard({ gap, index }: { gap: GapView; index: number }) {
  const [reviewStatus, setReviewStatus] = React.useState(gap.reviewStatus);
  const [notes, setNotes] = React.useState(gap.reviewerNotes ?? "");
  const [savingNote, setSavingNote] = React.useState(false);
  const [noteSaved, setNoteSaved] = React.useState(false);

  async function mark(status: GapView["reviewStatus"]) {
    const next = status === reviewStatus ? "NONE" : status;
    const prev = reviewStatus;
    setReviewStatus(next);
    const res = await fetch(`/api/gaps/gap/${gap.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reviewStatus: next }),
    });
    if (!res.ok) setReviewStatus(prev);
  }

  async function saveNote() {
    setSavingNote(true);
    setNoteSaved(false);
    try {
      const res = await fetch(`/api/gaps/gap/${gap.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewerNotes: notes || null }),
      });
      if (res.ok) setNoteSaved(true);
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-medium leading-snug">
            {index}. {gap.title}
          </h3>
          <VerificationBadge status={gap.verificationStatus} />
        </div>

        <p className="text-sm text-foreground/90">{gap.explanation}</p>

        {gap.significance ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Why it matters
            </p>
            <p className="text-sm">{gap.significance}</p>
          </div>
        ) : null}

        {gap.confidenceRationale ? (
          <div className="rounded-md bg-muted/40 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">
              Confidence rationale
            </p>
            <p className="text-sm">{gap.confidenceRationale}</p>
            {gap.evidenceCoverage ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {gap.evidenceCoverage}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Evidence inspector */}
        <div className="grid gap-3 sm:grid-cols-2">
          <EvidenceList
            title="Supporting evidence"
            items={gap.supporting}
            tone="support"
          />
          <EvidenceList
            title="Contradictory evidence"
            items={gap.contradicting}
            tone="contra"
          />
        </div>

        {gap.researchQuestions.length > 0 ? (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Research questions
            </p>
            <ul className="list-disc space-y-0.5 pl-5 text-sm">
              {gap.researchQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {gap.suggestedExperiments.length > 0 ? (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Suggested experiments
            </p>
            <ul className="list-disc space-y-0.5 pl-5 text-sm">
              {gap.suggestedExperiments.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Reviewer controls */}
        <div className="border-t pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted-foreground">Mark as:</span>
            {REVIEW_OPTS.map((opt) => {
              const Icon = opt.icon;
              const active = reviewStatus === opt.value;
              return (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => mark(opt.value)}
                >
                  <Icon /> {opt.label}
                </Button>
              );
            })}
          </div>
          <div className="mt-2.5 space-y-1.5">
            <Textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setNoteSaved(false);
              }}
              placeholder="Add a note on this candidate gap…"
              className="min-h-16 text-sm"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={saveNote} disabled={savingNote}>
                {savingNote ? <Loader2 className="animate-spin" /> : null} Save note
              </Button>
              {noteSaved ? (
                <span className="text-xs text-[color:var(--success)]">Saved</span>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
