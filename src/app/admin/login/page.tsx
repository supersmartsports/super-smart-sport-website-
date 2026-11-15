import type { Metadata } from "next";
import Image from "next/image";
import { site } from "@/config/site";
import { isSupabaseConfigured } from "@/lib/database/env";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = {
  title: "Staff sign in",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  const configured = isSupabaseConfigured();
  return (
    <main className="grid min-h-svh place-items-center bg-navy-deep px-5 py-12 text-white">
      <div className="w-full max-w-sm">
        <Image src={site.logo.round} alt={site.name} width={72} height={72} className="mx-auto rounded-full bg-white" priority />
        <h1 className="type-h2 mt-6 text-center">Staff sign in</h1>
        <p className="mt-2 text-center text-white/65">{site.name} business platform</p>

        {configured ? (
          <LoginForm />
        ) : (
          <div role="status" className="mt-8 rounded-sm bg-white/8 p-5 ring-1 ring-white/20">
            <h2 className="font-bold">Sign-in is not set up yet</h2>
            <p className="mt-2 text-sm text-white/75">
              This platform needs its Supabase project connected first. Add the project URL and keys to <code>.env.local</code>{" "}
              (see <code>.env.example</code>) and apply the migrations in <code>database/migrations</code>.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
