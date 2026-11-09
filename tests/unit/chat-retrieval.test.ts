import { describe, it, expect } from "vitest";

import { chunkText, retrieve } from "@/lib/chat/retrieval";
import { groundAnswer, demoAnswer, INSUFFICIENT_MESSAGE } from "@/lib/chat/answer";
import type { RetrievalDoc } from "@/lib/chat/types";

const DOCS: RetrievalDoc[] = [
  {
    paperId: "p1",
    paperTitle: "Prototypical Few-Shot Leaf Disease",
    fullText:
      "We study few-shot leaf disease classification using prototypical networks. " +
      "The model computes a class prototype from a few labelled support images. " +
      "On the PlantVillage benchmark we reach 78.4 percent accuracy in the five-way five-shot setting. " +
      "A key limitation is that performance drops sharply under field conditions, which we do not evaluate.",
    claimPassages: [
      "performance drops sharply under field conditions, which we do not evaluate",
    ],
  },
  {
    paperId: "p2",
    paperTitle: "Transformer Language Modeling",
    fullText:
      "We train a large transformer on web text for next-token prediction. " +
      "Scaling the number of parameters improves perplexity on held-out data. " +
      "We discuss optimization stability and learning-rate warmup.",
    claimPassages: [],
  },
];

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    expect(chunkText("short text here")).toEqual(["short text here"]);
  });
  it("splits long text into overlapping chunks", () => {
    const long = "sentence. ".repeat(200);
    const chunks = chunkText(long);
    expect(chunks.length).toBeGreaterThan(1);
  });
  it("returns nothing for empty text", () => {
    expect(chunkText("   ")).toEqual([]);
  });
});

describe("retrieve — relevance", () => {
  it("ranks passages about the query topic above unrelated ones", () => {
    const r = retrieve("what accuracy on PlantVillage leaf disease?", DOCS);
    expect(r.insufficient).toBe(false);
    expect(r.passages[0].paperId).toBe("p1");
    // No transformer/LM passage should outrank the leaf-disease ones.
    expect(r.passages.every((p) => p.score > 0)).toBe(true);
  });

  it("surfaces a claim passage for a limitation query", () => {
    const r = retrieve("field condition robustness limitation", DOCS);
    const top = r.passages.map((p) => p.passage).join(" ");
    expect(top).toMatch(/field conditions/);
  });

  it("returns insufficient when nothing is relevant", () => {
    const r = retrieve("quantum chromodynamics lattice gauge theory", DOCS);
    expect(r.insufficient).toBe(true);
    expect(r.passages).toHaveLength(0);
  });

  it("returns insufficient for an empty corpus", () => {
    const r = retrieve("anything", []);
    expect(r.insufficient).toBe(true);
  });

  it("assigns distinct passage ids", () => {
    const r = retrieve("transformer perplexity scaling", DOCS);
    const ids = r.passages.map((p) => p.passageId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("groundAnswer — grounding firewall", () => {
  it("returns the insufficient message when retrieval was empty", () => {
    const g = groundAnswer(
      { answer: "made up", citedPassageIds: ["P1"], insufficient: false },
      []
    );
    expect(g.insufficient).toBe(true);
    expect(g.content).toBe(INSUFFICIENT_MESSAGE);
    expect(g.citations).toHaveLength(0);
  });

  it("honors the model's own insufficient flag", () => {
    const r = retrieve("leaf disease accuracy", DOCS);
    const g = groundAnswer(
      { answer: "", citedPassageIds: [], insufficient: true },
      r.passages
    );
    expect(g.insufficient).toBe(true);
    expect(g.content).toBe(INSUFFICIENT_MESSAGE);
  });

  it("resolves cited ids to real passages and drops invented ones", () => {
    const r = retrieve("leaf disease accuracy", DOCS);
    const realId = r.passages[0].passageId;
    const g = groundAnswer(
      { answer: "It reaches 78.4%.", citedPassageIds: [realId, "P999_FAKE"], insufficient: false },
      r.passages
    );
    expect(g.insufficient).toBe(false);
    expect(g.citations).toHaveLength(1);
    expect(g.citations[0].passage).toBe(r.passages[0].passage);
  });

  it("falls back to the top passage if the model cited nothing real", () => {
    const r = retrieve("leaf disease accuracy", DOCS);
    const g = groundAnswer(
      { answer: "An answer with no valid citations.", citedPassageIds: ["nope"], insufficient: false },
      r.passages
    );
    // Never shown without a source.
    expect(g.citations.length).toBeGreaterThan(0);
  });

  it("every citation passage comes from the retrieved set", () => {
    const r = retrieve("field conditions limitation accuracy", DOCS);
    const g = groundAnswer(demoAnswer("q", r.passages), r.passages);
    const retrievedPassages = new Set(r.passages.map((p) => p.passage));
    for (const c of g.citations) expect(retrievedPassages.has(c.passage)).toBe(true);
  });
});
