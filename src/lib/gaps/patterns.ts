/**
 * Step 2 — the comparison / pattern-detection engine.
 *
 * Pure and deterministic: given an EvidenceCorpus it returns candidate
 * patterns, each backed by evidence that points at real corpus papers. No AI,
 * no network — so nothing is invented, and every claim is source-linked.
 *
 * The central discipline (spec section E, step 2): an absence of evidence in
 * THIS corpus is never reported as proof that no research exists. Absence-type
 * patterns are flagged `isAbsence` and always carry an explicit, corpus-scoped
 * `absenceCaveat`; every pattern states how many of the analyzed papers it was
 * derived from.
 */
import type {
  EvidenceCorpus,
  CorpusPaper,
  CandidatePattern,
  PatternEvidence,
} from "@/lib/gaps/types";
import {
  clusterByOverlap,
  tokenSet,
  jaccard,
  polarity,
  EVALUATION_ASPECTS,
  mentionsAny,
} from "@/lib/gaps/text";

function scope(n: number, examined: number): string {
  return `Observed in ${n} of ${examined} analyzed paper${examined === 1 ? "" : "s"} in this corpus.`;
}

function absenceCaveat(examined: number): string {
  return `This reflects an absence of evidence in the ${examined} analyzed paper${examined === 1 ? "" : "s"} in this corpus — not proof that no such research exists. Add more papers to strengthen or overturn it.`;
}

/** Analyzed papers only — unanalyzed papers contribute no evidence. */
function analyzed(corpus: EvidenceCorpus): CorpusPaper[] {
  return corpus.papers.filter((p) => p.analyzed);
}

/** A string tagged with the paper it came from. */
interface Tagged {
  paperId: string;
  paperTitle: string;
  text: string;
}

function collect(
  papers: CorpusPaper[],
  pick: (p: CorpusPaper) => string[]
): Tagged[] {
  const out: Tagged[] = [];
  for (const p of papers) {
    for (const text of pick(p)) {
      if (text && text.trim()) {
        out.push({ paperId: p.paperId, paperTitle: p.title, text: text.trim() });
      }
    }
  }
  return out;
}

// --- 1. Repeated limitations ------------------------------------------------

function repeatedLimitations(
  papers: CorpusPaper[],
  examined: number
): CandidatePattern[] {
  const items = collect(papers, (p) => p.limitations);
  const clusters = clusterByOverlap(items, (i) => i.text);
  const out: CandidatePattern[] = [];

  for (const cluster of clusters) {
    const byPaper = new Map<string, Tagged>();
    for (const it of cluster.items) if (!byPaper.has(it.paperId)) byPaper.set(it.paperId, it);
    if (byPaper.size < 2) continue; // "repeated" needs ≥2 distinct papers

    const theme = cluster.sharedTokens.slice(0, 4).join(", ") || "a shared limitation";
    out.push({
      type: "repeated_limitation",
      title: `Recurring limitation: ${theme}`,
      description: `${byPaper.size} papers independently report a similar limitation (${theme}). A method that resolves it may address a shared weakness.`,
      evidence: Array.from(byPaper.values()).map(
        (t): PatternEvidence => ({
          paperId: t.paperId,
          paperTitle: t.paperTitle,
          passage: t.text,
          claimType: "LIMITATION",
        })
      ),
      papersInvolved: byPaper.size,
      papersExamined: examined,
      evidenceScope: scope(byPaper.size, examined),
      isAbsence: false,
      absenceCaveat: null,
    });
  }
  return out;
}

// --- 2. Conflicting findings ------------------------------------------------

function conflictingFindings(
  papers: CorpusPaper[],
  examined: number
): CandidatePattern[] {
  const items = collect(papers, (p) => p.results);
  const out: CandidatePattern[] = [];
  const sets = items.map((i) => tokenSet(i.text));

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].paperId === items[j].paperId) continue;
      // Same topic (token overlap) but opposite polarity ⇒ candidate conflict.
      if (jaccard(sets[i], sets[j]) < 0.25) continue;
      const pi = polarity(items[i].text);
      const pj = polarity(items[j].text);
      if (
        (pi === "positive" && pj === "negative") ||
        (pi === "negative" && pj === "positive")
      ) {
        const shared = Array.from(sets[i]).filter((t) => sets[j].has(t)).slice(0, 3);
        out.push({
          type: "conflicting_findings",
          title: `Possible conflicting findings on ${shared.join(", ") || "a shared topic"}`,
          description: `Two papers report findings of opposite direction on an overlapping topic. They may disagree, or evaluate under different conditions — worth reconciling.`,
          evidence: [itemEvidence(items[i], "RESULT"), itemEvidence(items[j], "RESULT")],
          papersInvolved: 2,
          papersExamined: examined,
          evidenceScope: scope(2, examined),
          isAbsence: false,
          absenceCaveat: null,
        });
      }
    }
  }
  // De-duplicate overlapping pairs; cap to keep the signal clean.
  return out.slice(0, 10);
}

function itemEvidence(t: Tagged, claimType: PatternEvidence["claimType"]): PatternEvidence {
  return {
    paperId: t.paperId,
    paperTitle: t.paperTitle,
    passage: t.text,
    claimType,
  };
}

// --- 3. Methods not compared under similar conditions -----------------------

function uncomparedMethods(
  papers: CorpusPaper[],
  examined: number
): CandidatePattern[] {
  // Papers that declare a method/architecture.
  const withMethod = papers.filter(
    (p) => p.methods.length > 0 || p.architectures.length > 0
  );
  if (withMethod.length < 2) return [];

  // Do any two method-bearing papers share a dataset? If none share a dataset,
  // the methods have not been evaluated under comparable conditions here.
  const datasetTokens = (p: CorpusPaper) =>
    tokenSet(p.datasets.join(" "));
  let anyShared = false;
  for (let i = 0; i < withMethod.length && !anyShared; i++) {
    for (let j = i + 1; j < withMethod.length; j++) {
      if (
        withMethod[i].datasets.length &&
        withMethod[j].datasets.length &&
        jaccard(datasetTokens(withMethod[i]), datasetTokens(withMethod[j])) >= 0.3
      ) {
        anyShared = true;
        break;
      }
    }
  }
  if (anyShared) return [];

  return [
    {
      type: "uncompared_methods",
      title: "Methods not compared under shared conditions",
      description: `${withMethod.length} papers use different methods/architectures, but no two share a common dataset in this corpus — so their results are not directly comparable. A controlled head-to-head is missing.`,
      evidence: withMethod.map((p): PatternEvidence => ({
        paperId: p.paperId,
        paperTitle: p.title,
        passage:
          (p.architectures[0] ?? p.methods[0] ?? "method not specified") +
          (p.datasets.length ? ` · datasets: ${p.datasets.join(", ")}` : " · datasets: not reported"),
        claimType: p.architectures.length ? "MODEL_ARCHITECTURE" : "METHOD",
      })),
      papersInvolved: withMethod.length,
      papersExamined: examined,
      evidenceScope: scope(withMethod.length, examined),
      isAbsence: true,
      absenceCaveat: absenceCaveat(examined),
    },
  ];
}

// --- 4. Dataset / domain coverage gaps --------------------------------------

function datasetCoverageGaps(
  papers: CorpusPaper[],
  examined: number
): CandidatePattern[] {
  const withData = papers.filter((p) => p.datasets.length > 0);
  if (withData.length < 2) return [];

  // Count papers per dataset token-signature; a dataset used by only one paper
  // while others use different ones is thin coverage in this corpus.
  const evidence: PatternEvidence[] = [];
  const seen = new Map<string, { paperId: string; title: string; name: string }[]>();
  for (const p of withData) {
    for (const ds of p.datasets) {
      const key = Array.from(tokenSet(ds)).sort().join(" ") || ds.toLowerCase();
      const arr = seen.get(key) ?? [];
      arr.push({ paperId: p.paperId, title: p.title, name: ds });
      seen.set(key, arr);
    }
  }
  const singletons = Array.from(seen.values()).filter((a) => {
    const distinctPapers = new Set(a.map((x) => x.paperId));
    return distinctPapers.size === 1;
  });
  if (singletons.length === 0 || seen.size < 2) return [];

  for (const group of singletons.slice(0, 6)) {
    const g = group[0];
    evidence.push({
      paperId: g.paperId,
      paperTitle: g.title,
      passage: `Dataset "${g.name}" is used by only this paper in the corpus.`,
      claimType: "DATASET",
    });
  }

  return [
    {
      type: "dataset_coverage_gap",
      title: "Thin dataset overlap across the corpus",
      description: `Several datasets are each used by only one paper, so findings are spread across non-overlapping data. Evaluating more methods on a shared dataset would improve comparability and coverage.`,
      evidence,
      papersInvolved: new Set(evidence.map((e) => e.paperId)).size,
      papersExamined: examined,
      evidenceScope: scope(new Set(evidence.map((e) => e.paperId)).size, examined),
      isAbsence: true,
      absenceCaveat: absenceCaveat(examined),
    },
  ];
}

// --- 5. Missing robustness / generalization / deployment evaluation ---------

function missingEvaluations(
  papers: CorpusPaper[],
  examined: number
): CandidatePattern[] {
  if (papers.length === 0) return [];
  const out: CandidatePattern[] = [];

  for (const aspect of EVALUATION_ASPECTS) {
    // A paper "covers" the aspect if any result/metric/method mentions it.
    const covers = (p: CorpusPaper) =>
      [...p.results, ...p.metrics, ...p.methods, ...p.objectives].some((s) =>
        mentionsAny(s, aspect.words)
      );
    const covering = papers.filter(covers);
    // Flag the aspect only when NO analyzed paper evaluates it, OR it's raised
    // as a limitation/future-work but never actually evaluated.
    const raisedButNotEvaluated = papers.filter(
      (p) =>
        !covers(p) &&
        [...p.limitations, ...p.futureWork].some((s) => mentionsAny(s, aspect.words))
    );

    // Only flag when the corpus itself raises the aspect (as a limitation or
    // future direction) yet no paper evaluates it. If nothing in the corpus
    // even mentions it, we stay silent — asserting a gap with no supporting
    // evidence would blur absence-in-corpus with "no research exists".
    if (
      covering.length === 0 &&
      papers.length >= 2 &&
      raisedButNotEvaluated.length > 0
    ) {
      const evidence: PatternEvidence[] = raisedButNotEvaluated
        .slice(0, 6)
        .map((p) => {
          const passage =
            [...p.limitations, ...p.futureWork].find((s) =>
              mentionsAny(s, aspect.words)
            ) ?? `No ${aspect.label} reported.`;
          return {
            paperId: p.paperId,
            paperTitle: p.title,
            passage,
            claimType: "LIMITATION",
          };
        });
      out.push({
        type: "missing_evaluation",
        title: `No ${aspect.label} in the corpus`,
        description: `None of the ${papers.length} analyzed papers report a ${aspect.label}. ${
          raisedButNotEvaluated.length > 0
            ? `${raisedButNotEvaluated.length} explicitly note it as a limitation or future direction.`
            : ""
        }`.trim(),
        evidence,
        papersInvolved: new Set(evidence.map((e) => e.paperId)).size,
        papersExamined: examined,
        evidenceScope: `None of ${examined} analyzed papers in this corpus report a ${aspect.label}.`,
        isAbsence: true,
        absenceCaveat: absenceCaveat(examined),
      });
    }
  }
  return out;
}

// --- 6. Recurring future-work directions ------------------------------------

function recurringFutureWork(
  papers: CorpusPaper[],
  examined: number
): CandidatePattern[] {
  const items = collect(papers, (p) => p.futureWork);
  const clusters = clusterByOverlap(items, (i) => i.text);
  const out: CandidatePattern[] = [];

  for (const cluster of clusters) {
    const byPaper = new Map<string, Tagged>();
    for (const it of cluster.items) if (!byPaper.has(it.paperId)) byPaper.set(it.paperId, it);
    if (byPaper.size < 2) continue;
    const theme = cluster.sharedTokens.slice(0, 4).join(", ") || "a shared direction";
    out.push({
      type: "recurring_future_work",
      title: `Recurring future-work direction: ${theme}`,
      description: `${byPaper.size} papers point to a similar future direction (${theme}). A recurring open direction is a strong candidate gap.`,
      evidence: Array.from(byPaper.values()).map((t) => itemEvidence(t, "FUTURE_WORK")),
      papersInvolved: byPaper.size,
      papersExamined: examined,
      evidenceScope: scope(byPaper.size, examined),
      isAbsence: false,
      absenceCaveat: null,
    });
  }
  return out;
}

export interface PatternResult {
  patterns: CandidatePattern[];
  papersExamined: number;
  papersAnalyzed: number;
  /** When too little evidence exists to detect patterns responsibly. */
  insufficientEvidence: boolean;
  insufficientReason: string | null;
}

/**
 * Detect candidate patterns across the corpus. Returns an explicit
 * insufficient-evidence signal (rather than fabricating patterns) when fewer
 * than two analyzed papers are available.
 */
export function detectPatterns(corpus: EvidenceCorpus): PatternResult {
  const papers = analyzed(corpus);
  const examined = papers.length;

  if (examined < 2) {
    return {
      patterns: [],
      papersExamined: corpus.papersExamined,
      papersAnalyzed: examined,
      insufficientEvidence: true,
      insufficientReason:
        examined === 0
          ? "No analyzed papers in this project yet. Analyze at least two papers to detect cross-paper patterns."
          : "Only one analyzed paper. Cross-paper patterns need at least two analyzed papers in the corpus.",
    };
  }

  const patterns = [
    ...repeatedLimitations(papers, examined),
    ...conflictingFindings(papers, examined),
    ...uncomparedMethods(papers, examined),
    ...datasetCoverageGaps(papers, examined),
    ...missingEvaluations(papers, examined),
    ...recurringFutureWork(papers, examined),
  ];

  return {
    patterns,
    papersExamined: corpus.papersExamined,
    papersAnalyzed: examined,
    insufficientEvidence: false,
    insufficientReason: null,
  };
}
