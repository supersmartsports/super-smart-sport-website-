import type { Metadata } from "next";
import { routes, site } from "@/config/site";
import { qualityPoints } from "@/constants/content";
import { LiveFootball } from "@/components/3d-viewer/LiveFootball";
import { ButtonLink } from "@/components/buttons/Button";
import { PageHero } from "@/components/layout/PageHero";
import { QuoteCta } from "@/components/layout/QuoteCta";

export const metadata: Metadata = {
  title: "Quality",
  description: `How ${site.name} approaches quality in custom football manufacturing: materials, construction, surface finishing, inspection, consistency and precision.`,
  alternates: site.url ? { canonical: routes.quality } : undefined,
};

export default function QualityPage() {
  return (
    <>
      <PageHero
        title="Quality you can check for yourself"
        lead="We would rather show you than tell you. Here is what we pay attention to on every order, and how you can verify it before you commit."
      />

      <section className="section bg-white">
        <div className="shell grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <div className="rounded-sm bg-paper">
                <LiveFootball slug="color-change-32-panel" tone="light" posterPriority posterSizes="(min-width: 1024px) 40vw, 100vw" />
              </div>
              <p className="mt-3 text-sm text-slate">One of our 32-panel designs. Drag it to inspect the seams, surface texture and print.</p>
            </div>
          </div>
          <ul className="border-t border-navy/20 lg:col-span-6 lg:col-start-7">
            {qualityPoints.map(({ title, text }) => (
              <li key={title} className="border-b border-line py-8">
                <h2 className="type-h3 text-navy">{title}</h2>
                <p className="type-lead mt-3 max-w-[52ch] text-slate">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section bg-navy-deep text-white">
        <div className="shell grid gap-10 lg:grid-cols-2 lg:gap-20">
          <h2 className="type-h2">Ask us for evidence</h2>
          <div>
            <p className="type-lead max-w-[54ch] text-white/75">
              If your order has to meet a particular standard or test requirement, tell us in your quote request. We
              will tell you plainly what we can document for it. We do not list certifications on this site that we
              cannot show you.
            </p>
            <ButtonLink href={routes.quote} variant="light" size="lg" className="mt-9">
              Discuss Your Requirements
            </ButtonLink>
          </div>
        </div>
      </section>

      <QuoteCta poster="/images/footballs/size-5-32-panel.webp" />
    </>
  );
}
