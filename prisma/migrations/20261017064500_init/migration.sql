-- ScholarSea initial schema
-- Creates all enums, tables, indexes, and foreign keys for the data model.

-- CreateEnum
CREATE TYPE "PaperSource" AS ENUM ('PASTED_TEXT', 'PDF_UPLOAD', 'URL', 'ACADEMIC_SEARCH');
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "ClaimType" AS ENUM ('OBJECTIVE', 'METHOD', 'MODEL_ARCHITECTURE', 'DATASET', 'METRIC', 'RESULT', 'LIMITATION', 'FUTURE_WORK', 'CONTRIBUTION', 'ASSUMPTION', 'CONTEXT');
CREATE TYPE "EvidenceStance" AS ENUM ('SUPPORTING', 'CONTRADICTING', 'CONTEXTUAL');
CREATE TYPE "GapVerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REFUTED', 'NEEDS_REVIEW');
CREATE TYPE "GapReviewStatus" AS ENUM ('NONE', 'USEFUL', 'REJECTED', 'NEEDS_INVESTIGATION');
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');
CREATE TYPE "AgentStepType" AS ENUM ('PLAN', 'SEARCH', 'RETRIEVE', 'ANALYZE', 'COMPARE', 'SYNTHESIZE', 'TOOL_CALL');
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "outputLanguage" TEXT NOT NULL DEFAULT 'en',
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "promptOverrides" JSONB,
    "encryptedCredentials" JSONB,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchProject" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResearchProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Paper" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "authors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "year" INTEGER,
    "venue" TEXT,
    "doi" TEXT,
    "arxivId" TEXT,
    "url" TEXT,
    "source" "PaperSource" NOT NULL,
    "sourceUrl" TEXT,
    "fullText" TEXT,
    "storageKey" TEXT,
    "pageCount" INTEGER,
    "contentHash" TEXT,
    "metadata" JSONB,
    "extractionStatus" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "extractionError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Paper_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectPaper" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectPaper_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaperAnalysis" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "summary" TEXT,
    "researchProblem" TEXT,
    "motivation" TEXT,
    "methodology" TEXT,
    "contributions" JSONB,
    "datasets" JSONB,
    "results" JSONB,
    "metrics" JSONB,
    "limitations" JSONB,
    "terminology" JSONB,
    "relatedWork" JSONB,
    "references" JSONB,
    "followUpQuestions" JSONB,
    "modelProvider" TEXT,
    "modelName" TEXT,
    "tokensUsed" INTEGER,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaperAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExtractedClaim" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "analysisId" TEXT,
    "type" "ClaimType" NOT NULL,
    "text" TEXT NOT NULL,
    "supportingPassage" TEXT NOT NULL,
    "location" JSONB,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExtractedClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchGapAnalysis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "paperCount" INTEGER NOT NULL DEFAULT 0,
    "examinedPaperIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "executiveSummary" TEXT,
    "coverageNotes" TEXT,
    "patterns" JSONB,
    "limitations" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResearchGapAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchGap" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "significance" TEXT,
    "confidenceRationale" TEXT,
    "evidenceCoverage" TEXT,
    "paperCountExamined" INTEGER,
    "suggestedExperiments" JSONB,
    "researchQuestions" JSONB,
    "verificationStatus" "GapVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "reviewStatus" "GapReviewStatus" NOT NULL DEFAULT 'NONE',
    "reviewerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResearchGap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GapEvidence" (
    "id" TEXT NOT NULL,
    "gapId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "claimId" TEXT,
    "stance" "EvidenceStance" NOT NULL,
    "passage" TEXT NOT NULL,
    "location" JSONB,
    "note" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GapEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchNote" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "projectId" TEXT,
    "paperId" TEXT,
    "gapId" TEXT,
    "body" TEXT NOT NULL,
    "bookmarked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResearchNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT,
    "paperIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "tokensUsed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentSession" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "projectId" TEXT,
    "goal" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "finalAnswer" TEXT,
    "citations" JSONB,
    "limits" JSONB,
    "tokensUsed" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentStep" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "type" "AgentStepType" NOT NULL,
    "toolName" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx" ON "User"("email");

CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

CREATE INDEX "ResearchProject_ownerId_idx" ON "ResearchProject"("ownerId");
CREATE UNIQUE INDEX "ResearchProject_ownerId_name_key" ON "ResearchProject"("ownerId", "name");

CREATE INDEX "Paper_ownerId_idx" ON "Paper"("ownerId");
CREATE INDEX "Paper_year_idx" ON "Paper"("year");
CREATE INDEX "Paper_doi_idx" ON "Paper"("doi");
CREATE INDEX "Paper_arxivId_idx" ON "Paper"("arxivId");
CREATE UNIQUE INDEX "Paper_ownerId_contentHash_key" ON "Paper"("ownerId", "contentHash");
CREATE UNIQUE INDEX "Paper_ownerId_doi_key" ON "Paper"("ownerId", "doi");
CREATE UNIQUE INDEX "Paper_ownerId_arxivId_key" ON "Paper"("ownerId", "arxivId");

CREATE INDEX "ProjectPaper_projectId_idx" ON "ProjectPaper"("projectId");
CREATE INDEX "ProjectPaper_paperId_idx" ON "ProjectPaper"("paperId");
CREATE UNIQUE INDEX "ProjectPaper_projectId_paperId_key" ON "ProjectPaper"("projectId", "paperId");

CREATE INDEX "PaperAnalysis_paperId_idx" ON "PaperAnalysis"("paperId");
CREATE INDEX "PaperAnalysis_status_idx" ON "PaperAnalysis"("status");
CREATE UNIQUE INDEX "PaperAnalysis_paperId_version_key" ON "PaperAnalysis"("paperId", "version");

CREATE INDEX "ExtractedClaim_paperId_idx" ON "ExtractedClaim"("paperId");
CREATE INDEX "ExtractedClaim_analysisId_idx" ON "ExtractedClaim"("analysisId");
CREATE INDEX "ExtractedClaim_type_idx" ON "ExtractedClaim"("type");

CREATE INDEX "ResearchGapAnalysis_projectId_idx" ON "ResearchGapAnalysis"("projectId");
CREATE INDEX "ResearchGapAnalysis_ownerId_idx" ON "ResearchGapAnalysis"("ownerId");
CREATE INDEX "ResearchGapAnalysis_status_idx" ON "ResearchGapAnalysis"("status");

CREATE INDEX "ResearchGap_analysisId_idx" ON "ResearchGap"("analysisId");
CREATE INDEX "ResearchGap_verificationStatus_idx" ON "ResearchGap"("verificationStatus");
CREATE INDEX "ResearchGap_reviewStatus_idx" ON "ResearchGap"("reviewStatus");

CREATE INDEX "GapEvidence_gapId_idx" ON "GapEvidence"("gapId");
CREATE INDEX "GapEvidence_paperId_idx" ON "GapEvidence"("paperId");
CREATE INDEX "GapEvidence_claimId_idx" ON "GapEvidence"("claimId");

CREATE INDEX "ResearchNote_ownerId_idx" ON "ResearchNote"("ownerId");
CREATE INDEX "ResearchNote_projectId_idx" ON "ResearchNote"("projectId");
CREATE INDEX "ResearchNote_paperId_idx" ON "ResearchNote"("paperId");
CREATE INDEX "ResearchNote_gapId_idx" ON "ResearchNote"("gapId");

CREATE INDEX "Conversation_ownerId_idx" ON "Conversation"("ownerId");
CREATE INDEX "Conversation_projectId_idx" ON "Conversation"("projectId");

CREATE INDEX "ChatMessage_conversationId_idx" ON "ChatMessage"("conversationId");
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

CREATE INDEX "AgentSession_ownerId_idx" ON "AgentSession"("ownerId");
CREATE INDEX "AgentSession_projectId_idx" ON "AgentSession"("projectId");
CREATE INDEX "AgentSession_status_idx" ON "AgentSession"("status");

CREATE INDEX "AgentStep_sessionId_idx" ON "AgentStep"("sessionId");
CREATE UNIQUE INDEX "AgentStep_sessionId_index_key" ON "AgentStep"("sessionId", "index");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResearchProject" ADD CONSTRAINT "ResearchProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Paper" ADD CONSTRAINT "Paper_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectPaper" ADD CONSTRAINT "ProjectPaper_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectPaper" ADD CONSTRAINT "ProjectPaper_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaperAnalysis" ADD CONSTRAINT "PaperAnalysis_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExtractedClaim" ADD CONSTRAINT "ExtractedClaim_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtractedClaim" ADD CONSTRAINT "ExtractedClaim_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "PaperAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResearchGapAnalysis" ADD CONSTRAINT "ResearchGapAnalysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchGapAnalysis" ADD CONSTRAINT "ResearchGapAnalysis_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResearchGap" ADD CONSTRAINT "ResearchGap_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "ResearchGapAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GapEvidence" ADD CONSTRAINT "GapEvidence_gapId_fkey" FOREIGN KEY ("gapId") REFERENCES "ResearchGap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GapEvidence" ADD CONSTRAINT "GapEvidence_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GapEvidence" ADD CONSTRAINT "GapEvidence_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ExtractedClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_gapId_fkey" FOREIGN KEY ("gapId") REFERENCES "ResearchGap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentSession" ADD CONSTRAINT "AgentSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentSession" ADD CONSTRAINT "AgentSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AgentStep" ADD CONSTRAINT "AgentStep_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
