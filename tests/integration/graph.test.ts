import { describe, it, expect, beforeAll } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { registerUser } from "@/lib/auth/service";
import { ingestPaper } from "@/lib/documents/ingest";
import { buildGraph } from "@/lib/graph/build";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
let userA = "";
let userB = "";
let paperA1 = "";
let paperA2 = "";
let paperB1 = "";

async function analyze(
  paperId: string,
  data: {
    methodology?: string;
    datasets?: { name: string; description: string | null }[];
    terminology?: { term: string; definition: string; relatedTerms: string[] }[];
    references?: string[];
  }
) {
  await prisma.paperAnalysis.create({
    data: {
      paperId,
      version: 1,
      status: "COMPLETED",
      methodology: data.methodology ?? null,
      datasets: data.datasets ?? [],
      terminology: data.terminology ?? [],
      references: data.references ?? [],
    },
  });
}

beforeAll(async () => {
  userA = (await registerUser({ email: `graph-${RUN}-a@example.test`, password: "password-123" })).id;
  userB = (await registerUser({ email: `graph-${RUN}-b@example.test`, password: "password-123" })).id;

  paperA1 = (
    await ingestPaper(userA, {
      source: "PASTED_TEXT",
      title: "Prototypical Networks for Few-Shot Leaf Disease Classification",
      text: "Few-shot prototypical metric learning for plant leaf disease recognition on PlantVillage imagery here.",
    })
  ).id;
  paperA2 = (
    await ingestPaper(userA, {
      source: "PASTED_TEXT",
      title: "Contrastive Pretraining for Plant Pathology Transfer",
      text: "A contrastive pretraining study for plant pathology transfer learning across datasets in this work.",
    })
  ).id;
  paperB1 = (
    await ingestPaper(userB, {
      source: "PASTED_TEXT",
      title: "A Completely Unrelated Paper Owned By User B",
      text: "This paper belongs to user B and must never appear in user A's knowledge graph at all.",
    })
  ).id;

  // Shared author + shared dataset across A1 and A2; A2 cites A1 by full title.
  await prisma.paper.update({
    where: { id: paperA1 },
    data: { authors: ["Ada Lovelace", "Alan Turing"] },
  });
  await prisma.paper.update({
    where: { id: paperA2 },
    data: { authors: ["Ada Lovelace"] },
  });

  await analyze(paperA1, {
    methodology: "Prototypical metric learning",
    datasets: [{ name: "PlantVillage", description: "lab leaf images" }],
    terminology: [
      { term: "Few-shot learning", definition: "learning from few labels", relatedTerms: ["Metric learning"] },
      { term: "Metric learning", definition: "learn an embedding metric", relatedTerms: [] },
    ],
  });
  await analyze(paperA2, {
    methodology: "Contrastive pretraining",
    datasets: [{ name: "PlantVillage", description: "shared dataset" }],
    terminology: [
      { term: "Transfer learning", definition: "reuse learned features", relatedTerms: [] },
    ],
    references: [
      "Prototypical Networks for Few-Shot Leaf Disease Classification, 2023.",
      "Some External Paper Not In The Library, 2019.",
    ],
  });
  await analyze(paperB1, {
    datasets: [{ name: "SecretSet", description: "user B only" }],
  });
});

describe("buildGraph", () => {
  it("is owner-scoped — user B's papers and datasets never appear", async () => {
    const g = await buildGraph(userA);
    const labels = g.nodes.map((n) => n.label);
    expect(labels).not.toContain("A Completely Unrelated Paper Owned By User B");
    expect(labels).not.toContain("SecretSet");
    expect(g.paperCount).toBe(2);
  });

  it("creates nodes for papers, authors, datasets, methods, and concepts", async () => {
    const g = await buildGraph(userA);
    const byType = (t: string) => g.nodes.filter((n) => n.type === t).map((n) => n.label);
    expect(byType("paper")).toHaveLength(2);
    expect(byType("author")).toContain("Ada Lovelace");
    expect(byType("dataset")).toContain("PlantVillage");
    expect(byType("method")).toEqual(
      expect.arrayContaining(["Prototypical metric learning", "Contrastive pretraining"])
    );
    expect(byType("concept")).toEqual(
      expect.arrayContaining(["Few-shot learning", "Metric learning", "Transfer learning"])
    );
  });

  it("links two papers to the one shared dataset/author (dedup, not duplicate nodes)", async () => {
    const g = await buildGraph(userA);
    const pv = g.nodes.filter((n) => n.type === "dataset" && n.label === "PlantVillage");
    expect(pv).toHaveLength(1); // deduped to a single node
    // Both papers connect to it.
    const pvId = pv[0].id;
    const toPv = g.edges.filter((e) => e.target === pvId && e.kind === "uses_dataset");
    expect(toPv).toHaveLength(2);

    const ada = g.nodes.find((n) => n.type === "author" && n.label === "Ada Lovelace")!;
    const toAda = g.edges.filter((e) => e.target === ada.id && e.kind === "authored_by");
    expect(toAda).toHaveLength(2);
  });

  it("adds a citation edge only when a reference resolves to another owned paper", async () => {
    const g = await buildGraph(userA);
    const cites = g.edges.filter((e) => e.kind === "cites");
    // A2 cites A1 (resolvable). The external reference resolves to nothing, so
    // it must NOT create an edge or a phantom node.
    expect(cites).toHaveLength(1);
    expect(cites[0].source).toBe(`paper:${paperA2}`);
    expect(cites[0].target).toBe(`paper:${paperA1}`);
    expect(g.nodes.some((n) => n.label.includes("External Paper"))).toBe(false);
  });

  it("adds a concept↔concept edge only between real extracted terms", async () => {
    const g = await buildGraph(userA);
    const rel = g.edges.filter((e) => e.kind === "related_concept");
    expect(rel).toHaveLength(1); // Few-shot ↔ Metric learning (both extracted)
  });

  it("every edge carries a non-empty provenance string", async () => {
    const g = await buildGraph(userA);
    expect(g.edges.length).toBeGreaterThan(0);
    for (const e of g.edges) {
      expect(typeof e.provenance).toBe("string");
      expect(e.provenance.length).toBeGreaterThan(0);
    }
  });

  it("restricts to an owned project when projectId is given", async () => {
    const project = await prisma.researchProject.create({
      data: { ownerId: userA, name: `graph-proj-${RUN}` },
    });
    await prisma.projectPaper.create({
      data: { projectId: project.id, paperId: paperA1, tags: ["disease-detection"] },
    });
    const g = await buildGraph(userA, { projectId: project.id });
    expect(g.paperCount).toBe(1);
    expect(g.nodes.filter((n) => n.type === "paper")).toHaveLength(1);
    // The project tag becomes a topic node with a tagged_topic edge.
    expect(g.nodes.some((n) => n.type === "topic" && n.label === "disease-detection")).toBe(true);
    expect(g.edges.some((e) => e.kind === "tagged_topic")).toBe(true);
  });
});
