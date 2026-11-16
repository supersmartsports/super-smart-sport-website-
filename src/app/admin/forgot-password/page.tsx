import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { site } from "@/config/site";
import { ForgotPasswordForm } from "@/components/admin/ResetForms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: false } };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  return (
    <main className="grid min-h-svh place-items-center bg-navy-deep px-5 py-12 text-white">
      <div className="w-full max-w-sm">
        <Image src={site.logo.round} alt={site.name} width={72} height={72} className="mx-auto rounded-full bg-white" priority />
        <h1 className="type-h2 mt-6 text-center">Reset password</h1>
        {expired && <p role="alert" className="mt-4 text-center text-sm font-semibold text-[#ff8a90]">That link has expired. Request a new one.</p>}
        <ForgotPasswordForm />
        <p className="mt-6 text-center text-sm"><Link href="/admin/login" className="text-white/75 underline underline-offset-4 hover:text-white">Back to sign in</Link></p>
      </div>
    </main>
  );
}
