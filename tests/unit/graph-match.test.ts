import { describe, it, expect } from "vitest";

import { matchReference, normalizeText, type MatchablePaper } from "@/lib/graph/match";

const papers: MatchablePaper[] = [
  {
    id: "p1",
    title: "Prototypical Networks for Few-Shot Leaf Disease Classification",
    doi: "10.1000/leaf.2023",
    arxivId: "2305.01234",
  },
  {
    id: "p2",
    title: "Attention Is All You Need",
    doi: null,
    arxivId: "1706.03762",
  },
  { id: "self", title: "Our Own Paper On Something", doi: null, arxivId: null },
];

describe("normalizeText", () => {
  it("lowercases, strips punctuation, collapses whitespace", () => {
    expect(normalizeText("  Few-Shot:  Leaf/Disease!! ")).toBe(
      "few shot leaf disease"
    );
  });
});

describe("matchReference", () => {
  it("matches on a shared DOI", () => {
    expect(
      matchReference("Smith et al. https://doi.org/10.1000/leaf.2023", papers, "self")
    ).toBe("p1");
  });

  it("matches on a shared arXiv id", () => {
    expect(matchReference("See arXiv:1706.03762 for details", papers, "self")).toBe(
      "p2"
    );
  });

  it("matches when the full normalized title appears in the reference", () => {
    expect(
      matchReference(
        "A. Rivera, Prototypical Networks for Few-Shot Leaf Disease Classification, 2023.",
        papers,
        "self"
      )
    ).toBe("p1");
  });

  it("never matches a paper to itself", () => {
    expect(
      matchReference("Our Own Paper On Something, 2024", papers, "self")
    ).toBeNull();
  });

  it("returns null for a reference that resolves to nothing in the library", () => {
    expect(
      matchReference(
        "Some Unrelated Paper About Quantum Error Correction, 2019.",
        papers,
        "self"
      )
    ).toBeNull();
  });

  it("does not match on a short/coincidental title fragment", () => {
    const shortTitle: MatchablePaper[] = [
      { id: "x", title: "Deep Learning", doi: null, arxivId: null },
    ];
    // "Deep Learning" normalizes to 13 chars (< MIN_TITLE_MATCH_LEN), so a bare
    // mention must not create a citation edge.
    expect(
      matchReference("We use deep learning techniques here.", shortTitle, "self")
    ).toBeNull();
  });
});
