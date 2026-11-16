import type { Metadata } from "next";
import Image from "next/image";
import { routes, site } from "@/config/site";
import { getCatalog } from "@/server/catalog";
import { ButtonLink } from "@/components/buttons/Button";
import { PageHero } from "@/components/layout/PageHero";
import { QuoteCta } from "@/components/layout/QuoteCta";

export const metadata: Metadata = {
  title: "About Us",
  description: `${site.name} is a football manufacturer and exporter in Pakistan, producing customized match, training and futsal footballs for brands, clubs and distributors worldwide.`,
  alternates: site.url ? { canonical: routes.about } : undefined,
};

const sections = [
  {
    title: "Manufacturing philosophy",
    text: "A football carries someone's name: a club, a brand, a tournament. We treat it that way. The customer's specification is the product, and our job is to manufacture it faithfully.",
  },
  {
    title: "Custom production",
    text: "Logos, colours, graphics, panel design, surface material and construction are all set per order. We make match, training and futsal footballs, and we manufacture under private label.",
  },
  {
    title: "Quality commitment",
    text: "Materials are chosen against the agreed specification, seams and print get close attention, and footballs are inspected before they are packed.",
  },
  {
    title: "International customers",
    text: "We are set up to work with customers at a distance: clear communication in English over WhatsApp and email, directly with the manufacturer.",
  },
  {
    title: "Global export",
    text: "We manufacture in Pakistan and export bulk orders to customers in other countries.",
  },
];

export const revalidate = 300;

export default async function AboutPage() {
  const { products } = await getCatalog();
  return (
    <>
      <PageHero
        title="A football manufacturer, working to your specification"
        lead={`${site.name} manufactures customized footballs in Pakistan for customers around the world.`}
      />

      <section className="section bg-white">
        <div className="shell grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-6">
            <h2 className="type-h2 text-navy-deep">Company overview</h2>
            <div className="type-lead mt-7 grid max-w-[58ch] gap-5 text-slate">
              <p>
                {site.name} is a sports goods manufacturer and exporter. Footballs are our product, and we make them
                one way: to order.
              </p>
              <p>
                We do not hold ready-made stock or run a retail shop. A customer tells us what they need, we agree the
                specification and artwork, and we manufacture that football for them.
              </p>
              <p>
                The {products.length} designs in our collection show the range of panel layouts and graphics we have
                developed. Each is a starting point for a customer's own football.
              </p>
            </div>
            <ButtonLink href={routes.products} variant="outline-dark" className="mt-9">
              Explore Our Footballs
            </ButtonLink>
          </div>
          <figure className="lg:col-span-6">
            <div className="relative aspect-[4/3] overflow-hidden rounded-sm">
              <Image
                src="/images/manufacturing/sss-factory.jpeg"
                alt="The SUPER SMART SPORTS building with the company logo above the entrance"
                fill
                priority
                sizes="(min-width: 1024px) 48vw, 100vw"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-3 text-sm text-slate">{site.name}, sports goods manufacturing and exports.</figcaption>
          </figure>
        </div>
      </section>

      <section className="section bg-paper">
        <div className="shell">
          <h2 className="type-h2 max-w-4xl text-navy-deep">How we work</h2>
          <dl className="mt-12 border-t border-navy/20">
            {sections.map(({ title, text }) => (
              <div key={title} className="grid gap-3 border-b border-navy/20 py-8 lg:grid-cols-12 lg:gap-8">
                <dt className="type-h3 text-navy lg:col-span-4">{title}</dt>
                <dd className="type-lead max-w-[60ch] text-slate lg:col-span-8">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <QuoteCta poster="/images/footballs/new-design-14-panel.webp" />
    </>
  );
}
