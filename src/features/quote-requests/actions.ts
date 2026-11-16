"use server";

import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/database/env";
import { checkFile, MAX_FILES_PER_REQUEST } from "@/lib/uploads";
import { rateLimit } from "@/lib/utilities/rate-limit";
import { inquirySchema } from "@/lib/validations/inquiry";

export type SubmitResult =
  | { status: "sent"; reference: string | null; duplicate: boolean; artwork: { saved: number; failed: string[] } }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "unavailable" };

const FIELDS = ["name", "company", "email", "country", "whatsapp", "footballType", "quantity", "design", "material", "logo", "instructions"] as const;

/**
 * Saves the website's quote request in the business database, with any artwork.
 * Success is reported only after the database has confirmed the record. The visitor's key is the
 * duplicate guard: sending the same form twice returns the first inquiry instead of creating another.
 */
export async function submitInquiry(formData: FormData): Promise<SubmitResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable" };

  // A hidden field real visitors never fill in: a bot did.
  if (formData.get("website")) return { status: "sent", reference: null, duplicate: false, artwork: { saved: 0, failed: [] } };

  const ip = ((await headers()).get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (!rateLimit(`inquiry:${ip}`, 5, 10 * 60_000).allowed) return { status: "error", message: "Too many requests. Please wait a few minutes, or contact us on WhatsApp." };

  const parsed = inquirySchema.safeParse(Object.fromEntries(FIELDS.map((f) => [f, formData.get(f)?.toString() ?? ""])));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { status: "error", message: "Please check the highlighted fields.", fieldErrors };
  }
  const v = parsed.data;

  // Check the files before anything is saved, so a bad file does not leave a half-finished inquiry.
  const files = formData.getAll("artwork").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_FILES_PER_REQUEST) return { status: "error", message: `Attach at most ${MAX_FILES_PER_REQUEST} files.` };
  const checked: { bytes: Uint8Array; mime: string; name: string }[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = checkFile(file, bytes);
    if (!result.ok) return { status: "error", message: result.reason };
    checked.push({ bytes, mime: result.type.mime, name: result.name });
  }

  const key = String(formData.get("key") ?? "");
  const anon = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await anon.rpc("submit_inquiry_v2", {
    p_key: /^[A-Za-z0-9-]{8,80}$/.test(key) ? key : null,
    p_name: v.name, p_email: v.email, p_whatsapp: v.whatsapp, p_country: v.country, p_company: v.company,
    p_football_type: v.footballType, p_quantity: v.quantity, p_message: v.instructions,
    p_requirements: { design: v.design, material: v.material, logo: v.logo }, p_source: "website",
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return { status: "error", message: "Your request could not be saved. Please try again, or contact us on WhatsApp." };

  // Store the artwork privately. It needs the server-only service key, because visitors have no database access.
  const artwork = { saved: 0, failed: [] as string[] };
  if (checked.length > 0 && !row.duplicate) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) artwork.failed = checked.map((f) => f.name);
    else {
      const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      for (const file of checked) {
        const path = `inquiries/${row.id}/${crypto.randomUUID()}-${file.name}`;
        const { error: uploadError } = await service.storage.from("business-files").upload(path, file.bytes, { contentType: file.mime, upsert: false });
        const { error: recordError } = uploadError ? { error: uploadError } : await service.from("attachments").insert({
          entity_type: "inquiry", entity_id: row.id, kind: "artwork", storage_path: path, file_name: file.name, mime_type: file.mime, size_bytes: file.bytes.length,
        });
        if (uploadError || recordError) {
          if (!uploadError) await service.storage.from("business-files").remove([path]); // do not leave a file nobody can find
          artwork.failed.push(file.name);
        } else artwork.saved += 1;
      }
    }
  }
  return { status: "sent", reference: row.inquiry_number, duplicate: Boolean(row.duplicate), artwork };
}
