"use client";

import { useState } from "react";
import { routes } from "@/config/site";
import { panelFamilies } from "@/data/categories";
import type { PanelFamily, Product } from "@/types/product";
import { ButtonLink } from "@/components/buttons/Button";
import { ProductCard } from "@/components/product-cards/ProductCard";

type Filter = "all" | PanelFamily;

export function ProductCatalog({
  products,
  ratings,
}: {
  products: Product[];
  /** Real review summaries keyed by product slug. Empty when there are no reviews. */
  ratings: Record<string, { average: number; count: number }>;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = filter === "all" ? products : products.filter((product) => product.family === filter);

  const options: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All footballs", count: products.length },
    ...panelFamilies.map(({ id, label }) => ({
      id,
      label,
      count: products.filter((product) => product.family === id).length,
    })),
  ];

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Filter footballs by panel configuration" className="-mx-1 flex flex-wrap gap-2 px-1">
          {options.map(({ id, label, count }) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={`min-h-11 rounded-xs px-4 text-sm font-semibold transition-colors ${
                filter === id ? "bg-navy text-white" : "bg-white text-navy ring-1 ring-line hover:ring-navy"
              }`}
            >
              {label} <span className={filter === id ? "text-white/60" : "text-slate"}>{count}</span>
            </button>
          ))}
        </div>
        <p aria-live="polite" className="text-sm text-slate">
          Showing {visible.length} of {products.length}
        </p>
      </div>

      {visible.length > 0 ? (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((product, index) => (
            <li key={product.slug}>
              <ProductCard product={product} rating={ratings[product.slug]} headingLevel="h2" posterPriority={index < 3} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8 rounded-sm bg-white p-10 text-center ring-1 ring-line sm:p-16">
          <h2 className="type-h3 text-navy-deep">No footballs to show here yet</h2>
          <p className="mx-auto mt-3 max-w-[48ch] text-slate">
            We have not added a design in this configuration. We can still manufacture it: tell us what you need.
          </p>
          <ButtonLink href={routes.quote} className="mt-7">
            Request a quote
          </ButtonLink>
        </div>
      )}
    </>
  );
}
