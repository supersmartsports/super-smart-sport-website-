/** A genuine customer review. Only add entries that a real customer has given permission to publish. */
export type Review = {
  id: string;
  customerName: string;
  country: string;
  /** 1 to 5 */
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  /** Slug of the football design the order was based on, if any. */
  productSlug?: string;
  /** ISO date, e.g. "2026-03-14" */
  date?: string;
};
