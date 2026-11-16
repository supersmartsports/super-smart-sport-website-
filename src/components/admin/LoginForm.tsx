"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/features/auth/actions";
import { Button } from "@/components/buttons/Button";

const field =
  "mt-2 min-h-12 w-full rounded-xs border border-white/25 bg-white/5 px-4 text-base text-white placeholder:text-white/40 " +
  "focus:border-white focus:outline-2 focus:outline-offset-0 focus:outline-white";

export function LoginForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});
  return (
    <form action={action} className="mt-8 grid gap-5" noValidate>
      <div>
        <label htmlFor="email" className="type-label text-white/75">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className={field} />
      </div>
      <div>
        <label htmlFor="password" className="type-label text-white/75">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={field} />
      </div>
      <p role="alert" aria-live="assertive" className="min-h-5 text-sm font-semibold text-[#ff8a90]">
        {state.error}
      </p>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Signing in" : "Sign in"}
      </Button>
      <p className="text-center text-sm"><a href="/admin/forgot-password" className="text-white/75 underline underline-offset-4 hover:text-white">Forgot your password?</a></p>
    </form>
  );
}
