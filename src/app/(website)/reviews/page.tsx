import type { Metadata } from "next";
import { routes, site } from "@/config/site";
import { averageRating, reviews } from "@/data/reviews";
import { PageHero } from "@/components/layout/PageHero";
import { QuoteCta } from "@/components/layout/QuoteCta";
import { ReviewList } from "@/components/reviews/ReviewList";
import { StarRating } from "@/components/reviews/StarRating";

export const metadata: Metadata = {
  title: "Customer Reviews",
  description: `Reviews from customers of ${site.name}. We publish only genuine feedback, with the customer's name and country.`,
  alternates: site.url ? { canonical: routes.reviews } : undefined,
};

export default function ReviewsPage() {
  const average = averageRating(reviews);

  return (
    <>
      <PageHero
        title="Customer reviews"
        lead="Feedback from the brands, clubs and distributors we manufacture for. Every review here is from a real customer, shown with their name and country."
      >
        {/* A rating summary appears only when real reviews exist. */}
        {average !== null && (
          <p className="flex items-center gap-3 text-lg">
            <StarRating value={average} />
            <span className="font-bold">{average.toFixed(1)} out of 5</span>
            <span className="text-white/60">
              from {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
            </span>
          </p>
        )}
      </PageHero>

      <section className="section bg-paper">
        <div className="shell">
          <ReviewList reviews={reviews} />
        </div>
      </section>

      <QuoteCta />
    </>
  );
}
