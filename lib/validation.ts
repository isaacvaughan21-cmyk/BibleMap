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

export const feedbackSchema = z.object({
  message: z
    .string()
    .trim()
    .min(3, "Say a little more — at least a few words.")
    .max(2000, "Keep it under 2,000 characters."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .regex(emailRegex, "Enter a valid email address.")
    .optional()
    .or(z.literal("")),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
