import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa6";
import { routes, site } from "@/config/site";
import { footballTypes } from "@/data/categories";
import { getProduct, products } from "@/data/products";
import { averageRating, reviewsForProduct } from "@/data/reviews";
import { BallJourney, BallSlot } from "@/components/3d-viewer/BallJourney";
import { ButtonAnchor, ButtonLink } from "@/components/buttons/Button";
import { QuoteCta } from "@/components/layout/QuoteCta";
import { ProductCard } from "@/components/product-cards/ProductCard";
import { InsideFootball } from "@/components/products/InsideFootball";
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

const perOrder = "Per order";
const yourWords = ["Your logo", "Your colours", "Your graphics", "Your panel design"];

export default async function ProductPage({ params }: Params) {
  const product = getProduct((await params).slug);
  if (!product) notFound();

  const productReviews = reviewsForProduct(product.slug);
  const rating = averageRating(productReviews);
  const quoteHref = `${routes.quote}?design=${product.slug}`;
  const related = products.filter((p) => p.slug !== product.slug && p.family === product.family).slice(0, 3);
  const others = related.length === 3 ? related : products.filter((p) => p.slug !== product.slug).slice(0, 3);

  const specifications: [string, string][] = [
    ["Reference", product.sku],
    ["Panels", String(product.panelCount)],
    ["Construction", product.construction ?? perOrder],
    ["Material", product.material ?? perOrder],
    ["Size shown", `Size 5, ${product.modelDiameterCm} cm`],
    ["Available as", footballTypes.join(", ")],
    ["Colours, logo, graphics", "Yours"],
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
    <BallJourney product={product}>
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
              {/* Stop 1: the ball starts here and follows the scroll down the page. */}
              <BallSlot order={0} fallback className="mx-auto max-w-[min(100%,78svh)]" />
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
              <p className="mt-6 flex items-center gap-2.5 font-semibold">
                <span aria-hidden className="size-2 rounded-full bg-red" />
                Made to order
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
                  WhatsApp
                </ButtonAnchor>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Specifications: the ball rests large in the centre, the table either side. */}
      <section className="section bg-white">
        <div className="shell">
          <h2 className="type-h2 text-center text-navy-deep">Specifications</h2>
          <div className="mt-10 grid items-center gap-8 lg:mt-14 lg:grid-cols-[1fr_minmax(0,40rem)_1fr] lg:gap-10">
            {/* Stop 2 */}
            <BallSlot order={1} className="mx-auto max-w-[min(100%,40rem)] lg:col-start-2 lg:row-start-1" />
            <dl className="border-t border-navy/20 lg:hidden">
              {specifications.map(([term, detail]) => (
                <div key={term} className="grid gap-1 border-b border-line py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
                  <dt className="type-label pt-1 text-slate">{term}</dt>
                  <dd className="font-semibold text-navy-deep">{detail}</dd>
                </div>
              ))}
            </dl>
            {[specifications.slice(0, 4), specifications.slice(4)].map((rows, column) => (
              <dl
                key={column}
                className={`hidden border-t border-navy/20 lg:block lg:row-start-1 ${column === 0 ? "lg:col-start-1" : "lg:col-start-3"}`}
              >
                {rows.map(([term, detail]) => (
                  <div key={term} className="border-b border-line py-4">
                    <dt className="type-label text-slate">{term}</dt>
                    <dd className="mt-1 font-semibold text-navy-deep">{detail}</dd>
                  </div>
                ))}
              </dl>
            ))}
          </div>
        </div>
      </section>

      {/* Stop 3: the ball opens panel by panel. */}
      <InsideFootball />

      {/* Make it yours */}
      <section className="section bg-navy-deep text-white">
        <div className="shell grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
          <div>
            <h2 className="type-h2">Make it yours</h2>
            <ul className="mt-8 flex flex-wrap gap-2">
              {yourWords.map((word) => (
                <li key={word} className="rounded-xs px-4 py-2.5 text-sm font-semibold ring-1 ring-white/25">
                  {word}
                </li>
              ))}
            </ul>
            <ButtonLink href={`${routes.customization}?design=${product.slug}`} variant="light" size="lg" className="mt-9">
              Customize Your Football
            </ButtonLink>
          </div>
          {/* Stop 4: the closed ball arrives here. */}
          <div className="mx-auto w-full max-w-lg rounded-sm bg-navy">
            <BallSlot order={3} fallback />
          </div>
        </div>
      </section>

      {/* Product images */}
      {product.images.length > 0 && (
        <section className="section bg-white">
          <div className="shell">
            <h2 className="type-h2 text-navy-deep">Images</h2>
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
          <h2 className="type-h2 mb-10 text-navy-deep">Reviews</h2>
          <ReviewList reviews={productReviews} emptyContext="No reviews yet." />
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
    </BallJourney>
  );
}
