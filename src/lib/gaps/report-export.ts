import type { GapAnalysisView, GapView } from "@/lib/gaps/report-types";

const VERIFY_LABEL: Record<GapView["verificationStatus"], string> = {
  VERIFIED: "Verified",
  UNVERIFIED: "Unverified",
  REFUTED: "Refuted by evidence",
  NEEDS_REVIEW: "Needs review",
};

/** Step 5 — the gap report as Markdown. */
export function toGapMarkdown(a: GapAnalysisView): string {
  const L: string[] = [];
  L.push(`# Research Gap Report — ${a.projectName}`, "");
  L.push(
    `_${a.papersExamined} papers in corpus · generated ${new Date(a.createdAt).toISOString().slice(0, 10)}_`,
    ""
  );

  L.push("## Executive summary", "");
  L.push(a.executiveSummary ?? "_Not available._", "");

  L.push("## Literature coverage", "");
  L.push(a.coverageNotes ?? "_Not available._", "");

  if (a.insufficientEvidence) {
    L.push("", "## Insufficient evidence", "");
    L.push(
      a.limitations ??
        "The corpus did not contain enough analyzed papers to generate gaps.",
      ""
    );
    return L.join("\n");
  }

  if (a.patterns.length) {
    L.push("## Identified patterns", "");
    for (const p of a.patterns) {
      L.push(
        `- **${p.title}** (${p.type}${p.isAbsence ? ", absence of evidence" : ""}) — ${p.evidenceScope}`
      );
    }
    L.push("");
  }

  L.push("## Candidate research gaps", "");
  if (a.gaps.length === 0) {
    L.push("_No candidate gaps were supported by verifiable evidence._", "");
  }
  a.gaps.forEach((g, i) => {
    L.push(`### ${i + 1}. ${g.title}  \`${VERIFY_LABEL[g.verificationStatus]}\``, "");
    L.push(g.explanation, "");
    if (g.significance) L.push(`**Why it matters:** ${g.significance}`, "");
    if (g.confidenceRationale)
      L.push(`**Confidence rationale:** ${g.confidenceRationale}`, "");
    if (g.evidenceCoverage) L.push(`**Evidence coverage:** ${g.evidenceCoverage}`, "");

    if (g.supporting.length) {
      L.push("", "**Supporting evidence:**");
      for (const e of g.supporting)
        L.push(`- ${e.paperTitle}: "${e.passage}"${e.verified ? "" : " _(unverified)_"}`);
    }
    if (g.contradicting.length) {
      L.push("", "**Contradictory evidence:**");
      for (const e of g.contradicting)
        L.push(`- ${e.paperTitle}: "${e.passage}"${e.verified ? "" : " _(unverified)_"}`);
    }
    if (g.researchQuestions.length) {
      L.push("", "**Research questions:**");
      for (const q of g.researchQuestions) L.push(`- ${q}`);
    }
    if (g.suggestedExperiments.length) {
      L.push("", "**Suggested experiments:**");
      for (const x of g.suggestedExperiments) L.push(`- ${x}`);
    }
    if (g.reviewStatus !== "NONE") {
      L.push("", `_Reviewer marked: ${g.reviewStatus.toLowerCase().replace(/_/g, " ")}_`);
      if (g.reviewerNotes) L.push(`_Note: ${g.reviewerNotes}_`);
    }
    L.push("");
  });

  // References = the real papers cited anywhere in the report.
  const papers = new Map<string, string>();
  for (const g of a.gaps)
    for (const e of [...g.supporting, ...g.contradicting])
      papers.set(e.paperId, e.paperTitle);
  if (papers.size) {
    L.push("## References", "");
    let n = 1;
    for (const title of papers.values()) L.push(`${n++}. ${title}`);
    L.push("");
  }

  if (a.limitations) {
    L.push("## Limitations of this analysis", "");
    L.push(a.limitations, "");
  }
  return L.join("\n");
}

/** Step 5 — the gap report as structured JSON. */
export function toGapJson(a: GapAnalysisView): string {
  return JSON.stringify(a, null, 2);
}
