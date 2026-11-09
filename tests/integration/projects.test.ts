import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { registerUser } from "@/lib/auth/service";
import { ingestPaper } from "@/lib/documents/ingest";
import {
  createProject,
  updateProject,
  deleteProject,
  listProjects,
  addPaperToProject,
  removePaperFromProject,
  setPaperTags,
  listProjectPapers,
  listProjectTags,
  ProjectNameTakenError,
} from "@/lib/projects/service";
import {
  createNote,
  updateNote,
  listNotesForProject,
  listBookmarkedNotes,
} from "@/lib/projects/notes";
import { queryLibrary } from "@/lib/projects/library-query";
import { NotFoundError } from "@/lib/auth/errors";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const emailA = `proj-${RUN}-a@example.test`;
const emailB = `proj-${RUN}-b@example.test`;

let userA = "";
let userB = "";
let paperA1 = "";
let paperA2 = "";

beforeAll(async () => {
  userA = (await registerUser({ email: emailA, password: "password-123" })).id;
  userB = (await registerUser({ email: emailB, password: "password-123" })).id;
  paperA1 = (
    await ingestPaper(userA, {
      source: "PASTED_TEXT",
      title: "Alpha Paper",
      text: "Alpha paper about few-shot learning with enough text to pass validation. 2021.",
    })
  ).id;
  paperA2 = (
    await ingestPaper(userA, {
      source: "PASTED_TEXT",
      title: "Beta Paper",
      text: "Beta paper about contrastive methods with sufficient length to validate. 2023.",
    })
  ).id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
  await prisma.$disconnect();
});

describe("project CRUD", () => {
  let projectId = "";

  it("creates a project", async () => {
    const p = await createProject(userA, {
      name: `Review ${RUN}`,
      description: "desc",
    });
    projectId = p.id;
    expect(p.name).toBe(`Review ${RUN}`);
    expect(p.paperCount).toBe(0);
  });

  it("rejects a duplicate name for the same user", async () => {
    await expect(
      createProject(userA, { name: `Review ${RUN}` })
    ).rejects.toBeInstanceOf(ProjectNameTakenError);
  });

  it("allows the same name for a different user", async () => {
    const p = await createProject(userB, { name: `Review ${RUN}` });
    expect(p.id).toBeTruthy();
  });

  it("edits name and description", async () => {
    const p = await updateProject(userA, projectId, {
      name: `Renamed ${RUN}`,
      description: "new desc",
    });
    expect(p.name).toBe(`Renamed ${RUN}`);
    expect(p.description).toBe("new desc");
  });

  it("hides another user's project (404 on update)", async () => {
    await expect(
      updateProject(userB, projectId, { name: "hax" })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lists only the owner's projects", async () => {
    const a = await listProjects(userA);
    const b = await listProjects(userB);
    expect(a.some((p) => p.id === projectId)).toBe(true);
    expect(b.some((p) => p.id === projectId)).toBe(false);
  });
});

describe("membership and tags", () => {
  let projectId = "";
  beforeAll(async () => {
    projectId = (await createProject(userA, { name: `Mem ${RUN}` })).id;
  });

  it("adds a paper with tags", async () => {
    const m = await addPaperToProject(userA, projectId, paperA1, ["cnn", "metric"]);
    expect(m.tags).toEqual(["cnn", "metric"]);
    expect(m.paperId).toBe(paperA1);
  });

  it("rejects adding the same paper twice", async () => {
    await expect(
      addPaperToProject(userA, projectId, paperA1)
    ).rejects.toMatchObject({ code: "already_in_project" });
  });

  it("refuses to add a paper the user does not own (404)", async () => {
    await expect(
      addPaperToProject(userB, projectId, paperA1)
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("deduplicates and replaces tags", async () => {
    const m = await setPaperTags(userA, projectId, paperA1, [
      "CNN",
      "cnn",
      "new",
    ]);
    expect(m.tags).toEqual(["CNN", "new"]);
  });

  it("aggregates distinct project tags", async () => {
    await addPaperToProject(userA, projectId, paperA2, ["new", "survey"]);
    const tags = await listProjectTags(userA, projectId);
    expect(tags).toContain("survey");
    expect(tags).toContain("new");
  });

  it("removes a paper from the project (paper still exists)", async () => {
    await removePaperFromProject(userA, projectId, paperA2);
    const papers = await listProjectPapers(userA, projectId);
    expect(papers.some((p) => p.paperId === paperA2)).toBe(false);
    // The paper itself remains in the library.
    const stillThere = await prisma.paper.findUnique({ where: { id: paperA2 } });
    expect(stillThere).not.toBeNull();
  });

  it("errors removing a paper that isn't in the project", async () => {
    await expect(
      removePaperFromProject(userA, projectId, paperA2)
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("notes and bookmarks", () => {
  let projectId = "";
  beforeAll(async () => {
    projectId = (await createProject(userA, { name: `Notes ${RUN}` })).id;
  });

  it("creates a project note and lists it", async () => {
    await createNote(userA, { projectId, body: "first note" });
    const notes = await listNotesForProject(userA, projectId);
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toBe("first note");
  });

  it("refuses a note on another user's project (404)", async () => {
    await expect(
      createNote(userB, { projectId, body: "intruder" })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("toggles a bookmark and lists bookmarked notes", async () => {
    const note = await createNote(userA, { paperId: paperA1, body: "mark" });
    await updateNote(userA, note.id, { bookmarked: true });
    const marked = await listBookmarkedNotes(userA);
    expect(marked.some((n) => n.id === note.id)).toBe(true);
    // Isolation: user B sees none of A's bookmarks.
    const bMarked = await listBookmarkedNotes(userB);
    expect(bMarked.some((n) => n.id === note.id)).toBe(false);
  });
});

describe("library query", () => {
  it("searches by title (case-insensitive)", async () => {
    const res = await queryLibrary(userA, {
      q: "alpha",
      sort: "recent",
      bookmarked: false,
    });
    expect(res.some((p) => p.id === paperA1)).toBe(true);
    expect(res.some((p) => p.title === "Beta Paper")).toBe(false);
  });

  it("sorts by title A–Z", async () => {
    const res = await queryLibrary(userA, { sort: "title", bookmarked: false });
    const titles = res.map((p) => p.title);
    const sorted = [...titles].sort((a, b) => a.localeCompare(b));
    expect(titles).toEqual(sorted);
  });

  it("filters to bookmarked papers only", async () => {
    const res = await queryLibrary(userA, { sort: "recent", bookmarked: true });
    // paperA1 has a bookmarked note from the previous suite.
    expect(res.some((p) => p.id === paperA1)).toBe(true);
    expect(res.every((p) => p.id !== undefined)).toBe(true);
  });

  it("never returns another user's papers", async () => {
    const res = await queryLibrary(userB, { sort: "recent", bookmarked: false });
    expect(res.some((p) => p.id === paperA1 || p.id === paperA2)).toBe(false);
  });
});

describe("project deletion", () => {
  it("deletes a project but keeps its papers in the library", async () => {
    const p = await createProject(userA, { name: `Del ${RUN}` });
    await addPaperToProject(userA, p.id, paperA1, ["x"]);
    await deleteProject(userA, p.id);
    const gone = await prisma.researchProject.findUnique({ where: { id: p.id } });
    expect(gone).toBeNull();
    const paperStill = await prisma.paper.findUnique({ where: { id: paperA1 } });
    expect(paperStill).not.toBeNull();
  });
});
