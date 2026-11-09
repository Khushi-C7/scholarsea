import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { registerUser, authenticateUser } from "@/lib/auth/service";
import {
  getOwnedProject,
  getOwnedPaper,
  getOwnedGapAnalysis,
} from "@/lib/auth/guards";
import {
  EmailInUseError,
  InvalidCredentialsError,
  NotFoundError,
} from "@/lib/auth/errors";

// Unique suffix so the suite is safe to re-run and never collides.
const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const emailA = `authtest-${RUN}-a@example.test`;
const emailB = `authtest-${RUN}-b@example.test`;
const PASSWORD = "sup3r-secret-pw";

let userAId = "";
let userBId = "";

beforeAll(async () => {
  // Create two accounts via the real signup path.
  const a = await registerUser({ email: emailA, password: PASSWORD, name: "A" });
  const b = await registerUser({ email: emailB, password: PASSWORD, name: "B" });
  userAId = a.id;
  userBId = b.id;
});

afterAll(async () => {
  // Cascades remove all of each user's data.
  await prisma.user.deleteMany({
    where: { email: { in: [emailA, emailB] } },
  });
  await prisma.$disconnect();
});

describe("signup", () => {
  it("stores a bcrypt hash, never the plaintext password", async () => {
    const row = await prisma.user.findUnique({
      where: { id: userAId },
      select: { passwordHash: true },
    });
    expect(row?.passwordHash).toBeTruthy();
    expect(row?.passwordHash).not.toBe(PASSWORD);
    expect(row?.passwordHash?.startsWith("$2")).toBe(true);
  });

  it("creates a default preferences row", async () => {
    const pref = await prisma.userPreference.findUnique({
      where: { userId: userAId },
    });
    expect(pref).not.toBeNull();
  });

  it("rejects a duplicate email", async () => {
    await expect(
      registerUser({ email: emailA, password: PASSWORD })
    ).rejects.toBeInstanceOf(EmailInUseError);
  });

  it("treats emails case-insensitively", async () => {
    await expect(
      registerUser({ email: emailA.toUpperCase(), password: PASSWORD })
    ).rejects.toBeInstanceOf(EmailInUseError);
  });
});

describe("login", () => {
  it("authenticates with correct credentials", async () => {
    const user = await authenticateUser({ email: emailA, password: PASSWORD });
    expect(user.id).toBe(userAId);
  });

  it("rejects a wrong password", async () => {
    await expect(
      authenticateUser({ email: emailA, password: "wrong" })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("rejects an unknown email", async () => {
    await expect(
      authenticateUser({ email: "nobody-here@example.test", password: PASSWORD })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});

describe("ownership isolation", () => {
  let projectId = "";
  let paperId = "";
  let gapAnalysisId = "";

  beforeAll(async () => {
    const project = await prisma.researchProject.create({
      data: { ownerId: userAId, name: `P-${RUN}` },
    });
    projectId = project.id;

    const paper = await prisma.paper.create({
      data: { ownerId: userAId, title: "A's paper", source: "PASTED_TEXT" },
    });
    paperId = paper.id;

    const gap = await prisma.researchGapAnalysis.create({
      data: { ownerId: userAId, projectId: project.id },
    });
    gapAnalysisId = gap.id;
  });

  it("lets the owner read their own project", async () => {
    const p = await getOwnedProject(projectId, userAId);
    expect(p.id).toBe(projectId);
  });

  it("hides another user's project as a 404", async () => {
    await expect(getOwnedProject(projectId, userBId)).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it("hides another user's paper as a 404", async () => {
    await expect(getOwnedPaper(paperId, userBId)).rejects.toBeInstanceOf(
      NotFoundError
    );
    // ...but the owner can read it.
    const owned = await getOwnedPaper(paperId, userAId);
    expect(owned.id).toBe(paperId);
  });

  it("hides another user's gap analysis as a 404", async () => {
    await expect(
      getOwnedGapAnalysis(gapAnalysisId, userBId)
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("never returns another user's rows in a scoped list query", async () => {
    const asB = await prisma.researchProject.findMany({
      where: { ownerId: userBId },
    });
    expect(asB.find((p) => p.id === projectId)).toBeUndefined();

    const asA = await prisma.researchProject.findMany({
      where: { ownerId: userAId },
    });
    expect(asA.find((p) => p.id === projectId)).toBeDefined();
  });
});
