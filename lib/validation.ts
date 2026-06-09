import { z } from "zod";

/**
 * RFC-light email validation. Trim + lowercase, cap at 254 chars (the SMTP
 * maximum), and require a pragmatic email shape — not full RFC 5322, which is
 * famously over-permissive.
 */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const waitlistSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "That email is too long.")
    .regex(emailRegex, "Enter a valid email address."),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;
