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
        lead={`${products.length} designs, each made to order.`}
      />
      <section className="bg-paper py-12 lg:py-16">
        <div className="shell">
          <ProductCatalog products={products} ratings={ratings} />
        </div>
      </section>
      <QuoteCta
        title="Have your own design?"
        text="Send us your artwork."
        poster="/images/footballs/gold-32-panel.webp"
      />
    </>
  );
}
