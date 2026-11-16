"use server";

import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/database/env";
import { rateLimit } from "@/lib/utilities/rate-limit";

export type ReviewState = { status: "idle" | "sent" | "error" | "unavailable"; message?: string };

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  country: z.string().trim().max(100).optional(),
  rating: z.coerce.number().int().min(1, "Choose a rating.").max(5, "Choose a rating."),
  body: z.string().trim().min(10, "Write at least a sentence.").max(2000, "Keep it under 2000 characters."),
  productSlug: z.string().trim().regex(/^[a-z0-9-]+$/).max(80).optional().or(z.literal("")),
});

/** A visitor's review. It is saved as "pending" and is invisible to the public until staff approve it. */
export async function submitReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  if (!isSupabaseConfigured()) return { status: "unavailable", message: "Reviews cannot be submitted yet." };
  if (formData.get("website")) return { status: "sent", message: "Thank you. Your review will appear after we check it." }; // spam trap

  const ip = ((await headers()).get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (!rateLimit(`review:${ip}`, 3, 60 * 60_000).allowed) return { status: "error", message: "Too many reviews from this connection. Please try again later." };

  const parsed = schema.safeParse({
    name: formData.get("name"), country: formData.get("country") || undefined, rating: formData.get("rating"),
    body: formData.get("body"), productSlug: formData.get("productSlug") || "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  const v = parsed.data;

  const db = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.rpc("submit_review", { p_product_slug: v.productSlug || null, p_name: v.name, p_country: v.country ?? null, p_rating: v.rating, p_body: v.body });
  if (error) return { status: "error", message: "Your review could not be saved. Please try again." };
  return { status: "sent", message: "Thank you. Your review will appear after we check it." };
}
