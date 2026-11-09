import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { InsightReportView } from "@/lib/documents/analysis-view";

export interface ReportClaim {
  type: string;
  text: string;
  supportingPassage: string;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-foreground/90">{children}</CardContent>
    </Card>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (items.length === 0)
    return <p className="text-sm text-muted-foreground">Not detected.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span
            aria-hidden
            className="mt-[7px] size-1.5 shrink-0 rounded-full bg-muted-foreground/50"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Prose({ text }: { text: string | null }) {
  if (!text) return <p className="text-sm text-muted-foreground">Not detected.</p>;
  return <p className="whitespace-pre-wrap leading-relaxed">{text}</p>;
}

export function InsightReport({
  report,
  claims,
}: {
  report: InsightReportView;
  claims: ReportClaim[];
}) {
  return (
    <div className="grid gap-4">
      <Section title="Summary">
        <Prose text={report.summary} />
        {report.keyPoints.length > 0 ? (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Key points
            </p>
            <Bullets items={report.keyPoints} />
          </div>
        ) : null}
      </Section>

      <Section title="Research problem">
        <Prose text={report.researchProblem} />
      </Section>

      <Section title="Motivation &amp; contributions">
        <Prose text={report.motivation} />
        {report.significance ? (
          <div className="mt-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Significance
            </p>
            <Prose text={report.significance} />
          </div>
        ) : null}
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Contributions
          </p>
          <Bullets items={report.contributions} />
        </div>
      </Section>

      <Section title="Methodology">
        <Prose text={report.methodology} />
      </Section>

      <Section title="Datasets &amp; experimental setup">
        {report.datasets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No datasets detected in the text.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {report.datasets.map((d, i) => (
              <li key={i}>
                <span className="font-medium">{d.name}</span>
                {d.description ? (
                  <span className="text-muted-foreground"> — {d.description}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Results &amp; evaluation metrics">
        <Bullets items={report.results} />
        {report.metrics.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {report.metrics.map((m, i) => (
              <Badge key={i} variant="secondary">
                {m.name}
                {m.value ? `: ${m.value}` : ""}
              </Badge>
            ))}
          </div>
        ) : null}
      </Section>

      <Section title="Limitations">
        <Bullets items={report.limitations} />
      </Section>

      {report.synthesizer ? (
        <Section title="Conclusions">
          <Bullets items={report.synthesizer.conclusions} />
          {report.synthesizer.keyTakeaways.length > 0 ? (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Key takeaways
              </p>
              <Bullets items={report.synthesizer.keyTakeaways} />
            </div>
          ) : null}
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Evidence confidence:</span>
            <Badge variant="muted">{report.synthesizer.confidence}</Badge>
            <span className="text-muted-foreground/80">
              {report.synthesizer.confidenceRationale}
            </span>
          </div>
        </Section>
      ) : null}

      <Section title="Technical terminology">
        {report.terminology.length === 0 ? (
          <p className="text-sm text-muted-foreground">No terms detected.</p>
        ) : (
          <dl className="space-y-2">
            {report.terminology.map((t, i) => (
              <div key={i}>
                <dt className="font-medium">{t.term}</dt>
                <dd className="text-muted-foreground">{t.definition}</dd>
              </div>
            ))}
          </dl>
        )}
      </Section>

      <Section title="Related work">
        {report.relatedWork.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No related-work themes identified.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {report.relatedWork.map((w, i) => (
              <Badge key={i} variant="outline">
                {w}
              </Badge>
            ))}
          </div>
        )}
      </Section>

      <Section title="References &amp; source locations">
        {report.references.length > 0 ? (
          <div className="mb-4">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              References (extracted from the document)
            </p>
            <ol className="space-y-1 text-sm text-muted-foreground">
              {report.references.slice(0, 40).map((ref, i) => (
                <li key={i}>
                  {i + 1}. {ref}
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="mb-4 text-sm text-muted-foreground">
            No reference list was extracted from the document.
          </p>
        )}
        {claims.length > 0 ? (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Source passages behind extracted claims
            </p>
            <ul className="space-y-2">
              {claims.slice(0, 12).map((c, i) => (
                <li key={i} className="rounded-md border bg-muted/30 p-2.5">
                  <Badge variant="muted" className="mb-1">
                    {c.type}
                  </Badge>
                  <p className="text-sm italic text-muted-foreground">
                    &ldquo;{c.supportingPassage}&rdquo;
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <Section title="Suggested follow-up questions">
        <Bullets items={report.followUpQuestions} />
      </Section>
    </div>
  );
}
