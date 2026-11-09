import type { PaperAnalysis } from "@/generated/prisma/client";

/** Defensive coercers for the loosely-typed Json columns. */
function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function objArray<T>(v: unknown, map: (o: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const item of v) {
    if (item && typeof item === "object") {
      const mapped = map(item as Record<string, unknown>);
      if (mapped) out.push(mapped);
    }
  }
  return out;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export interface Dataset {
  name: string;
  description: string | null;
}
export interface Metric {
  name: string;
  value: string | null;
}
export interface Term {
  term: string;
  definition: string;
  relatedTerms: string[];
}
export interface SynthesizerView {
  conclusions: string[];
  keyTakeaways: string[];
  confidence: string;
  confidenceRationale: string;
}
export interface StageView {
  name: string;
  status: string;
  ms: number;
  tokensUsed: number;
  attempts: number;
  error?: string;
}

export interface InsightReportView {
  id: string;
  version: number;
  status: string;
  modelProvider: string | null;
  modelName: string | null;
  tokensUsed: number | null;
  createdAt: Date;
  demo: boolean;
  error: string | null;

  documentType: string | null;
  summary: string | null;
  keyPoints: string[];
  sectionsDetected: string[];
  researchProblem: string | null;
  motivation: string | null;
  significance: string | null;
  methodology: string | null;
  contributions: string[];
  datasets: Dataset[];
  metrics: Metric[];
  results: string[];
  limitations: string[];
  terminology: Term[];
  relatedWork: string[];
  references: string[];
  followUpQuestions: string[];
  synthesizer: SynthesizerView | null;
  stages: StageView[];
}

/** Normalize a PaperAnalysis row into a typed, render-ready view. */
export function toInsightReportView(a: PaperAnalysis): InsightReportView {
  const extras = (a.report && typeof a.report === "object" ? a.report : {}) as Record<
    string,
    unknown
  >;
  const synthRaw = extras.synthesizer;
  const synthesizer =
    synthRaw && typeof synthRaw === "object"
      ? {
          conclusions: strArray((synthRaw as Record<string, unknown>).conclusions),
          keyTakeaways: strArray((synthRaw as Record<string, unknown>).keyTakeaways),
          confidence: str((synthRaw as Record<string, unknown>).confidence) ?? "unknown",
          confidenceRationale:
            str((synthRaw as Record<string, unknown>).confidenceRationale) ?? "",
        }
      : null;

  return {
    id: a.id,
    version: a.version,
    status: a.status,
    modelProvider: a.modelProvider,
    modelName: a.modelName,
    tokensUsed: a.tokensUsed,
    createdAt: a.createdAt,
    demo: extras.demo === true || a.modelProvider === "demo",
    error: a.error,

    documentType: str(extras.documentType),
    summary: a.summary,
    keyPoints: strArray(extras.keyPoints),
    sectionsDetected: strArray(extras.sectionsDetected),
    researchProblem: a.researchProblem,
    motivation: a.motivation,
    significance: str(extras.significance),
    methodology: a.methodology,
    contributions: strArray(a.contributions),
    datasets: objArray<Dataset>(a.datasets, (o) =>
      typeof o.name === "string"
        ? { name: o.name, description: str(o.description) }
        : null
    ),
    metrics: objArray<Metric>(a.metrics, (o) =>
      typeof o.name === "string" ? { name: o.name, value: str(o.value) } : null
    ),
    results: strArray(a.results),
    limitations: strArray(a.limitations),
    terminology: objArray<Term>(a.terminology, (o) =>
      typeof o.term === "string" && typeof o.definition === "string"
        ? {
            term: o.term,
            definition: o.definition,
            relatedTerms: strArray(o.relatedTerms),
          }
        : null
    ),
    relatedWork: strArray(a.relatedWork),
    references: strArray(a.references),
    followUpQuestions: strArray(a.followUpQuestions),
    synthesizer,
    stages: objArray<StageView>(extras.stages, (o) =>
      typeof o.name === "string"
        ? {
            name: o.name,
            status: String(o.status ?? ""),
            ms: Number(o.ms ?? 0),
            tokensUsed: Number(o.tokensUsed ?? 0),
            attempts: Number(o.attempts ?? 0),
            error: str(o.error) ?? undefined,
          }
        : null
    ),
  };
}
