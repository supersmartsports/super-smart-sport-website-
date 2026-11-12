import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa6";
import { routes, site } from "@/config/site";
import { ButtonLink } from "@/components/buttons/Button";
import { PageHero } from "@/components/layout/PageHero";
import { SocialLinks } from "@/components/ui/SocialLinks";

export const metadata: Metadata = {
  title: "Contact",
  description: `Contact ${site.name} about custom football manufacturing by WhatsApp or email, or follow us on Instagram, Facebook, Threads, LinkedIn and TikTok.`,
  alternates: site.url ? { canonical: routes.contact } : undefined,
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        title="Talk to the manufacturer"
        lead="Questions about a custom order, materials or quantities? Message us directly. WhatsApp is the fastest way to reach us."
      />

      <section className="section bg-white">
        <div className="shell grid gap-5 md:grid-cols-2">
          <a
            href={site.contact.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col rounded-sm bg-navy p-8 text-white transition-colors hover:bg-navy-deep sm:p-10"
          >
            <FaWhatsapp aria-hidden className="size-10" />
            <h2 className="type-h3 mt-8 text-white/70">WhatsApp</h2>
            <p className="type-h2 mt-2 break-words">{site.contact.whatsappDisplay}</p>
            <p className="mt-auto pt-8 font-semibold underline decoration-red decoration-2 underline-offset-[6px]">
              Open a WhatsApp chat
            </p>
          </a>
          <a
            href={`mailto:${site.contact.email}`}
            className="group flex flex-col rounded-sm bg-paper p-8 text-navy-deep ring-1 ring-line transition-colors hover:ring-navy sm:p-10"
          >
            <Mail aria-hidden strokeWidth={1.5} className="size-10 text-navy" />
            <h2 className="type-h3 mt-8 text-slate">Email</h2>
            <p className="mt-2 text-[clamp(1.25rem,2.6vw,2rem)] leading-tight font-extrabold break-all [font-stretch:75%]">
              {site.contact.email}
            </p>
            <p className="mt-auto pt-8 font-semibold underline decoration-red decoration-2 underline-offset-[6px]">
              Write us an email
            </p>
          </a>
        </div>
      </section>

      <section className="section bg-navy-deep text-white">
        <div className="shell grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <h2 className="type-h2">Custom manufacturing inquiry</h2>
            <p className="type-lead mt-6 max-w-[50ch] text-white/75">
              Ready to brief us? The quote form collects what we need: the type of football, the quantity, materials
              and your branding. You then send it to us by WhatsApp or email.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={routes.quote} size="lg">
                Request a Quote
              </ButtonLink>
              <ButtonLink href={routes.customization} variant="outline-light" size="lg">
                Customize Your Football
              </ButtonLink>
            </div>
          </div>
          <div>
            <h2 className="type-h3">Follow {site.name}</h2>
            <p className="mt-3 text-white/65">New designs and production updates on our official channels.</p>
            <SocialLinks layout="list" className="mt-6 border-t border-white/15" />
          </div>
        </div>
      </section>
    </>
  );
}
