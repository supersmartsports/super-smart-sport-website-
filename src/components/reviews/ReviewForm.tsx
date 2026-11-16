"use client";

import { useActionState } from "react";
import { submitReview, type ReviewState } from "@/features/reviews/actions";
import { Button } from "@/components/buttons/Button";

const control = "mt-2 min-h-12 w-full rounded-xs border border-line bg-white px-4 text-base text-navy-deep focus:border-navy focus:outline-2 focus:outline-offset-0 focus:outline-navy";

/** Collects a review for staff to approve. Shows success only after the database has saved it. */
export function ReviewForm({ productSlug }: { productSlug?: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReview, { status: "idle" });
  if (state.status === "sent") {
    return <p role="status" className="rounded-sm bg-white p-6 font-semibold text-navy-deep ring-1 ring-line">{state.message}</p>;
  }
  return (
    <form action={action} className="grid gap-5 rounded-sm bg-white p-6 ring-1 ring-line sm:grid-cols-2 sm:p-8">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] size-px opacity-0" />
      {productSlug && <input type="hidden" name="productSlug" value={productSlug} />}
      <div><label htmlFor="rv-name" className="type-label">Your name</label><input id="rv-name" name="name" required maxLength={120} className={control} /></div>
      <div><label htmlFor="rv-country" className="type-label">Country (optional)</label><input id="rv-country" name="country" maxLength={100} className={control} /></div>
      <div>
        <label htmlFor="rv-rating" className="type-label">Rating</label>
        <select id="rv-rating" name="rating" required defaultValue="" className={control}>
          <option value="" disabled>Choose...</option>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} of 5</option>)}
        </select>
      </div>
      <div className="sm:col-span-2"><label htmlFor="rv-body" className="type-label">Your review</label><textarea id="rv-body" name="body" required minLength={10} maxLength={2000} rows={4} className={`${control} py-3`} /></div>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Sending" : "Send review"}</Button>
        <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className="text-sm font-semibold text-red-deep">{state.status === "error" || state.status === "unavailable" ? state.message : ""}</p>
        <p className="basis-full text-sm text-slate">Reviews appear on the website after we have checked them.</p>
      </div>
    </form>
  );
}
