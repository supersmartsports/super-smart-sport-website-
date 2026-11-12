/**
 * Confirmed company information. Everything in this file comes directly
 * from SUPER SMART SPORTS; nothing here is placeholder content.
 */

/** Set NEXT_PUBLIC_SITE_URL once the production domain is confirmed. */
const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

export const site = {
  name: "SUPER SMART SPORTS",
  shortName: "SSS",
  tagline: "Premium Customized Football Manufacturing",
  description:
    "SUPER SMART SPORTS manufactures fully customized footballs for brands, clubs and distributors worldwide. Match, training and futsal footballs made to your design, materials and specifications.",
  /** Undefined until a real domain is configured, so no canonical URL is invented. */
  url: configuredUrl,
  logo: {
    square: "/brand/logo/sss-logo.jpeg",
    round: "/brand/logo/sss-logo-round.png",
  },
  contact: {
    whatsappDisplay: "+92 316 7327221",
    whatsappNumber: "923167327221",
    whatsappUrl: "https://wa.me/923167327221",
    email: "supersmartsports8@gmail.com",
  },
} as const;

export type SocialId = "instagram" | "facebook" | "threads" | "linkedin" | "tiktok";

export const socials: { id: SocialId; label: string; href: string }[] = [
  {
    id: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/supersamartsports?rpxt=ajg5emlnMm82cWx1",
  },
  {
    id: "facebook",
    label: "Facebook",
    href: "https://www.facebook.com/share/1955xuHCBG/",
  },
  {
    id: "threads",
    label: "Threads",
    href: "https://www.threads.com/@supersamartsports",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/super-smart-sports-925956402?utm_source=share_via&utm_content=profile&utm_medium=membeRr_android",
  },
  {
    id: "tiktok",
    label: "TikTok",
    href: "https://www.tiktok.com/@super_smart_sports?_r=1&_t=ZS-9BLXxZtgTm0",
  },
];

export const routes = {
  home: "/",
  about: "/about",
  products: "/products",
  product: (slug: string) => `/product/${slug}`,
  customization: "/customization",
  manufacturing: "/manufacturing",
  quality: "/quality",
  reviews: "/reviews",
  contact: "/contact",
  quote: "/request-a-quote",
} as const;
