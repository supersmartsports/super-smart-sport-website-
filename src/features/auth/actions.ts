"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/database/env";
import { createUserClient } from "@/lib/database/server";
import { rateLimit } from "@/lib/utilities/rate-limit";
import { signInSchema } from "@/lib/validations/auth";

export type SignInState = { error?: string };

const WINDOW = 15 * 60_000;

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  if (!isSupabaseConfigured()) return { error: "Sign-in is not set up yet. The project needs its Supabase credentials." };

  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Slow down password guessing, per address and per account.
  const ip = ((await headers()).get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (!rateLimit(`signin:ip:${ip}`, 20, WINDOW).allowed || !rateLimit(`signin:email:${parsed.data.email}`, 6, WINDOW).allowed) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }

  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // One message for every failure, so the form never reveals which emails have accounts.
  if (error) return { error: "The email or password is incorrect." };

  // A valid login is not enough: the account must also be active staff with a role.
  const { data } = await supabase.rpc("my_access");
  if (!(Array.isArray(data) ? data[0] : data)) {
    await supabase.auth.signOut();
    return { error: "This account has no staff access. Ask the owner to set it up." };
  }
  redirect("/admin/dashboard");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createUserClient();
    await supabase.auth.signOut();
  }
  redirect("/admin/login");
}

export type ResetState = { error?: string; ok?: string };

/** Sends a password reset link. The answer is the same whether or not the address has an account. */
export async function requestPasswordReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  if (!isSupabaseConfigured()) return { error: "Password reset is not set up yet." };
  const parsed = signInSchema.pick({ email: true }).safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ip = ((await headers()).get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (!rateLimit(`reset:${ip}`, 5, WINDOW).allowed || !rateLimit(`reset:${parsed.data.email}`, 3, WINDOW).allowed) return { error: "Too many requests. Wait a few minutes and try again." };
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const supabase = await createUserClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${origin}/admin/auth/callback?next=/admin/reset-password` });
  return { ok: "If that email belongs to a staff account, a reset link is on its way." };
}

/** Sets a new password for the person who followed the reset link (they are signed in by the link). */
export async function updatePassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  if (!isSupabaseConfigured()) return { error: "Password reset is not set up yet." };
  const password = String(formData.get("password") ?? "");
  if (password.length < 12) return { error: "Use at least 12 characters." };
  if (password !== String(formData.get("confirm") ?? "")) return { error: "The two passwords do not match." };
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "This reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "The password could not be changed. Choose a different one." };
  redirect("/admin/dashboard");
}
