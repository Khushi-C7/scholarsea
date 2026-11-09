import "dotenv/config";

import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";

/**
 * Development seed fixtures.
 *
 * Everything here is clearly-synthetic demo data for local development, owned
 * by a single demo user. The "papers" are fabricated sample fixtures (no real
 * DOIs/arXiv ids) — but they are real rows, so every claim and every piece of
 * gap evidence references a document that actually exists in the database,
 * mirroring the app's evidence-integrity rule. Re-running is safe: the demo
 * user's data is wiped and rebuilt inside a transaction.
 */

const DEMO_EMAIL = "demo@scholarsea.dev";
// Dev-only credentials so the seeded account is usable for manual testing.
const DEMO_PASSWORD = "demo-password-123";

const FIXTURE_NOTE =
  "Synthetic sample fixture for local development — not a real publication.";

async function main() {
  // Upsert the demo user so its id is stable across runs.
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: "Demo Researcher", passwordHash },
    create: { email: DEMO_EMAIL, name: "Demo Researcher", passwordHash },
  });

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      aiProvider: "openai",
      aiModel: "gpt-4o-mini",
      outputLanguage: "en",
      theme: "SYSTEM",
    },
  });

  // Wipe prior demo data. Order respects cascades: projects first (removes
  // project-papers, gap analyses, gaps, evidence), then papers (removes
  // analyses, claims, any remaining evidence), then the rest.
  await prisma.researchProject.deleteMany({ where: { ownerId: user.id } });
  await prisma.paper.deleteMany({ where: { ownerId: user.id } });
  await prisma.conversation.deleteMany({ where: { ownerId: user.id } });
  await prisma.agentSession.deleteMany({ where: { ownerId: user.id } });
  await prisma.researchNote.deleteMany({ where: { ownerId: user.id } });

  await prisma.$transaction(async (tx) => {
    const project = await tx.researchProject.create({
      data: {
        ownerId: user.id,
        name: "Few-shot Plant Disease Recognition",
        description:
          "Sample project comparing few-shot approaches to leaf-disease classification. All papers here are synthetic development fixtures.",
      },
    });

    // --- Papers (synthetic) -------------------------------------------------
    const paperA = await tx.paper.create({
      data: {
        ownerId: user.id,
        title:
          "Prototypical Networks for Leaf-Disease Few-Shot Classification",
        abstract:
          "A metric-learning approach that classifies unseen leaf-disease classes from a handful of labelled examples using class prototypes.",
        authors: ["A. Rivera", "S. Okafor"],
        year: 2023,
        venue: "Sample Vision Workshop",
        source: "PASTED_TEXT",
        fullText:
          "We study few-shot leaf-disease recognition. Our method computes a prototype per class... Experiments on the PlantVillage subset report 78.4% 5-way 5-shot accuracy. A key limitation is that performance drops sharply under field (in-the-wild) imagery, which we do not evaluate.",
        contentHash: "demo-hash-paper-a",
        extractionStatus: "COMPLETED",
        metadata: { note: FIXTURE_NOTE },
      },
    });

    const paperB = await tx.paper.create({
      data: {
        ownerId: user.id,
        title: "Meta-Learning with Augmentation for Crop Disease Recognition",
        abstract:
          "A MAML-style meta-learner combined with strong data augmentation for rapid adaptation to new crop-disease tasks.",
        authors: ["L. Chen", "M. Duarte", "P. Singh"],
        year: 2024,
        venue: "Sample Agriculture-AI Symposium",
        source: "PASTED_TEXT",
        fullText:
          "We adopt gradient-based meta-learning... On a laboratory PlantVillage split we reach 81.0% 5-way 5-shot accuracy. We additionally test on a small field-collected set and observe a 19-point accuracy drop, highlighting a robustness gap. Future work should target domain generalization to field conditions.",
        contentHash: "demo-hash-paper-b",
        extractionStatus: "COMPLETED",
        metadata: { note: FIXTURE_NOTE },
      },
    });

    const paperC = await tx.paper.create({
      data: {
        ownerId: user.id,
        title:
          "Contrastive Pretraining Improves Few-Shot Plant Pathology Transfer",
        abstract:
          "Self-supervised contrastive pretraining on unlabeled plant imagery as initialization for few-shot fine-tuning.",
        authors: ["R. Haddad", "T. Villanueva"],
        year: 2024,
        venue: "Sample Representation-Learning Workshop",
        source: "PASTED_TEXT",
        fullText:
          "Contrastive pretraining yields 83.2% 5-way 5-shot accuracy on the standard benchmark and, unlike prior work, we report field-condition results of 71.5%, suggesting pretraining partially closes the robustness gap. We do not compare against meta-learning baselines under identical augmentation.",
        contentHash: "demo-hash-paper-c",
        extractionStatus: "COMPLETED",
        metadata: { note: FIXTURE_NOTE },
      },
    });

    const papers = [paperA, paperB, paperC];

    // --- Project membership -------------------------------------------------
    await tx.projectPaper.createMany({
      data: [
        { projectId: project.id, paperId: paperA.id, tags: ["metric-learning"] },
        { projectId: project.id, paperId: paperB.id, tags: ["meta-learning"] },
        {
          projectId: project.id,
          paperId: paperC.id,
          tags: ["self-supervised"],
        },
      ],
    });

    // --- Analyses + a few source-linked claims per paper --------------------
    const claimIds: Record<string, string> = {};

    for (const p of papers) {
      const analysis = await tx.paperAnalysis.create({
        data: {
          paperId: p.id,
          version: 1,
          status: "COMPLETED",
          summary: `${p.title}: ${p.abstract}`,
          researchProblem:
            "Recognizing plant diseases from very few labelled examples.",
          methodology: "Few-shot image classification.",
          contributions: ["A few-shot method for leaf-disease recognition"],
          limitations: ["Evaluation is mostly on curated laboratory imagery"],
          modelProvider: "demo",
          modelName: "fixture",
        },
      });

      // One result claim and one limitation claim, each with a verbatim passage.
      const resultClaim = await tx.extractedClaim.create({
        data: {
          paperId: p.id,
          analysisId: analysis.id,
          type: "RESULT",
          text: "Reports 5-way 5-shot accuracy on a PlantVillage-style benchmark.",
          supportingPassage:
            p.fullText?.split(".").find((s) => s.includes("accuracy"))?.trim() ??
            "accuracy reported",
          confidence: 0.9,
        },
      });

      const limitationClaim = await tx.extractedClaim.create({
        data: {
          paperId: p.id,
          analysisId: analysis.id,
          type: "LIMITATION",
          text: "Robustness to field (in-the-wild) imagery is limited or untested.",
          supportingPassage:
            p.fullText
              ?.split(".")
              .find((s) => s.toLowerCase().includes("field") || s.includes("limitation"))
              ?.trim() ?? "limitation noted",
          confidence: 0.8,
        },
      });

      claimIds[`${p.id}:result`] = resultClaim.id;
      claimIds[`${p.id}:limitation`] = limitationClaim.id;
    }

    // --- Gap analysis over the corpus --------------------------------------
    const gapAnalysis = await tx.researchGapAnalysis.create({
      data: {
        projectId: project.id,
        ownerId: user.id,
        status: "COMPLETED",
        paperCount: papers.length,
        examinedPaperIds: papers.map((p) => p.id),
        executiveSummary:
          "Across three few-shot approaches, laboratory accuracy is strong but field robustness is inconsistently evaluated.",
        coverageNotes:
          "Corpus is small (3 synthetic fixtures) and skewed to one benchmark family.",
        patterns: [
          "Repeated limitation: little or no field-condition evaluation",
          "Methods are rarely compared under identical augmentation",
        ],
        limitations:
          "Only 3 papers examined; conclusions describe absence of evidence in this corpus, not the wider literature.",
      },
    });

    // Gap 1 — robustness, with supporting + contradicting evidence.
    const gap1 = await tx.researchGap.create({
      data: {
        analysisId: gapAnalysis.id,
        title: "Field-condition robustness is under-evaluated",
        explanation:
          "Most methods in the corpus report only curated laboratory accuracy; field performance is often omitted.",
        significance:
          "Real deployments face in-the-wild imagery, so lab-only metrics may overstate usefulness.",
        confidenceRationale:
          "Two of three papers explicitly note missing or degraded field evaluation; one partially addresses it.",
        evidenceCoverage: "3 of 3 papers examined.",
        paperCountExamined: papers.length,
        researchQuestions: [
          "How much do few-shot methods degrade on field imagery under matched settings?",
        ],
        suggestedExperiments: [
          "Evaluate all three method families on a shared field-collected test set.",
        ],
        verificationStatus: "NEEDS_REVIEW",
        reviewStatus: "NEEDS_INVESTIGATION",
      },
    });

    await tx.gapEvidence.createMany({
      data: [
        {
          gapId: gap1.id,
          paperId: paperA.id,
          claimId: claimIds[`${paperA.id}:limitation`],
          stance: "SUPPORTING",
          passage:
            "performance drops sharply under field (in-the-wild) imagery, which we do not evaluate",
          verified: true,
        },
        {
          gapId: gap1.id,
          paperId: paperB.id,
          claimId: claimIds[`${paperB.id}:limitation`],
          stance: "SUPPORTING",
          passage:
            "we observe a 19-point accuracy drop, highlighting a robustness gap",
          verified: true,
        },
        {
          gapId: gap1.id,
          paperId: paperC.id,
          claimId: claimIds[`${paperC.id}:result`],
          stance: "CONTRADICTING",
          passage:
            "we report field-condition results of 71.5%, suggesting pretraining partially closes the robustness gap",
          note: "Countervailing evidence: contrastive pretraining partially addresses the gap.",
          verified: true,
        },
      ],
    });

    // Gap 2 — missing head-to-head comparison.
    const gap2 = await tx.researchGap.create({
      data: {
        analysisId: gapAnalysis.id,
        title: "No controlled comparison under identical augmentation",
        explanation:
          "Metric-learning, meta-learning, and contrastive-pretraining methods are not compared under matched augmentation and splits.",
        significance:
          "Reported gains may reflect augmentation or data differences rather than the method itself.",
        confidenceRationale:
          "One paper explicitly notes it does not compare against meta-learning baselines under identical augmentation.",
        evidenceCoverage: "3 of 3 papers examined.",
        paperCountExamined: papers.length,
        researchQuestions: [
          "Under identical augmentation and splits, which family wins at 5-way 5-shot?",
        ],
        verificationStatus: "UNVERIFIED",
        reviewStatus: "USEFUL",
      },
    });

    await tx.gapEvidence.create({
      data: {
        gapId: gap2.id,
        paperId: paperC.id,
        claimId: claimIds[`${paperC.id}:result`],
        stance: "SUPPORTING",
        passage:
          "We do not compare against meta-learning baselines under identical augmentation.",
        verified: true,
      },
    });

    // --- A bookmarked note on gap 1 ----------------------------------------
    await tx.researchNote.create({
      data: {
        ownerId: user.id,
        projectId: project.id,
        gapId: gap1.id,
        body: "Worth building a shared field test set to quantify this properly.",
        bookmarked: true,
      },
    });

    // --- A contextual-chat conversation ------------------------------------
    const conversation = await tx.conversation.create({
      data: {
        ownerId: user.id,
        projectId: project.id,
        title: "Robustness across the three papers",
        paperIds: papers.map((p) => p.id),
      },
    });

    await tx.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: "Which papers actually evaluate field conditions?",
      },
    });
    await tx.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content:
          "Within this corpus, only the contrastive-pretraining paper reports field-condition results; the other two note it as a limitation.",
        citations: [
          { paperId: paperC.id, passage: "field-condition results of 71.5%" },
          { paperId: paperA.id, passage: "which we do not evaluate" },
        ],
      },
    });

    // --- An autonomous agent session with steps ----------------------------
    const session = await tx.agentSession.create({
      data: {
        ownerId: user.id,
        projectId: project.id,
        goal: "Identify the most commonly reported evaluation limitation across these papers.",
        status: "COMPLETED",
        finalAnswer:
          "The most common limitation is missing or weak field-condition evaluation (2 of 3 papers).",
        limits: { maxToolCalls: 10, maxRuntimeMs: 120000, tokenBudget: 50000 },
        citations: [{ paperId: paperA.id }, { paperId: paperB.id }],
      },
    });

    await tx.agentStep.createMany({
      data: [
        {
          sessionId: session.id,
          index: 0,
          type: "PLAN",
          status: "COMPLETED",
          output: { steps: ["gather limitations", "compare", "synthesize"] },
        },
        {
          sessionId: session.id,
          index: 1,
          type: "ANALYZE",
          status: "COMPLETED",
          output: { limitationsFound: 3 },
        },
        {
          sessionId: session.id,
          index: 2,
          type: "SYNTHESIZE",
          status: "COMPLETED",
          output: { conclusion: "field robustness under-evaluated" },
        },
      ],
    });
  });

  // Report what now exists for the demo user.
  const [projects, papers, gaps, evidence, notes, messages, steps] =
    await Promise.all([
      prisma.researchProject.count({ where: { ownerId: user.id } }),
      prisma.paper.count({ where: { ownerId: user.id } }),
      prisma.researchGap.count({
        where: { analysis: { ownerId: user.id } },
      }),
      prisma.gapEvidence.count({
        where: { gap: { analysis: { ownerId: user.id } } },
      }),
      prisma.researchNote.count({ where: { ownerId: user.id } }),
      prisma.chatMessage.count({
        where: { conversation: { ownerId: user.id } },
      }),
      prisma.agentStep.count({
        where: { session: { ownerId: user.id } },
      }),
    ]);

  console.log("Seed complete for", DEMO_EMAIL);
  console.log(`Demo login — email: ${DEMO_EMAIL}  password: ${DEMO_PASSWORD}`);
  console.table({ projects, papers, gaps, evidence, notes, messages, steps });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
