import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa6";
import { routes, site } from "@/config/site";
import { capabilities } from "@/constants/content";
import { footballTypes } from "@/data/categories";
import { getProduct, products } from "@/data/products";
import { averageRating, reviewsForProduct } from "@/data/reviews";
import { FootballViewer } from "@/components/3d-viewer/FootballViewer";
import { ButtonAnchor, ButtonLink } from "@/components/buttons/Button";
import { QuoteCta } from "@/components/layout/QuoteCta";
import { ProductCard } from "@/components/product-cards/ProductCard";
import { ReviewList } from "@/components/reviews/ReviewList";
import { StarRating } from "@/components/reviews/StarRating";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return products.map(({ slug }) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const product = getProduct((await params).slug);
  if (!product) return {};
  const description = `${product.name}: a ${product.panelCount}-panel football design from ${site.name}, manufactured to order with your logo, colours and specification. View it in 3D and request a quote.`;
  return {
    title: `${product.name} Football`,
    description,
    alternates: site.url ? { canonical: routes.product(product.slug) } : undefined,
    openGraph: { title: `${product.name} | ${site.name}`, description, images: [{ url: product.poster, width: 900, height: 900 }] },
  };
}

const perOrder = "Specified per order";

export default async function ProductPage({ params }: Params) {
  const product = getProduct((await params).slug);
  if (!product) notFound();

  const productReviews = reviewsForProduct(product.slug);
  const rating = averageRating(productReviews);
  const quoteHref = `${routes.quote}?design=${product.slug}`;
  const related = products.filter((p) => p.slug !== product.slug && p.family === product.family).slice(0, 3);
  const others = related.length === 3 ? related : products.filter((p) => p.slug !== product.slug).slice(0, 3);

  const specifications: [string, string][] = [
    ["Design reference", product.sku],
    ["Panel design", `${product.panelCount} panels`],
    ["Construction", product.construction ?? perOrder],
    ["Surface material", product.material ? `${product.material} (as modelled)` : perOrder],
    ["Surface finish", "Textured (as modelled)"],
    ["Size shown", `Size 5, ${product.modelDiameterCm} cm diameter`],
    ["Available as", footballTypes.join(", ")],
    ["Colours", "Yours. Matched to your brand"],
    ["Logo and graphics", "Yours. Printed to your artwork"],
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${product.name} Football`,
    sku: product.sku,
    description: product.description,
    category: "Custom manufactured football",
    brand: { "@type": "Brand", name: site.name },
    manufacturer: { "@type": "Organization", name: site.name },
    ...(site.url ? { image: `${site.url}${product.poster}`, url: `${site.url}${routes.product(product.slug)}` } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="relative overflow-hidden bg-navy-deep text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 aspect-square w-[140vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,var(--color-navy)_0%,transparent_100%)] lg:left-[30%] lg:w-[70vw]"
        />
        <div className="shell relative pt-24 pb-14 lg:pt-32 lg:pb-20">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-white/60">
              <li>
                <Link href={routes.products} className="hover:text-white">
                  Footballs
                </Link>
              </li>
              <li aria-hidden>
                <ChevronRight className="size-4" />
              </li>
              <li aria-current="page" className="text-white">
                {product.name}
              </li>
            </ol>
          </nav>

          <div className="mt-4 grid items-center gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-7">
              <FootballViewer
                modelUrl={product.model}
                poster={product.poster}
                name={product.name}
                eager
                posterPriority
                posterSizes="(min-width: 1024px) 56vw, 100vw"
                className="mx-auto max-w-[min(100%,78svh)]"
              />
              <p className="mt-1 text-center text-sm text-white/50">
                Drag to rotate through 360°. Arrow keys work too.
              </p>
            </div>

            <div className="lg:col-span-5">
              <p className="type-label text-white/60">
                {product.panelCount} panel
                <span className="mx-2 text-white/30">/</span>
                {product.sku}
              </p>
              <h1 className="type-h1 mt-3">{product.name}</h1>
              {rating !== null && (
                <p className="mt-4 flex items-center gap-2 text-white/75">
                  <StarRating value={rating} />
                  {rating.toFixed(1)} from {productReviews.length} {productReviews.length === 1 ? "review" : "reviews"}
                </p>
              )}
              <p className="type-lead mt-5 max-w-[46ch] text-white/80">{product.description}</p>
              <p className="mt-6 flex items-center gap-2.5 font-semibold">
                <span aria-hidden className="size-2 rounded-full bg-red" />
                Custom manufactured to order. Not sold from stock.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <ButtonLink href={quoteHref} size="lg">
                  Request a Quote
                </ButtonLink>
                <ButtonAnchor
                  href={`${site.contact.whatsappUrl}?text=${encodeURIComponent(`Hello, I would like to discuss the ${product.name} football (${product.sku}).`)}`}
                  variant="outline-light"
                  size="lg"
                >
                  <FaWhatsapp aria-hidden className="size-5" />
                  Discuss on WhatsApp
                </ButtonAnchor>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Specifications */}
      <section className="section bg-white">
        <div className="shell grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="type-h2 text-navy-deep">Specifications</h2>
            <p className="mt-5 max-w-[42ch] text-slate">
              What is fixed by this design, and what you decide. Anything marked “{perOrder.toLowerCase()}” is agreed with
              you in the quote.
            </p>
          </div>
          <dl className="border-t border-navy/20 lg:col-span-8">
            {specifications.map(([term, detail]) => (
              <div key={term} className="grid gap-1 border-b border-line py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
                <dt className="type-label pt-1 text-slate">{term}</dt>
                <dd className="font-semibold text-navy-deep">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Construction, material and manufacturing */}
      <section className="section bg-paper">
        <div className="shell">
          <div className="grid gap-10 lg:grid-cols-3">
            <article>
              <h2 className="type-h3 text-navy">Construction and panel design</h2>
              <p className="mt-4 text-slate">
                The {product.name} uses a {product.panelCount}-panel layout.{" "}
                {product.construction
                  ? `The original design is ${product.construction.toLowerCase()}: its panels are joined with heat instead of thread, leaving a seamless surface.`
                  : "The construction method, stitched or thermo-bonded, is specified with you to suit how the football will be used."}
              </p>
            </article>
            <article>
              <h2 className="type-h3 text-navy">Material and surface finish</h2>
              <p className="mt-4 text-slate">
                The design is modelled with a {product.material ?? "PU"} surface and a textured finish, which you can see
                when you turn the 3D model in the light. If your specification calls for a different material, tell us
                in your quote request.
              </p>
            </article>
            <article>
              <h2 className="type-h3 text-navy">Manufacturing</h2>
              <p className="mt-4 text-slate">
                Each order is produced for one customer: materials are selected, panels are cut and printed with your
                artwork, then assembled and inspected before packing.
              </p>
              <Link
                href={routes.manufacturing}
                className="mt-4 inline-block font-semibold text-navy underline decoration-red decoration-2 underline-offset-[6px] hover:text-red"
              >
                How we manufacture
              </Link>
            </article>
          </div>
        </div>
      </section>

      {/* Custom logo and colour options */}
      <section className="section bg-navy-deep text-white">
        <div className="shell grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <h2 className="type-h2">Make this design yours</h2>
            <p className="type-lead mt-6 max-w-[50ch] text-white/75">
              The artwork on this football is ours. On your order it is replaced with yours.
            </p>
            <ul className="mt-8 border-t border-white/20">
              {capabilities.slice(0, 4).map(({ title, text }) => (
                <li key={title} className="grid gap-1 border-b border-white/20 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                  <h3 className="font-bold">{title}</h3>
                  <p className="text-white/70">{text}</p>
                </li>
              ))}
            </ul>
            <ButtonLink href={`${routes.customization}?design=${product.slug}`} variant="light" size="lg" className="mt-9">
              Customize Your Football
            </ButtonLink>
          </div>
          <div className="mx-auto w-full max-w-lg rounded-sm bg-navy">
            <FootballViewer modelUrl={product.model} poster={product.poster} name={product.name} posterSizes="(min-width: 1024px) 32rem, 100vw" />
          </div>
        </div>
      </section>

      {/* Product images */}
      {product.images.length > 0 && (
        <section className="section bg-white">
          <div className="shell">
            <h2 className="type-h2 text-navy-deep">Product images</h2>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {product.images.map((src) => (
                <li key={src} className="relative aspect-square overflow-hidden rounded-sm bg-paper">
                  <Image src={src} alt={`${product.name} football`} fill sizes="(min-width: 1024px) 33vw, 50vw" className="object-cover" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Reviews */}
      <section className="section bg-paper">
        <div className="shell">
          <h2 className="type-h2 mb-10 text-navy-deep">Customer reviews</h2>
          <ReviewList
            reviews={productReviews}
            emptyContext={`No customer reviews have been published for the ${product.name} yet. We only publish reviews from real customers.`}
          />
        </div>
      </section>

      {/* More designs */}
      <section className="section bg-white">
        <div className="shell">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="type-h2 text-navy-deep">More designs</h2>
            <ButtonLink href={routes.products} variant="outline-dark">
              View all footballs
            </ButtonLink>
          </div>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {others.map((item) => (
              <li key={item.slug}>
                <ProductCard product={item} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <QuoteCta title={`Request a quote for the ${product.name}`} poster={product.poster} />
    </>
  );
}
