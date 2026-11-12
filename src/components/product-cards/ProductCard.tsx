"use client";

import Link from "next/link";
import { Rotate3d } from "lucide-react";
import { routes } from "@/config/site";
import type { Product } from "@/types/product";
import { FootballViewer } from "@/components/3d-viewer/FootballViewer";
import { ButtonLink } from "@/components/buttons/Button";
import { StarRating } from "@/components/reviews/StarRating";

type Props = {
  product: Product;
  /** Real review data only. Omitted when there are no reviews. */
  rating?: { average: number; count: number } | null;
  headingLevel?: "h2" | "h3";
  posterPriority?: boolean;
};

export function ProductCard({ product, rating, headingLevel: Heading = "h3", posterPriority }: Props) {
  return (
    <article className="group/card flex h-full flex-col rounded-sm bg-white ring-1 ring-line transition-shadow duration-300 hover:shadow-raised hover:ring-navy/25">
      <div className="relative overflow-hidden rounded-t-sm bg-paper">
        <FootballViewer
          modelUrl={product.model}
          poster={product.poster}
          name={product.name}
          shadow="soft"
          tone="light"
          posterSizes="(min-width: 1280px) 30vw, (min-width: 640px) 46vw, 92vw"
          posterPriority={posterPriority}
          className="transition-transform duration-500 ease-out group-hover/card:scale-[1.03]"
        />
        <p className="type-label absolute top-4 left-4 text-slate">{product.panelCount} panel</p>
        <p className="pointer-events-none absolute right-3 bottom-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate">
          <Rotate3d aria-hidden className="size-4" />
          Drag to rotate
        </p>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <Heading className="type-h3 text-navy-deep">
          <Link href={routes.product(product.slug)} className="outline-offset-4 hover:text-navy">
            {product.name}
          </Link>
        </Heading>

        {rating && (
          <p className="mt-2 flex items-center gap-2 text-sm text-slate">
            <StarRating value={rating.average} />
            {rating.average.toFixed(1)} from {rating.count} {rating.count === 1 ? "review" : "reviews"}
          </p>
        )}

        <p className="mt-3 text-[0.9375rem] leading-relaxed text-slate">{product.description}</p>

        <dl className="mt-5 grid grid-cols-2 border-t border-line text-sm">
          <div className="border-b border-line py-3 pr-3">
            <dt className="type-label text-slate">Construction</dt>
            <dd className="mt-0.5 font-semibold text-navy-deep">{product.construction ?? "To your specification"}</dd>
          </div>
          <div className="border-b border-l border-line py-3 pl-4">
            <dt className="type-label text-slate">Material shown</dt>
            <dd className="mt-0.5 font-semibold text-navy-deep">{product.material ?? "To your specification"}</dd>
          </div>
        </dl>

        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-navy">
          <span aria-hidden className="size-1.5 rounded-full bg-red" />
          Custom manufactured to order
        </p>

        <div className="mt-auto grid gap-2 pt-6 min-[420px]:grid-cols-2">
          <ButtonLink href={routes.product(product.slug)} variant="outline-dark" aria-label={`View details: ${product.name}`}>
            View details
          </ButtonLink>
          <ButtonLink
            href={`${routes.quote}?design=${product.slug}`}
            aria-label={`Request a quote: ${product.name}`}
          >
            Request a quote
          </ButtonLink>
        </div>
      </div>
    </article>
  );
}
