import type { CandidatePattern } from "@/lib/gaps/types";
import type { EvidenceMenuItem } from "@/lib/gaps/gap-gen-types";
import type { Prompt } from "@/prompts/analysis";

export const GAP_PROMPT_VERSION = "2026-10-18";

/**
 * Prompt for candidate-gap generation. The model receives detected patterns
 * and a numbered evidence menu, and must express every citation as an
 * evidenceId drawn from that menu. It is explicitly forbidden to invent paper
 * titles, authors, citations, quotations, or results.
 */
export function gapGenerationPrompt(input: {
  patterns: CandidatePattern[];
  menu: EvidenceMenuItem[];
  papersExamined: number;
}): Prompt {
  const menuText = input.menu
    .map(
      (m) =>
        `  ${m.evidenceId}: [${m.claimType ?? "CLAIM"}] "${m.passage}" (paper: ${m.paperTitle})`
    )
    .join("\n");

  const patternText = input.patterns
    .map(
      (p, i) =>
        `  Pattern ${i + 1} (${p.type}): ${p.title} — ${p.description}${
          p.isAbsence ? " [ABSENCE: scoped to this corpus only]" : ""
        }`
    )
    .join("\n");

  const system =
    "You are a careful research-gap analyst. You identify candidate research gaps strictly from the supplied evidence about an analyzed corpus. " +
    "ABSOLUTE RULES: Never invent paper titles, authors, citations, quotations, numbers, or results. " +
    "Cite evidence ONLY by its evidenceId from the menu — never quote or name papers yourself. " +
    "Base every gap on the patterns and evidence provided. If a candidate gap concerns something ABSENT from the corpus, say so as absence of evidence in these papers, never as proof that no research exists. " +
    "Confidence must reflect the observable evidence (how many papers, whether anything contradicts it), not your own certainty. " +
    "Respond with ONLY a single JSON object, no prose or code fences.";

  const user =
    `Corpus size: ${input.papersExamined} analyzed papers.\n\n` +
    `Detected patterns:\n${patternText || "  (none)"}\n\n` +
    `Evidence menu (reference these ids only):\n${menuText || "  (none)"}\n\n` +
    `Produce JSON:\n` +
    `- executiveSummary: a short, evidence-grounded overview of the gap landscape in THIS corpus\n` +
    `- gaps: array (0-15) of candidate gaps, each with:\n` +
    `  - title: concise\n` +
    `  - explanation: what the gap is\n` +
    `  - significance: why it matters\n` +
    `  - confidenceRationale: your reasoning, citing how much evidence supports it and whether anything contradicts it\n` +
    `  - supportingEvidenceIds: evidenceIds from the menu that support the gap (may be empty)\n` +
    `  - contradictingEvidenceIds: evidenceIds that provide countervailing evidence (may be empty)\n` +
    `  - suggestedExperiments: concrete experiments or studies to address the gap\n` +
    `  - researchQuestions: specific questions the gap raises\n\n` +
    `If the evidence is too thin to support any gap, return an empty gaps array and explain what is missing in executiveSummary.`;

  return { system, user };
}
