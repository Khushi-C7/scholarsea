-- Add the full structured run artifact to PaperAnalysis.
ALTER TABLE "PaperAnalysis" ADD COLUMN "report" JSONB;
