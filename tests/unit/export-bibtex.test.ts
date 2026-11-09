import { describe, it, expect } from "vitest";

import {
  toBibtex,
  escapeBibtex,
  isExportable,
  type ExportablePaper,
} from "@/lib/export/bibtex";
import { toMarkdown, escapeMarkdown, toJson } from "@/lib/export/papers";

function paper(over: Partial<ExportablePaper>): ExportablePaper {
  return {
    id: "p",
    title: "A Title",
    authors: [],
    year: null,
    venue: null,
    doi: null,
    arxivId: null,
    url: null,
    abstract: null,
    ...over,
  };
}

describe("escapeBibtex", () => {
  it("escapes special characters", () => {
    expect(escapeBibtex("Cost & Risk 50% #1 a_b")).toBe(
      "Cost \\& Risk 50\\% \\#1 a\\_b"
    );
  });
});

describe("toBibtex", () => {
  it("emits an @article with journal when a venue exists", () => {
    const out = toBibtex([
      paper({
        title: "Deep Nets",
        authors: ["Ada Lovelace", "Alan Turing"],
        year: 2023,
        venue: "NeurIPS",
        doi: "10.1/x",
      }),
    ]);
    expect(out).toContain("@article{");
    expect(out).toContain("author = {Ada Lovelace and Alan Turing}");
    expect(out).toContain("journal = {NeurIPS}");
    expect(out).toContain("title = {{Deep Nets}}"); // double-braced
    expect(out).toContain("doi = {10.1/x}");
  });

  it("omits fields that are absent — never invents them", () => {
    const out = toBibtex([paper({ title: "Lonely Paper" })]);
    expect(out).toContain("@misc{");
    expect(out).toContain("title = {{Lonely Paper}}");
    expect(out).not.toContain("author =");
    expect(out).not.toContain("year =");
    expect(out).not.toContain("journal =");
    expect(out).not.toContain("doi =");
  });

  it("adds arXiv eprint fields when an arxivId is present", () => {
    const out = toBibtex([paper({ title: "T", arxivId: "2305.01234" })]);
    expect(out).toContain("eprint = {2305.01234}");
    expect(out).toContain("archivePrefix = {arXiv}");
  });

  it("generates disambiguated cite keys on collision", () => {
    const p = paper({ title: "Nets", authors: ["Ada Lovelace"], year: 2023 });
    const out = toBibtex([p, { ...p, id: "p2" }]);
    const keys = [...out.matchAll(/@\w+\{([^,]+),/g)].map((m) => m[1]);
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2); // unique
    expect(keys[0]).toBe("lovelace2023nets");
    expect(keys[1]).toBe("lovelace2023netsa");
  });

  it("skips untitled entries", () => {
    expect(isExportable(paper({ title: "   " }))).toBe(false);
    expect(toBibtex([paper({ title: "" })])).toBe("");
  });
});

describe("markdown/json export", () => {
  it("escapes markdown structural characters", () => {
    expect(escapeMarkdown("a*b_c[d]")).toBe("a\\*b\\_c\\[d\\]");
  });

  it("markdown lists real metadata only", () => {
    const md = toMarkdown([paper({ title: "T", authors: ["Ada"], year: 2022 })]);
    expect(md).toContain("## 1. T");
    expect(md).toContain("Ada · 2022");
  });

  it("json export is valid and carries the real rows", () => {
    const parsed = JSON.parse(toJson([paper({ id: "x7", title: "Zed" })]));
    expect(parsed.count).toBe(1);
    expect(parsed.papers[0].id).toBe("x7");
    expect(parsed.schema).toBe("scholarsea.papers.v1");
  });
});
