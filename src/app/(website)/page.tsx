import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { routes, site } from "@/config/site";
import { capabilities, constructionTypes, processSteps, qualityPoints } from "@/constants/content";
import { heroProduct as bundledHero } from "@/data/products";
import { getApprovedReviews, getCatalog } from "@/server/catalog";
import { LiveFootball } from "@/components/3d-viewer/LiveFootball";
import { Reveal } from "@/components/animations/Reveal";
import { ButtonLink } from "@/components/buttons/Button";
import { HomeHero } from "@/components/hero/HomeHero";
import { QuoteCta } from "@/components/layout/QuoteCta";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { ProductCard } from "@/components/product-cards/ProductCard";
import { ReviewList } from "@/components/reviews/ReviewList";

export const metadata: Metadata = {
  title: { absolute: `${site.name} | Custom Football Manufacturer and Exporter` },
  description: site.description,
  alternates: site.url ? { canonical: "/" } : undefined,
};

const textLink =
  "font-semibold underline decoration-red decoration-2 underline-offset-[6px] transition-colors hover:text-red";

// Rebuilt at most every five minutes, so published products and approved reviews appear without a redeploy.
export const revalidate = 300;

export default async function HomePage() {
  const { products, featured, hero } = await getCatalog();
  const featuredProducts = featured.length > 0 ? featured : products.slice(0, 6);
  const reviews = (await getApprovedReviews({ pageSize: 3 })).reviews;
  return (
    <>
      <HomeHero product={hero ?? bundledHero} />

      {/* Company introduction */}
      <section className="section bg-paper">
        <div className="shell grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <h2 className="type-h2 text-navy-deep">We do not sell footballs off a shelf. We manufacture yours.</h2>
            <p className="type-lead mt-7 max-w-[44ch] text-slate">
              Your logo, colours, panels, material and construction. Nothing ready-made.
            </p>
            <Link href={routes.about} className={`${textLink} mt-8 inline-block text-navy`}>
              About {site.name}
            </Link>
          </div>
          <Reveal className="lg:col-span-5">
            <figure>
              <div className="relative aspect-[4/3] overflow-hidden rounded-sm">
                <Image
                  src="/images/manufacturing/sss-factory.jpeg"
                  alt="The SUPER SMART SPORTS building with the company logo above the entrance"
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-3 text-sm text-slate">{site.name}</figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* Featured collection with interactive 3D cards */}
      <section className="section bg-white">
        <div className="shell">
          <SectionHeading
            title="Footballs from our collection"
            lead={`${products.length} designs. Drag any football to turn it.`}
            action={
              <ButtonLink href={routes.products} variant="outline-dark">
                View all {products.length} footballs
              </ButtonLink>
            }
          />
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {featuredProducts.map((product) => (
              <li key={product.slug}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Construction showcase */}
      <section className="section bg-navy-deep text-white">
        <div className="shell">
          <SectionHeading
            tone="dark"
            title="Built around the panel"
          />
          <ul className="mt-14 grid gap-px overflow-hidden rounded-sm bg-white/15 md:grid-cols-3">
            {constructionTypes.map(({ slug, panels, text }) => {
              const product = products.find((p) => p.slug === slug);
              if (!product) return null;
              return (
                <li key={slug} className="flex flex-col bg-navy-deep p-6 sm:p-8">
                  <div className="mx-auto w-full max-w-sm">
                    <LiveFootball slug={slug} posterSizes="(min-width: 768px) 30vw, 90vw" />
                  </div>
                  <h3 className="type-h3 mt-8">{panels}</h3>
                  <p className="mt-3 text-white/70">{text}</p>
                  <Link href={routes.product(slug)} className={`${textLink} mt-6 self-start text-white`}>
                    See the {product.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Materials and surface technology */}
      <section className="section overflow-hidden bg-navy text-white">
        <div className="shell grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div className="mx-auto w-full max-w-xl rounded-sm bg-navy-deep">
            <LiveFootball slug="32-panel-4" posterSizes="(min-width: 1024px) 36rem, 100vw" />
          </div>
          <div>
            <h2 className="type-h2">Material and surface</h2>
            <dl className="mt-9 border-t border-white/20">
              {[
                ["Material", "PU, as modelled"],
                ["Finish", "Textured"],
                ["Print", "Your artwork"],
              ].map(([term, detail]) => (
                <div key={term} className="grid gap-1 border-b border-white/20 py-5 sm:grid-cols-[11rem_1fr] sm:gap-6">
                  <dt className="type-label pt-1 text-white/60">{term}</dt>
                  <dd className="text-white/90">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Customization capabilities */}
      <section className="section bg-paper">
        <div className="shell">
          <SectionHeading
            title="Make it yours"
            action={
              <ButtonLink href={routes.customization} variant="dark">
                Customize Your Football
              </ButtonLink>
            }
          />
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

      {/* Manufacturing process */}
      <section className="section bg-white">
        <div className="shell grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-32">
              <h2 className="type-h2 text-navy-deep">From brief to finished football</h2>
                            <ButtonLink href={routes.manufacturing} variant="outline-dark" className="mt-8">
                See how we manufacture
              </ButtonLink>
            </div>
          </div>
          <ol className="lg:col-span-7 lg:col-start-6">
            {processSteps.map(({ title, text }, index) => (
              <li key={title} className="grid grid-cols-[3.25rem_1fr] gap-x-4 border-t border-line py-6 last:border-b sm:grid-cols-[5rem_1fr]">
                <span aria-hidden className="type-h3 text-red tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="type-h3 text-navy-deep">{title}</h3>
                  <p className="mt-2 max-w-[58ch] text-slate">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Quality assurance */}
      <section className="section bg-navy-deep text-white">
        <div className="shell">
          <SectionHeading
            tone="dark"
            title="Checked before it leaves us"
            action={
              <ButtonLink href={routes.quality} variant="outline-light">
                Our approach to quality
              </ButtonLink>
            }
          />
          <ul className="mt-12 grid gap-x-10 border-t border-white/20 sm:grid-cols-2 lg:grid-cols-3">
            {qualityPoints.slice(0, 3).map(({ title, text }) => (
              <li key={title} className="border-b border-white/20 py-7">
                <h3 className="type-h3">{title}</h3>
                <p className="mt-2.5 max-w-[40ch] text-white/70">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Global export */}
      <section className="section bg-white">
        <div className="shell grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <h2 className="type-h2 text-navy-deep">Manufactured in Pakistan, exported to your market</h2>
            <p className="type-lead mt-6 max-w-[40ch] text-slate">Direct from the manufacturer, by WhatsApp or email.</p>
          </div>
          <ul className="border-t border-line">
            {[
              ["Private label", "Under your brand."],
              ["Bulk orders", "Planned around your quantity."],
              ["Direct contact", "Talk to the people who make them."],
            ].map(([title, text]) => (
              <li key={title} className="grid gap-1 border-b border-line py-6 sm:grid-cols-[12rem_1fr] sm:gap-6">
                <h3 className="type-h3 text-navy">{title}</h3>
                <p className="text-slate">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Customer reviews */}
      <section className="section bg-paper">
        <div className="shell">
          <SectionHeading title="What customers say" className="mb-10" />
          <ReviewList reviews={reviews} />
        </div>
      </section>

      <QuoteCta />
    </>
  );
}
