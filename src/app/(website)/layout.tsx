import type { ReactNode } from "react";
import { Header } from "@/components/navigation/Header";
import { Footer } from "@/components/footer/Footer";
import { WhatsAppWidget } from "@/components/whatsapp/WhatsAppWidget";

export default function WebsiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-xs focus:bg-white focus:px-4 focus:py-3 focus:font-semibold focus:text-navy"
      >
        Skip to main content
      </a>
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <WhatsAppWidget />
    </>
  );
}
