import { Suspense } from "react";
import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa6";
import { routes, site } from "@/config/site";
import { QuoteForm } from "@/components/forms/QuoteForm";
import { isSupabaseConfigured } from "@/lib/database/env";
import { PageHero } from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Request a Quote",
  description: `Request a quote for custom manufactured footballs from ${site.name}. Tell us the type, quantity, materials and branding you need.`,
  alternates: site.url ? { canonical: routes.quote } : undefined,
};

export default function QuotePage() {
  return (
    <>
      <PageHero
        title="Request a quote"
        lead="Tell us what you want manufactured. The more you can share about quantity, materials and branding, the more precise our quote will be."
      />
      <section className="bg-paper py-12 lg:py-20">
        <div className="shell grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <Suspense fallback={<div className="min-h-[40rem] rounded-sm bg-white ring-1 ring-line" />}>
              <QuoteForm backendEnabled={isSupabaseConfigured()} />
            </Suspense>
          </div>
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <h2 className="type-h3 text-navy-deep">Prefer to talk first?</h2>
              <p className="mt-3 text-slate">Reach us directly and discuss your requirements.</p>
              <ul className="mt-6 border-t border-line">
                <li>
                  <a
                    href={site.contact.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 border-b border-line py-5"
                  >
                    <FaWhatsapp aria-hidden className="size-6 text-navy group-hover:text-red" />
                    <span>
                      <span className="block text-sm text-slate">WhatsApp</span>
                      <span className="font-bold text-navy-deep group-hover:underline">{site.contact.whatsappDisplay}</span>
                    </span>
                  </a>
                </li>
                <li>
                  <a href={`mailto:${site.contact.email}`} className="group flex items-center gap-4 border-b border-line py-5">
                    <Mail aria-hidden className="size-6 text-navy group-hover:text-red" />
                    <span className="min-w-0">
                      <span className="block text-sm text-slate">Email</span>
                      <span className="font-bold break-all text-navy-deep group-hover:underline">{site.contact.email}</span>
                    </span>
                  </a>
                </li>
              </ul>
              <h2 className="type-h3 mt-10 text-navy-deep">What helps us quote</h2>
              <ul className="mt-4 grid gap-2.5 text-slate">
                {[
                  "The type of football and where it will be used",
                  "The quantity you need",
                  "Your logo and artwork files, if you have them",
                  "The country the order ships to",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-red" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
