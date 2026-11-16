"use client";

import { useActionState } from "react";
import { requestPasswordReset, updatePassword, type ResetState } from "@/features/auth/actions";
import { Button } from "@/components/buttons/Button";

const field = "mt-2 min-h-12 w-full rounded-xs border border-white/25 bg-white/5 px-4 text-base text-white placeholder:text-white/40 focus:border-white focus:outline-2 focus:outline-offset-0 focus:outline-white";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(requestPasswordReset, {});
  return (
    <form action={action} className="mt-8 grid gap-5" noValidate>
      <div><label htmlFor="email" className="type-label text-white/75">Your staff email</label><input id="email" name="email" type="email" autoComplete="username" required className={field} /></div>
      <p role={state.error ? "alert" : "status"} aria-live="polite" className={`min-h-5 text-sm font-semibold ${state.error ? "text-[#ff8a90]" : "text-white"}`}>{state.error ?? state.ok}</p>
      <Button type="submit" size="lg" disabled={pending} className="w-full">{pending ? "Sending" : "Send reset link"}</Button>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(updatePassword, {});
  return (
    <form action={action} className="mt-8 grid gap-5" noValidate>
      <div><label htmlFor="password" className="type-label text-white/75">New password</label><input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} className={field} /></div>
      <div><label htmlFor="confirm" className="type-label text-white/75">Repeat it</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={12} className={field} /></div>
      <p role="alert" aria-live="assertive" className="min-h-5 text-sm font-semibold text-[#ff8a90]">{state.error}</p>
      <Button type="submit" size="lg" disabled={pending} className="w-full">{pending ? "Saving" : "Set new password"}</Button>
    </form>
  );
}
