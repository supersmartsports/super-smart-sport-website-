import { routes } from "@/config/site";

export const mainNavigation = [
  { label: "Home", href: routes.home },
  { label: "About Us", href: routes.about },
  { label: "Footballs", href: routes.products },
  { label: "Customization", href: routes.customization },
  { label: "Manufacturing", href: routes.manufacturing },
  { label: "Quality", href: routes.quality },
  { label: "Reviews", href: routes.reviews },
  { label: "Contact", href: routes.contact },
] as const;
