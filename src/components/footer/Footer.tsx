import Link from "next/link";
import { Mail } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa6";
import { routes, site } from "@/config/site";
import { mainNavigation } from "@/data/navigation";
import { ButtonLink } from "@/components/buttons/Button";
import { Logo } from "@/components/ui/Logo";
import { SocialLinks } from "@/components/ui/SocialLinks";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-navy-ink text-white">
      <div className="shell grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1.2fr_1fr] lg:gap-10 lg:py-20">
        <div>
          <Logo size={64} />
          <p className="mt-6 max-w-xs text-white/70">{site.tagline}.</p>
          <ButtonLink href={routes.quote} className="mt-7">
            Request a Quote
          </ButtonLink>
        </div>

        <nav aria-label="Footer">
          <h2 className="type-label text-white/55">Quick links</h2>
          <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-1">
            {mainNavigation.map(({ label, href }) => (
              <li key={href}>
                <Link href={href} className="inline-block py-1.5 text-white/80 transition-colors hover:text-white">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="type-label text-white/55">Contact</h2>
          <ul className="mt-5 grid gap-4">
            <li>
              <a
                href={site.contact.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3"
              >
                <FaWhatsapp aria-hidden className="mt-1 size-5 shrink-0 text-white/60 transition-colors group-hover:text-red" />
                <span>
                  <span className="block text-sm text-white/55">WhatsApp</span>
                  <span className="font-semibold group-hover:underline">{site.contact.whatsappDisplay}</span>
                </span>
              </a>
            </li>
            <li>
              <a href={`mailto:${site.contact.email}`} className="group flex items-start gap-3">
                <Mail aria-hidden className="mt-1 size-5 shrink-0 text-white/60 transition-colors group-hover:text-red" />
                <span className="min-w-0">
                  <span className="block text-sm text-white/55">Email</span>
                  <span className="font-semibold break-all group-hover:underline">{site.contact.email}</span>
                </span>
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="type-label text-white/55">Social media</h2>
          <SocialLinks className="mt-5" />
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="shell flex flex-col gap-2 py-6 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {site.name}. All rights reserved.
          </p>
          <p>Custom football manufacturing and export.</p>
        </div>
      </div>
    </footer>
  );
}
