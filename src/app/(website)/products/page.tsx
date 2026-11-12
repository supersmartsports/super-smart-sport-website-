import type { Metadata } from "next";
import { routes, site } from "@/config/site";
import { products } from "@/data/products";
import { averageRating, reviewsForProduct } from "@/data/reviews";
import { PageHero } from "@/components/layout/PageHero";
import { QuoteCta } from "@/components/layout/QuoteCta";
import { ProductCatalog } from "@/components/products/ProductCatalog";

export const metadata: Metadata = {
  title: "Football Collection",
  description: `Browse ${products.length} original football designs from ${site.name} in 3D. Every design is manufactured to order in your colours, graphics and branding.`,
  alternates: site.url ? { canonical: routes.products } : undefined,
};

export default function ProductsPage() {
  // Ratings appear only for products that have genuine reviews.
  const ratings: Record<string, { average: number; count: number }> = {};
  for (const product of products) {
    const list = reviewsForProduct(product.slug);
    const average = averageRating(list);
    if (average !== null) ratings[product.slug] = { average, count: list.length };
  }

  return (
    <>
      <PageHero
        title="The football collection"
        lead={`${products.length} original designs, each manufactured to order. Choose one as your starting point and we produce it with your logo, colours and specification.`}
      />
      <section className="bg-paper py-12 lg:py-16">
        <div className="shell">
          <ProductCatalog products={products} ratings={ratings} />
          <p className="mt-10 max-w-[70ch] text-sm text-slate">
            These footballs are design references, not stock. Nothing is sold ready-made. Construction and material are
            shown where the original design defines them; everything else is specified with you when you request a quote.
          </p>
        </div>
      </section>
      <QuoteCta
        title="Have your own design?"
        text="You do not need to start from our collection. Send us your artwork or a description and we will work from that."
        poster="/images/footballs/gold-32-panel.webp"
      />
    </>
  );
}
