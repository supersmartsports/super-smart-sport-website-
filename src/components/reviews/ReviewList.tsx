import Link from "next/link";
import { MessageSquareQuote } from "lucide-react";
import { routes, site } from "@/config/site";
import { getProduct } from "@/data/products";
import type { Review } from "@/types/review";
import { ButtonAnchor } from "@/components/buttons/Button";
import { StarRating } from "./StarRating";

export function ReviewCard({ review }: { review: Review }) {
  const product = review.productSlug ? getProduct(review.productSlug) : undefined;
  return (
    <figure className="flex h-full flex-col rounded-sm bg-white p-6 ring-1 ring-line sm:p-8">
      <StarRating value={review.rating} />
      <blockquote className="mt-5 flex-1 text-lg leading-relaxed text-navy-deep">{review.text}</blockquote>
      <figcaption className="mt-6 border-t border-line pt-4 text-sm">
        <span className="block font-bold text-navy-deep">{review.customerName}</span>
        <span className="text-slate">{review.country}</span>
        {product && (
          <Link href={routes.product(product.slug)} className="mt-2 block font-semibold text-navy underline-offset-4 hover:underline">
            Football: {product.name}
          </Link>
        )}
      </figcaption>
    </figure>
  );
}

/** Shown wherever reviews would appear while there are none. States the fact and invites the next step. */
export function ReviewsEmptyState({ tone = "light", context }: { tone?: "light" | "dark"; context?: string }) {
  const onDark = tone === "dark";
  return (
    <div
      className={`grid gap-8 rounded-sm p-8 sm:p-12 lg:grid-cols-[auto_1fr_auto] lg:items-center ${
        onDark ? "bg-white/5 ring-1 ring-white/15" : "bg-white ring-1 ring-line"
      }`}
    >
      <MessageSquareQuote aria-hidden strokeWidth={1.25} className={`size-14 ${onDark ? "text-white/40" : "text-navy/35"}`} />
      <div>
        <h3 className={`type-h3 ${onDark ? "text-white" : "text-navy-deep"}`}>No reviews yet</h3>
        <p className={`mt-3 max-w-[60ch] ${onDark ? "text-white/70" : "text-slate"}`}>
          {context ?? "We publish only real customer reviews."} Ordered from {site.name}? Send us your feedback.
        </p>
      </div>
      <ButtonAnchor href={site.contact.whatsappUrl} variant={onDark ? "outline-light" : "outline-dark"}>
        Share your feedback
      </ButtonAnchor>
    </div>
  );
}

export function ReviewList({ reviews, tone, emptyContext }: { reviews: Review[]; tone?: "light" | "dark"; emptyContext?: string }) {
  if (reviews.length === 0) return <ReviewsEmptyState tone={tone} context={emptyContext} />;
  return (
    <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {reviews.map((review) => (
        <li key={review.id}>
          <ReviewCard review={review} />
        </li>
      ))}
    </ul>
  );
}
