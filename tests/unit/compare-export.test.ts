import { describe, it, expect } from "vitest";

import { compareRequestSchema } from "@/lib/validation/compare";
import { COMPARE_MIN, COMPARE_MAX } from "@/lib/compare/config";
import { toMarkdown, toCsv, toJson, paperShortLabel } from "@/lib/compare/export";
import { NOT_REPORTED, type Comparison } from "@/lib/compare/types";

const SAMPLE: Comparison = {
  papers: [
    { paperId: "p1", title: "Alpha Net", authors: ["A. Rivera"], year: 2023, analyzed: true },
    { paperId: "p2", title: "Beta Net", authors: ["L. Chen"], year: 2024, analyzed: true },
  ],
  rows: [
    {
      key: "objective",
      label: "Research objective",
      cells: [
        { paperId: "p1", values: ["Few-shot leaf disease"], sources: ["we address few-shot"], reported: true },
        { paperId: "p2", values: ["Crop disease meta-learning"], sources: [], reported: true },
      ],
    },
    {
      key: "metrics",
      label: "Evaluation metrics",
      cells: [
        { paperId: "p1", values: ["Accuracy: 78.4%"], sources: [], reported: true },
        { paperId: "p2", values: [], sources: [], reported: false },
      ],
    },
  ],
  generatedAt: "2026-01-01T00:00:00.000Z",
};

describe("compareRequestSchema", () => {
  it("rejects fewer than the minimum", () => {
    expect(compareRequestSchema.safeParse({ paperIds: ["a"] }).success).toBe(false);
  });
  it("rejects more than the maximum", () => {
    const ids = Array.from({ length: COMPARE_MAX + 1 }, (_, i) => `p${i}`);
    expect(compareRequestSchema.safeParse({ paperIds: ids }).success).toBe(false);
  });
  it("de-duplicates before the count check", () => {
    // Two distinct after dedupe → valid at the minimum.
    const r = compareRequestSchema.safeParse({ paperIds: ["a", "a", "b"] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.paperIds).toEqual(["a", "b"]);
  });
  it("rejects a set that collapses below the minimum after dedupe", () => {
    expect(
      compareRequestSchema.safeParse({ paperIds: ["a", "a", "a"] }).success
    ).toBe(false);
    expect(COMPARE_MIN).toBe(2);
  });
});

describe("export formatters", () => {
  it("markdown renders Not reported for empty cells", () => {
    const md = toMarkdown(SAMPLE);
    expect(md).toContain("| Research objective |");
    expect(md).toContain(NOT_REPORTED);
    expect(md).toContain("Rivera 2023");
  });
  it("csv escapes and includes a header + not-reported", () => {
    const csv = toCsv(SAMPLE);
    const [header] = csv.split("\r\n");
    expect(header.startsWith('"Dimension"')).toBe(true);
    expect(csv).toContain(NOT_REPORTED);
  });
  it("json round-trips and preserves the reported flags + sources", () => {
    const parsed = JSON.parse(toJson(SAMPLE));
    expect(parsed.rows[1].cells[1].reported).toBe(false);
    expect(parsed.rows[0].cells[0].sources).toEqual(["we address few-shot"]);
  });
  it("paperShortLabel uses last name + year", () => {
    expect(paperShortLabel(SAMPLE.papers[0])).toBe("Rivera 2023");
  });
});
