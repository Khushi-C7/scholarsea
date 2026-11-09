import { z } from "zod";

const yr = z.coerce.number().int().min(1991).max(2100);

/** Validated academic-search query (from URL params). */
export const searchQuerySchema = z
  .object({
    q: z.string().trim().max(300).optional(),
    title: z.string().trim().max(300).optional(),
    author: z.string().trim().max(200).optional(),
    yearFrom: yr.optional(),
    yearTo: yr.optional(),
    start: z.coerce.number().int().min(0).max(1000).optional(),
    maxResults: z.coerce.number().int().min(1).max(50).optional(),
  })
  .refine((v) => Boolean(v.q || v.title || v.author), {
    message: "Enter a keyword, title, or author to search.",
  });

/** A result the client asks to import — must carry a real arXiv id. */
export const importArxivSchema = z.object({
  arxivId: z.string().trim().min(1).max(60),
  version: z.string().max(10).nullable().optional(),
  title: z.string().trim().min(1).max(500),
  authors: z.array(z.string().min(1).max(200)).max(100).default([]),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  abstract: z.string().max(10000).nullable().optional(),
  url: z.string().trim().max(500).optional(),
  doi: z.string().trim().max(200).nullable().optional(),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type ImportArxivInput = z.infer<typeof importArxivSchema>;
