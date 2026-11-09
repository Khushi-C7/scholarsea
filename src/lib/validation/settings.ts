import { z } from "zod";

/** BCP-47-ish language tag (letters + optional region), kept simple. */
const langTag = z
  .string()
  .trim()
  .regex(/^[a-zA-Z]{2,3}(-[a-zA-Z]{2,8})?$/, "Invalid language code")
  .max(16);

export const updateSettingsSchema = z.object({
  aiProvider: z.string().trim().max(60).nullable().optional(),
  aiModel: z.string().trim().max(80).nullable().optional(),
  outputLanguage: langTag.optional(),
  theme: z.enum(["LIGHT", "DARK", "SYSTEM"]).optional(),
  promptOverrides: z
    .record(z.string().max(60), z.string().max(4000))
    .optional(),
});

export const setApiKeySchema = z.object({
  providerId: z.string().trim().min(1).max(60),
  key: z.string().trim().min(8, "Key looks too short").max(400),
});

export const clearApiKeySchema = z.object({
  providerId: z.string().trim().min(1).max(60),
});

export const testConnectionSchema = z.object({
  providerId: z.string().trim().min(1).max(60),
  modelId: z.string().trim().min(1).max(80),
  /** Optional freshly-typed key; when omitted the stored key is used. */
  key: z.string().trim().min(8).max(400).optional(),
  baseUrl: z.string().trim().url().max(300).optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type SetApiKeyInput = z.infer<typeof setApiKeySchema>;
export type TestConnectionInput = z.infer<typeof testConnectionSchema>;
