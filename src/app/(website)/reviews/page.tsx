import type { Metadata } from "next";
import Link from "next/link";
import { routes, site } from "@/config/site";
import { PageHero } from "@/components/layout/PageHero";
import { QuoteCta } from "@/components/layout/QuoteCta";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { ReviewList } from "@/components/reviews/ReviewList";
import { StarRating } from "@/components/reviews/StarRating";
import { getApprovedReviews } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Customer Reviews",
  description: `Reviews from customers of ${site.name}. We publish only genuine feedback, with the customer's name and country.`,
  alternates: site.url ? { canonical: routes.reviews } : undefined,
};

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { reviews, count, average, pageSize } = await getApprovedReviews({ page, pageSize: 9 });
  const pages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <>
      <PageHero title="Customer reviews" lead="Feedback from the brands, clubs and distributors we manufacture for. Every review here is from a real customer, shown with their name and country.">
        {/* A rating summary appears only when approved reviews exist. */}
        {average !== null && (
          <p className="flex items-center gap-3 text-lg">
            <StarRating value={average} />
            <span className="font-bold">{average.toFixed(1)} out of 5</span>
            <span className="text-white/60">from {count} {count === 1 ? "review" : "reviews"}</span>
          </p>
        )}
      </PageHero>

      <section className="section bg-paper">
        <div className="shell">
          <ReviewList reviews={reviews} />
          {pages > 1 && (
            <nav aria-label="Review pages" className="mt-8 flex items-center justify-between text-sm">
              <p className="text-slate">Page {page} of {pages}</p>
              <div className="flex gap-2">
                {page > 1 && <Link href={`${routes.reviews}?page=${page - 1}`} className="inline-flex min-h-11 items-center rounded-xs border border-line px-4 font-semibold hover:border-navy">Previous</Link>}
                {page < pages && <Link href={`${routes.reviews}?page=${page + 1}`} className="inline-flex min-h-11 items-center rounded-xs border border-line px-4 font-semibold hover:border-navy">Next</Link>}
              </div>
            </nav>
          )}
        </div>
      </section>

      <section className="section bg-white">
        <div className="shell max-w-3xl">
          <h2 className="type-h2 mb-8 text-navy-deep">Ordered from us?</h2>
          <ReviewForm />
        </div>
      </section>

      <QuoteCta />
    </>
  );
}
