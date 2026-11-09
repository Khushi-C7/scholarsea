/**
 * Versioned prompt templates for the analysis agents. Every prompt enforces
 * the same grounding contract: base statements only on the supplied text, and
 * never invent citations, authors, numbers, or page references.
 */

export const PROMPT_VERSION = "2026-10-17";

const GROUNDING =
  "You are a meticulous research assistant. Base every statement strictly on the provided document text. " +
  "Never invent paper titles, authors, citations, quotations, numeric results, datasets, or page numbers. " +
  "If information is not present, omit it or use an empty value — do not guess. " +
  "Respond with ONLY a single JSON object: no prose, no explanation, no Markdown code fences.";

export interface Prompt {
  system: string;
  user: string;
}

export function readerPrompt(input: { title: string; text: string }): Prompt {
  return {
    system: `${GROUNDING}\n\nRole: Reader. You read a document and produce a faithful structured summary.`,
    user:
      `Title: ${input.title}\n\n` +
      `Document text:\n"""\n${input.text}\n"""\n\n` +
      `Return JSON with exactly these fields:\n` +
      `- documentType: a short label (e.g. "research paper", "survey", "technical report")\n` +
      `- summary: a faithful 3-6 sentence summary\n` +
      `- keyPoints: array of the main points (1-12 short strings)\n` +
      `- sectionsDetected: array of section headings you can identify (may be empty)`,
  };
}

export function analyzerPrompt(input: {
  title: string;
  text: string;
  readerSummary: string;
}): Prompt {
  return {
    system: `${GROUNDING}\n\nRole: Analyzer. You extract the research structure of the paper.`,
    user:
      `Title: ${input.title}\n\nSummary so far: ${input.readerSummary}\n\n` +
      `Document text:\n"""\n${input.text}\n"""\n\n` +
      `Return JSON with exactly these fields:\n` +
      `- researchProblem: the problem the paper addresses\n` +
      `- methodology: the methods/approach used\n` +
      `- datasets: array of { name, description } for datasets used (may be empty)\n` +
      `- metrics: array of { name, value } for evaluation metrics (value may be omitted)\n` +
      `- results: array of key reported results (strings)\n` +
      `- contributions: array of stated contributions\n` +
      `- limitations: array of stated or evident limitations\n` +
      `- claims: array of { type, text, supportingPassage } where type is one of ` +
      `OBJECTIVE, METHOD, MODEL_ARCHITECTURE, DATASET, METRIC, RESULT, LIMITATION, FUTURE_WORK, CONTRIBUTION, ASSUMPTION, CONTEXT, ` +
      `and supportingPassage is a short VERBATIM quote from the text that backs the claim.`,
  };
}

export function terminologyPrompt(input: { text: string }): Prompt {
  return {
    system: `${GROUNDING}\n\nRole: Terminology analyzer. You identify technical terms and how they relate.`,
    user:
      `Document text:\n"""\n${input.text}\n"""\n\n` +
      `Return JSON with field:\n` +
      `- terms: array of { term, definition, relatedTerms } where definition is grounded in the text ` +
      `and relatedTerms lists other terms from this document it connects to (may be empty).`,
  };
}

export function knowledgePrompt(input: {
  title: string;
  researchProblem: string;
  contributions: string[];
  methodology: string;
}): Prompt {
  return {
    system: `${GROUNDING}\n\nRole: Knowledge builder. You synthesize motivation and open questions. Do NOT cite or name any specific external papers — describe related work only as themes/areas.`,
    user:
      `Title: ${input.title}\n` +
      `Research problem: ${input.researchProblem}\n` +
      `Methodology: ${input.methodology}\n` +
      `Contributions: ${input.contributions.join("; ")}\n\n` +
      `Return JSON with exactly these fields:\n` +
      `- motivation: why this problem matters, per the paper\n` +
      `- significance: the significance of the contributions\n` +
      `- relatedWorkThemes: array of research AREAS/themes this work relates to (NOT specific papers)\n` +
      `- followUpQuestions: array of concrete follow-up research questions`,
  };
}

export function synthesizerPrompt(input: {
  researchProblem: string;
  results: string[];
  limitations: string[];
}): Prompt {
  return {
    system: `${GROUNDING}\n\nRole: Synthesizer. You draw structured conclusions from the extracted evidence only.`,
    user:
      `Research problem: ${input.researchProblem}\n` +
      `Results: ${input.results.join("; ")}\n` +
      `Limitations: ${input.limitations.join("; ")}\n\n` +
      `Return JSON with exactly these fields:\n` +
      `- conclusions: array of conclusions supported by the evidence above\n` +
      `- keyTakeaways: array of the most important takeaways\n` +
      `- confidence: one of "low", "medium", "high" — your confidence that the conclusions are well-supported by the available evidence\n` +
      `- confidenceRationale: why you chose that confidence level`,
  };
}

export function comparatorPrompt(input: {
  papers: { paperId: string; title: string; analysisJson: string }[];
  dimensions: string[];
}): Prompt {
  return {
    system: `${GROUNDING}\n\nRole: Comparator. You compare multiple papers across consistent dimensions, using only each paper's provided analysis. Leave a value empty if a paper does not report it.`,
    user:
      `Compare these papers across the dimensions: ${input.dimensions.join(", ")}.\n\n` +
      input.papers
        .map(
          (p) =>
            `Paper id: ${p.paperId}\nTitle: ${p.title}\nAnalysis: ${p.analysisJson}`
        )
        .join("\n\n") +
      `\n\nReturn JSON with fields:\n` +
      `- dimensions: array of { dimension, values: [{ paperId, value }] } covering every paper for each dimension\n` +
      `- summary: a short synthesis of the key similarities and differences`,
  };
}
