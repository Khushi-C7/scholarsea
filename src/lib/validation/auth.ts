import { z } from "zod";

/** Input schema for creating an account. */
export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120).optional(),
  email: z.email("Enter a valid email").max(254),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200, "Password is too long"),
});

/** Input schema for logging in. */
export const loginSchema = z.object({
  email: z.email("Enter a valid email").max(254),
  password: z.string().min(1, "Password is required").max(200),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
