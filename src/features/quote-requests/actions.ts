"use server";

import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/database/env";
import { rateLimit } from "@/lib/utilities/rate-limit";
import { inquirySchema } from "@/lib/validations/inquiry";

export type SubmitResult =
  | { status: "sent" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "unavailable" };

/**
 * Sends the website's quote request to the business database. It uses the anonymous key and one
 * narrow database function (submit_inquiry), so a visitor can add an inquiry and nothing else.
 */
export async function submitInquiry(input: Record<string, string>): Promise<SubmitResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  // A hidden field real visitors never fill in: if it has a value, a bot sent this.
  if (input.website) return { status: "sent" };

  const ip = ((await headers()).get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (!rateLimit(`inquiry:${ip}`, 5, 10 * 60_000).allowed) return { status: "error", message: "Too many requests. Please wait a few minutes, or contact us on WhatsApp." };

  const parsed = inquirySchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { status: "error", message: "Please check the highlighted fields.", fieldErrors };
  }
  const v = parsed.data;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.rpc("submit_inquiry", {
    p_name: v.name, p_email: v.email, p_whatsapp: v.whatsapp, p_country: v.country, p_company: v.company,
    p_football_type: v.footballType, p_quantity: v.quantity, p_message: v.instructions,
    p_requirements: { design: v.design, material: v.material, logo: v.logo }, p_source: "website",
  });
  if (error) return { status: "error", message: "Your request could not be sent. Please try again, or contact us on WhatsApp." };
  return { status: "sent" };
}
