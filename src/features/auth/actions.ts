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
