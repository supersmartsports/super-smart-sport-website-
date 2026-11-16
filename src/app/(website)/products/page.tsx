import type { Metadata } from "next";
import { routes, site } from "@/config/site";
import { PageHero } from "@/components/layout/PageHero";
import { QuoteCta } from "@/components/layout/QuoteCta";
import { ProductCatalog } from "@/components/products/ProductCatalog";
import { getCatalog, getRatingSummaries } from "@/server/catalog";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { products } = await getCatalog();
  return {
    title: "Football Collection",
    description: `Browse ${products.length} original football designs from ${site.name} in 3D. Every design is manufactured to order in your colours, graphics and branding.`,
    alternates: site.url ? { canonical: routes.products } : undefined,
  };
}

export default async function ProductsPage() {
  const [{ products }, ratings] = await Promise.all([getCatalog(), getRatingSummaries()]);
  return (
    <>
      <PageHero title="The football collection" lead={`${products.length} designs, each made to order.`} />
      <section className="bg-paper py-12 lg:py-16">
        <div className="shell">
          <ProductCatalog products={products} ratings={ratings} />
        </div>
      </section>
      <QuoteCta title="Have your own design?" text="Send us your artwork." poster="/images/footballs/gold-32-panel.webp" />
    </>
  );
}
