import type { Review } from "@/types/review";

/**
 * Genuine customer reviews only. This list is intentionally empty until real
 * reviews are supplied; the site shows an honest empty state and no ratings
 * or counts until then.
 */
export const reviews: Review[] = [];

export function reviewsForProduct(slug: string): Review[] {
  return reviews.filter((review) => review.productSlug === slug);
}

/** Returns null when there are no reviews, so no rating is ever shown without data. */
export function averageRating(list: Review[]): number | null {
  if (list.length === 0) return null;
  return list.reduce((sum, review) => sum + review.rating, 0) / list.length;
}
