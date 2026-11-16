"use client";

import { useMemo, useState } from "react";
import { routes } from "@/config/site";
import { panelFamilies } from "@/data/categories";
import type { PanelFamily, Product } from "@/types/product";
import { ButtonLink } from "@/components/buttons/Button";
import { ProductCard } from "@/components/product-cards/ProductCard";

type Filter = "all" | PanelFamily;
type Sort = "featured" | "name" | "panels";

const PAGE_SIZE = 12;

/** Search, category filter, sorting and pages over the published catalogue. */
export function ProductCatalog({ products, ratings }: {
  products: Product[];
  /** Real review summaries keyed by product slug. Empty when there are no approved reviews. */
  ratings: Record<string, { average: number; count: number }>;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("featured");
  const [page, setPage] = useState(1);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = products.filter((p) => (filter === "all" || p.family === filter) && (!term || `${p.name} ${p.sku} ${p.description}`.toLowerCase().includes(term)));
    if (sort === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "panels") return [...list].sort((a, b) => a.panelCount - b.panelCount || a.name.localeCompare(b.name));
    return list; // the order set by staff
  }, [products, filter, query, sort]);

  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  const options: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All footballs", count: products.length },
    ...panelFamilies.map(({ id, label }) => ({ id, label, count: products.filter((p) => p.family === id).length })),
  ];

  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div role="group" aria-label="Filter footballs by panel configuration" className="-mx-1 flex flex-wrap gap-2 px-1">
          {options.map(({ id, label, count }) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => reset(setFilter)(id)}
              className={`min-h-11 rounded-xs px-4 text-sm font-semibold transition-colors ${filter === id ? "bg-navy text-white" : "bg-white text-navy ring-1 ring-line hover:ring-navy"}`}>
              {label} <span className={filter === id ? "text-white/60" : "text-slate"}>{count}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="catalog-search" className="sr-only">Search footballs</label>
            <input id="catalog-search" type="search" value={query} onChange={(e) => reset(setQuery)(e.target.value)} placeholder="Search footballs"
              className="min-h-11 w-56 rounded-xs border border-line bg-white px-3 text-base" />
          </div>
          <div>
            <label htmlFor="catalog-sort" className="sr-only">Sort footballs</label>
            <select id="catalog-sort" value={sort} onChange={(e) => reset(setSort)(e.target.value as Sort)} className="min-h-11 rounded-xs border border-line bg-white px-3 text-base">
              <option value="featured">Featured first</option>
              <option value="name">Name A to Z</option>
              <option value="panels">Panels, fewest first</option>
            </select>
          </div>
        </div>
      </div>
      <p aria-live="polite" className="mt-4 text-sm text-slate">Showing {shown.length} of {visible.length}{visible.length !== products.length ? ` (${products.length} in total)` : ""}</p>

      {shown.length > 0 ? (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((product, index) => (
            <li key={product.slug}><ProductCard product={product} rating={ratings[product.slug]} headingLevel="h2" posterPriority={index < 3} /></li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 rounded-sm bg-white p-10 text-center ring-1 ring-line sm:p-16">
          <h2 className="type-h3 text-navy-deep">{products.length === 0 ? "No footballs are published yet" : "No footballs match your search"}</h2>
          <p className="mx-auto mt-3 max-w-[48ch] text-slate">We can still manufacture what you need: tell us about your project.</p>
          <ButtonLink href={routes.quote} className="mt-7">Request a quote</ButtonLink>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-8 flex items-center justify-between text-sm">
          <p className="text-slate">Page {current} of {pages}</p>
          <div className="flex gap-2">
            <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)} className="min-h-11 rounded-xs border border-line bg-white px-4 font-semibold hover:border-navy disabled:opacity-40">Previous</button>
            <button type="button" disabled={current === pages} onClick={() => setPage(current + 1)} className="min-h-11 rounded-xs border border-line bg-white px-4 font-semibold hover:border-navy disabled:opacity-40">Next</button>
          </div>
        </nav>
      )}
    </>
  );
}
