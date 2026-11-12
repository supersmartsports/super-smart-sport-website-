import type { MetadataRoute } from "next";
import { routes, site } from "@/config/site";
import { products } from "@/data/products";

// Uses the configured domain. Until NEXT_PUBLIC_SITE_URL is set this falls back to
// the local address, so set it before the site goes live.
const base = site.url ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    routes.home,
    routes.about,
    routes.products,
    routes.customization,
    routes.manufacturing,
    routes.quality,
    routes.reviews,
    routes.contact,
    routes.quote,
  ];
  return [
    ...pages.map((path) => ({ url: `${base}${path === "/" ? "" : path}`, priority: path === "/" ? 1 : 0.8 })),
    ...products.map((product) => ({ url: `${base}${routes.product(product.slug)}`, priority: 0.6 })),
  ];
}
