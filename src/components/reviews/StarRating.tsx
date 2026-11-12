import { Star } from "lucide-react";

/** Read-only star display. Only render this with real review data. */
export function StarRating({ value, className = "" }: { value: number; className?: string }) {
  const rounded = Math.round(value);
  return (
    <span role="img" aria-label={`Rated ${value.toFixed(1)} out of 5`} className={`inline-flex gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          className={`size-4 ${star <= rounded ? "fill-red text-red" : "fill-transparent text-line"}`}
        />
      ))}
    </span>
  );
}
