import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { site } from "@/config/site";
import { NewPasswordForm } from "@/components/admin/ResetForms";
import { isSupabaseConfigured } from "@/lib/database/env";
import { createUserClient } from "@/lib/database/server";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  // Only reachable from the emailed link, which signs the person in first.
  if (!isSupabaseConfigured()) redirect("/admin/login");
  const { data } = await (await createUserClient()).auth.getUser();
  if (!data.user) redirect("/admin/forgot-password?expired=1");
  return (
    <main className="grid min-h-svh place-items-center bg-navy-deep px-5 py-12 text-white">
      <div className="w-full max-w-sm">
        <Image src={site.logo.round} alt={site.name} width={72} height={72} className="mx-auto rounded-full bg-white" priority />
        <h1 className="type-h2 mt-6 text-center">Choose a new password</h1>
        <NewPasswordForm />
      </div>
    </main>
  );
}
