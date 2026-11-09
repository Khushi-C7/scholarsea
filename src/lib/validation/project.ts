import { z } from "zod";

const tag = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[^,]+$/, "Tags cannot contain commas");

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(2000).optional(),
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined, {
    message: "Nothing to update",
  });

/** Add a paper to a project, with optional initial tags. */
export const addPaperSchema = z.object({
  paperId: z.string().min(1, "paperId is required"),
  tags: z.array(tag).max(30).optional(),
});

/** Replace the tag set on a project-paper membership. */
export const setTagsSchema = z.object({
  tags: z.array(tag).max(30),
});

export const createNoteSchema = z
  .object({
    body: z.string().trim().min(1, "Note cannot be empty").max(10000),
    projectId: z.string().min(1).optional(),
    paperId: z.string().min(1).optional(),
    gapId: z.string().min(1).optional(),
    bookmarked: z.boolean().optional(),
  })
  .refine((v) => v.projectId || v.paperId || v.gapId, {
    message: "A note must attach to a project, paper, or gap",
  });

export const updateNoteSchema = z
  .object({
    body: z.string().trim().min(1).max(10000).optional(),
    bookmarked: z.boolean().optional(),
  })
  .refine((v) => v.body !== undefined || v.bookmarked !== undefined, {
    message: "Nothing to update",
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type AddPaperInput = z.infer<typeof addPaperSchema>;
export type SetTagsInput = z.infer<typeof setTagsSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

// --- Library query (search / filter / sort) --------------------------------

export const LIBRARY_SORTS = [
  "recent",
  "oldest",
  "title",
  "year_desc",
  "year_asc",
] as const;
export const librarySortSchema = z.enum(LIBRARY_SORTS).default("recent");

export const EXTRACTION_STATUSES = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export const PAPER_SOURCES = [
  "PASTED_TEXT",
  "PDF_UPLOAD",
  "URL",
  "ACADEMIC_SEARCH",
] as const;

/** Parsed, validated library filters (from URL search params). */
export const libraryQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(EXTRACTION_STATUSES).optional(),
  source: z.enum(PAPER_SOURCES).optional(),
  year: z.coerce.number().int().min(1800).max(2100).optional(),
  tag: z.string().trim().max(40).optional(),
  bookmarked: z
    .union([z.literal("1"), z.literal("true")])
    .optional()
    .transform((v) => v !== undefined),
  sort: librarySortSchema,
});

export type LibraryQuery = z.infer<typeof libraryQuerySchema>;
