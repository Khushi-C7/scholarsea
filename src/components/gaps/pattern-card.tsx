import {
  AlertTriangle,
  GitFork,
  Layers,
  Database,
  FlaskConical,
  Compass,
  Quote,
  Info,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CandidatePattern, PatternType } from "@/lib/gaps/types";

const META: Record<
  PatternType,
  { label: string; icon: typeof AlertTriangle }
> = {
  repeated_limitation: { label: "Repeated limitation", icon: AlertTriangle },
  conflicting_findings: { label: "Conflicting findings", icon: GitFork },
  uncompared_methods: { label: "Uncompared methods", icon: Layers },
  dataset_coverage_gap: { label: "Coverage gap", icon: Database },
  missing_evaluation: { label: "Missing evaluation", icon: FlaskConical },
  recurring_future_work: { label: "Recurring future work", icon: Compass },
};

export function PatternCard({ pattern }: { pattern: CandidatePattern }) {
  const meta = META[pattern.type];
  const Icon = meta.icon;
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
              <Icon className="size-4" />
            </div>
            <div>
              <h3 className="font-medium leading-snug">{pattern.title}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">{meta.label}</Badge>
                {pattern.isAbsence ? (
                  <Badge variant="warning">Absence of evidence</Badge>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-foreground/90">{pattern.description}</p>

        {/* Corpus-scope: always states this is relative to the analyzed corpus */}
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          {pattern.evidenceScope}
        </p>

        {/* The critical distinction, made explicit for absence patterns */}
        {pattern.isAbsence && pattern.absenceCaveat ? (
          <p className="rounded-md border border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10 px-2.5 py-2 text-xs text-foreground/80">
            {pattern.absenceCaveat}
          </p>
        ) : null}

        {/* Evidence — each item points at a real corpus paper + passage */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Evidence ({pattern.evidence.length})
          </p>
          <ul className="space-y-1.5">
            {pattern.evidence.map((e, i) => (
              <li key={i} className="rounded-md border bg-muted/30 p-2.5">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="truncate text-xs font-medium">
                    {e.paperTitle}
                  </span>
                  {e.claimType ? (
                    <Badge variant="muted" className="shrink-0">
                      {e.claimType}
                    </Badge>
                  ) : null}
                </div>
                <p className="flex gap-1.5 text-xs italic text-muted-foreground">
                  <Quote className="mt-0.5 size-3 shrink-0" />
                  <span>&ldquo;{e.passage}&rdquo;</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
