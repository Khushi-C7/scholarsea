/**
 * Extract a paper's own reference list from its text. These come straight from
 * the document — nothing is invented. Returns [] when no reference section is
 * found.
 */
export function extractReferences(fullText: string | null): string[] {
  if (!fullText) return [];

  const m = fullText.match(/\b(references|bibliography)\b\s*:?\s*/i);
  if (!m || m.index === undefined) return [];

  const section = fullText.slice(m.index + m[0].length);

  let entries: string[];
  if (/\[\d+\]/.test(section)) {
    // [1] Author... [2] Author...
    entries = section.split(/\s*\[\d+\]\s*/);
  } else if (/\n\s*\d+\.\s/.test(section)) {
    // 1. Author...\n2. Author...
    entries = section.split(/\n\s*\d+\.\s/);
  } else {
    entries = section.split(/\n/);
  }

  return entries
    .map((e) => e.replace(/\s+/g, " ").trim())
    .filter((e) => e.length > 20)
    .slice(0, 100)
    .map((e) => e.slice(0, 600));
}
