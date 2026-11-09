import { z } from "zod";

/** Pasted-text ingestion (JSON). */
export const pasteIngestSchema = z.object({
  source: z.literal("pasted_text"),
  title: z.string().trim().max(300).optional(),
  text: z.string().min(1, "Text is required"),
});

/** Public-URL ingestion (JSON). */
export const urlIngestSchema = z.object({
  source: z.literal("url"),
  url: z.string().trim().min(1, "URL is required").max(2048),
});

/** JSON body for the ingest endpoint (PDF upload comes as multipart). */
export const jsonIngestSchema = z.discriminatedUnion("source", [
  pasteIngestSchema,
  urlIngestSchema,
]);

export type JsonIngestInput = z.infer<typeof jsonIngestSchema>;
