"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Menu, X } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa6";
import { routes, site } from "@/config/site";
import { mainNavigation } from "@/data/navigation";
import { ButtonLink } from "@/components/buttons/Button";
import { Logo } from "@/components/ui/Logo";
import { SocialLinks } from "@/components/ui/SocialLinks";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // A single football page belongs to the Footballs section.
  if (href === routes.products && pathname.startsWith("/product")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the menu after navigating.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
      // Keep keyboard focus inside the open menu.
      if (event.key === "Tab" && panel.current) {
        const focusable = panel.current.querySelectorAll<HTMLElement>("a[href], button");
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
    {/* Always solid, so it reads correctly over any section even before scripts load. */}
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b bg-navy-deep transition-[border-color,box-shadow] duration-300 ${
        scrolled || open ? "border-white/10 shadow-overlay" : "border-transparent"
      }`}
    >
      <div className="shell flex h-[4.5rem] items-center justify-between gap-6 lg:h-20">
        <Logo size={46} />

        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex items-center gap-7 2xl:gap-9">
            {mainNavigation.map(({ label, href }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`relative block py-2 text-[0.875rem] font-semibold tracking-[0.05em] uppercase transition-colors [font-stretch:84%] after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:bg-red after:transition-transform after:duration-300 ${
                      active
                        ? "text-white after:scale-x-100"
                        : "text-white/70 after:scale-x-0 hover:text-white hover:after:scale-x-100"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <ButtonLink href={routes.quote}>Request a Quote</ButtonLink>
          </div>
          <button
            ref={menuButton}
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
            className="grid size-11 place-items-center rounded-xs border border-white/25 text-white transition-colors hover:border-white xl:hidden"
          >
            {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          </button>
        </div>
      </div>
    </header>

      {/* Outside the header so it can fill the screen below it. */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 top-[4.5rem] bottom-0 z-40 overflow-y-auto bg-navy-deep lg:top-20 xl:hidden"
          >
            <div className="shell flex min-h-full flex-col pt-4 pb-8">
              <nav aria-label="Mobile">
                <ul>
                  {mainNavigation.map(({ label, href }, index) => {
                    const active = isActive(pathname, href);
                    return (
                      <motion.li
                        key={href}
                        initial={reducedMotion ? false : { opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.04 * index, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        className="border-b border-white/10"
                      >
                        <Link
                          href={href}
                          aria-current={active ? "page" : undefined}
                          className={`flex min-h-14 items-center justify-between py-2 text-[1.75rem] leading-none font-extrabold uppercase [font-stretch:68%] ${
                            active ? "text-white" : "text-white/75"
                          }`}
                        >
                          {label}
                          {active && <span aria-hidden className="size-2 rounded-full bg-red" />}
                        </Link>
                      </motion.li>
                    );
                  })}
                </ul>
              </nav>

              <div className="mt-8 grid gap-3">
                <ButtonLink href={routes.quote} size="lg" className="w-full">
                  Request a Quote
                </ButtonLink>
                <a
                  href={site.contact.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-14 items-center justify-center gap-2.5 rounded-xs border border-white/25 px-6 font-semibold text-white"
                >
                  <FaWhatsapp aria-hidden className="size-5" />
                  WhatsApp {site.contact.whatsappDisplay}
                </a>
              </div>

              <div className="mt-auto pt-10">
                <p className="mb-3 text-sm text-white/55">Follow SUPER SMART SPORTS</p>
                <SocialLinks />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
