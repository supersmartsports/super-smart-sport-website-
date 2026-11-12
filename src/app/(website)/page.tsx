import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { routes, site } from "@/config/site";
import { capabilities, constructionTypes, processSteps, qualityPoints } from "@/constants/content";
import { featuredProducts, getProduct, heroProduct, products } from "@/data/products";
import { reviews } from "@/data/reviews";
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

export default function HomePage() {
  return (
    <>
      <HomeHero product={heroProduct} />

      {/* Company introduction */}
      <section className="section bg-paper">
        <div className="shell grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <h2 className="type-h2 text-navy-deep">We do not sell footballs off a shelf. We manufacture yours.</h2>
            <div className="type-lead mt-7 grid max-w-[60ch] gap-5 text-slate">
              <p>
                {site.name} is a football manufacturer. Brands, clubs, academies and distributors send us their
                requirements, and we produce footballs to that specification: their logo, their colours, their choice of
                panel design, material and construction.
              </p>
              <p>
                Nothing here is ready-made stock. The footballs on this site are designs we have developed, shown so you
                can see what is possible before you brief us on your own.
              </p>
            </div>
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
              <figcaption className="mt-3 text-sm text-slate">{site.name}, sports goods manufacturing and exports.</figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* Featured collection with interactive 3D cards */}
      <section className="section bg-white">
        <div className="shell">
          <SectionHeading
            title="Footballs from our collection"
            lead={`${products.length} original designs, each one a starting point. Hover or tap a football to turn it in 3D, then ask for it in your own colours and branding.`}
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
            title="Construction built around the panel"
            lead="The panel configuration shapes how a football looks and how your artwork sits on it. These are the three we have modelled; tell us if you need another."
          />
          <ul className="mt-14 grid gap-px overflow-hidden rounded-sm bg-white/15 md:grid-cols-3">
            {constructionTypes.map(({ slug, panels, text }) => {
              const product = getProduct(slug)!;
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
            <h2 className="type-h2">Materials and surface, specified by you</h2>
            <p className="type-lead mt-6 max-w-[54ch] text-white/75">
              The surface is what a player feels first. Every football in our collection is modelled with a PU surface
              and a textured finish, and each order is specified individually.
            </p>
            <dl className="mt-9 border-t border-white/20">
              {[
                ["Surface material", "PU on every football shown. Tell us if your specification calls for another material."],
                ["Surface texture", "The finish of the outer surface, chosen to suit the type of football."],
                ["Print", "Your graphics are printed on the panels and checked against your artwork."],
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
            title="Six decisions that make it your football"
            lead="Everything about the football is open to your specification."
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
              <p className="type-lead mt-6 text-slate">Eight stages take your specification from an idea to a packed order.</p>
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
            lead="Quality is decided at the factory. These are the things we look at on every order."
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
            <p className="type-lead mt-6 max-w-[54ch] text-slate">
              We work with buyers outside Pakistan as a matter of course. You deal directly with the manufacturer, in
              English, over WhatsApp or email.
            </p>
          </div>
          <ul className="border-t border-line">
            {[
              ["Private label", "Footballs produced under your brand, with your logo and packaging requirements."],
              ["Bulk orders", "Production planned around the quantity you need."],
              ["Direct communication", "One conversation with the people who make your footballs."],
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
          <ReviewList reviews={reviews.slice(0, 3)} />
        </div>
      </section>

      <QuoteCta />
    </>
  );
}
