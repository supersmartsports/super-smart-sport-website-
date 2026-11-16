import { Suspense } from "react";
import type { Metadata } from "next";
import { routes, site } from "@/config/site";
import { capabilities } from "@/constants/content";
import { DesignStudio } from "@/components/customization/DesignStudio";
import { getCatalog } from "@/server/catalog";
import { QuoteCta } from "@/components/layout/QuoteCta";

export const metadata: Metadata = {
  title: "Customize Your Football",
  description: `Build a brief for your custom football: choose a design, preview your colours in 3D, and select material, construction and branding. Manufactured to order by ${site.name}.`,
  alternates: site.url ? { canonical: routes.customization } : undefined,
};

export const revalidate = 300;

export default async function CustomizationPage() {
  const { products } = await getCatalog();
  return (
    <>
      <section className="bg-navy-deep text-white">
        <div className="shell pt-32 pb-16 lg:pt-40 lg:pb-24">
          <h1 className="type-h1 max-w-5xl">Customize your football</h1>
          <p className="type-lead mt-6 mb-12 max-w-[60ch] text-white/75 lg:mb-16">
            Pick a design, try your colours on it and tell us how it should be made. What you build here becomes the
            brief for your quote.
          </p>
          <Suspense fallback={<div className="min-h-[60svh]" />}>
            <DesignStudio products={products} />
          </Suspense>
        </div>
      </section>

      <section className="section bg-paper">
        <div className="shell">
          <h2 className="type-h2 max-w-4xl text-navy-deep">What you can specify</h2>
          <ul className="mt-12 grid gap-x-10 border-t border-navy/20 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(({ title, text }) => (
              <li key={title} className="border-b border-navy/20 py-7">
                <h3 className="type-h3 text-navy">{title}</h3>
                <p className="mt-2.5 max-w-[40ch] text-slate">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <QuoteCta
        title="Already have artwork?"
        text="Skip the studio. Send us your design files and requirements and we will prepare a quote from those."
        poster="/images/footballs/red-grey-design.webp"
      />
    </>
  );
}
