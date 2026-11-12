import type { Metadata } from "next";
import Image from "next/image";
import { routes, site } from "@/config/site";
import { processSteps } from "@/constants/content";
import { LiveFootball } from "@/components/3d-viewer/LiveFootball";
import { ButtonLink } from "@/components/buttons/Button";
import { PageHero } from "@/components/layout/PageHero";
import { QuoteCta } from "@/components/layout/QuoteCta";

export const metadata: Metadata = {
  title: "Manufacturing Process",
  description: `How ${site.name} manufactures custom footballs: engineering, material selection, panel preparation, printing, stitching or thermal bonding, inspection and finishing.`,
  alternates: site.url ? { canonical: routes.manufacturing } : undefined,
};

// The company's own footballs, in live 3D, illustrate the stages they relate to.
const stageVisuals: Record<number, string> = {
  0: "32p-series-01",
  3: "32-panel-v8",
  5: "20-panel",
  7: "sss-14-panel",
};

export default function ManufacturingPage() {
  return (
    <>
      <PageHero
        title="How your football is manufactured"
        lead="Eight stages take an order from your brief to a finished, packed football. Stitching and thermal bonding are alternatives: your construction decides which one applies."
      />

      <section className="bg-white">
        <div className="shell">
          <ol>
            {processSteps.map(({ title, text }, index) => {
              const visual = stageVisuals[index];
              return (
                <li
                  key={title}
                  className="grid items-center gap-8 border-b border-line py-12 last:border-b-0 lg:grid-cols-12 lg:py-20"
                >
                  <div className="lg:col-span-2">
                    <span aria-hidden className="type-h1 text-red tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className={visual ? "lg:col-span-5" : "lg:col-span-8"}>
                    <h2 className="type-h2 text-navy-deep">{title}</h2>
                    <p className="type-lead mt-5 max-w-[56ch] text-slate">{text}</p>
                  </div>
                  {visual && (
                    <div className="mx-auto w-full max-w-sm rounded-sm bg-paper lg:col-span-4 lg:col-start-9">
                      <LiveFootball slug={visual} tone="light" posterSizes="(min-width: 1024px) 24rem, 90vw" />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="section bg-navy-deep text-white">
        <div className="shell grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <figure>
            <div className="relative aspect-[4/3] overflow-hidden rounded-sm">
              <Image
                src="/images/manufacturing/sss-factory.jpeg"
                alt="The SUPER SMART SPORTS building with the company logo above the entrance"
                fill
                sizes="(min-width: 1024px) 48vw, 100vw"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-3 text-sm text-white/55">{site.name}, sports goods manufacturing and exports.</figcaption>
          </figure>
          <div>
            <h2 className="type-h2">One order, one specification</h2>
            <p className="type-lead mt-6 max-w-[52ch] text-white/75">
              We do not run footballs for stock and brand them later. Production starts when your specification and
              artwork are agreed, and every stage works to that one brief.
            </p>
            <ButtonLink href={routes.quote} size="lg" className="mt-9">
              Discuss Your Requirements
            </ButtonLink>
          </div>
        </div>
      </section>

      <QuoteCta poster="/images/footballs/hybrid-pro.webp" />
    </>
  );
}
