import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Archivo } from "next/font/google";
import { site } from "@/config/site";
import "./globals.css";

// One variable family. The width axis gives a condensed display voice and a regular text voice.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  // Only set once a real domain is configured, so no URL is invented.
  ...(site.url ? { metadataBase: new URL(site.url) } : {}),
  title: {
    default: `${site.name} | Custom Football Manufacturer`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "custom football manufacturer",
    "private label footballs",
    "custom soccer balls",
    "match footballs",
    "training footballs",
    "futsal balls",
    "football exporter",
  ],
  openGraph: {
    type: "website",
    siteName: site.name,
    title: `${site.name} | Custom Football Manufacturer`,
    description: site.description,
    locale: "en",
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#070b35",
  width: "device-width",
  initialScale: 1,
  // Lets the floating chat button sit above the phone's bottom safe area.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
