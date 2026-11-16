import "server-only";
import { createClient } from "@supabase/supabase-js";
import { products as bundledProducts } from "@/data/products";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/database/env";
import type { PanelFamily, Product } from "@/types/product";
import type { Review } from "@/types/review";

/**
 * The public website's data source.
 *
 * Connected to a database, the site shows only what staff have published (the `public_products` and
 * `public_reviews` views; unpublished products and unapproved reviews are not reachable by the public
 * key at all). Before a database is connected it falls back to the catalogue bundled with the site, so
 * the website keeps working. Once connected, an empty catalogue shows as empty: nothing is substituted.
 */
const anonymous = () => createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });

export const familyFor = (panels: number | null): PanelFamily => (panels === 14 ? "14-panel" : panels === 20 ? "20-panel" : "32-panel");

type ProductRow = {
  id: string; slug: string; sku: string; name: string; panel_count: number | null; construction: string | null; material: string | null;
  description: string | null; model_path: string | null; poster_path: string | null; images: unknown; featured: boolean; sort_order: number;
};

function toProduct(row: ProductRow): Product {
  const panels = row.panel_count ?? 32;
  return {
    slug: row.slug,
    sku: row.sku,
    name: row.name,
    sourceModel: "",
    model: row.model_path ?? `/models/footballs/${row.slug}.glb`,
    poster: row.poster_path ?? `/images/footballs/${row.slug}.webp`,
    images: Array.isArray(row.images) ? row.images.filter((v): v is string => typeof v === "string") : [],
    family: familyFor(row.panel_count),
    panelCount: panels,
    construction: row.construction,
    material: row.material,
    modelDiameterCm: 22,
    description: row.description ?? "",
    featured: row.featured,
  };
}

export type Catalog = { products: Product[]; featured: Product[]; hero: Product | null; source: "database" | "bundled" };

const withDerived = (products: Product[], source: Catalog["source"]): Catalog => {
  const featured = products.filter((p) => p.featured);
  const hero = products.find((p) => p.slug === "new-design-14-panel") ?? featured[0] ?? products[0] ?? null;
  return { products, featured, hero, source };
};

export async function getCatalog(): Promise<Catalog> {
  if (!isSupabaseConfigured()) return withDerived(bundledProducts, "bundled");
  const { data, error } = await anonymous().from("public_products").select("*").order("sort_order").order("name");
  if (error) throw new Error(`The product catalogue could not be loaded: ${error.message}`);
  return withDerived(((data ?? []) as ProductRow[]).map(toProduct), "database");
}

export async function getCatalogProduct(slug: string): Promise<Product | null> {
  return (await getCatalog()).products.find((p) => p.slug === slug) ?? null;
}

type ReviewRow = { id: string; product_slug: string | null; customer_name: string; country: string | null; rating: number; body: string; created_at: string };
const toReview = (row: ReviewRow): Review => ({
  id: row.id, customerName: row.customer_name, country: row.country ?? "", rating: row.rating as Review["rating"],
  text: row.body, productSlug: row.product_slug ?? undefined, date: row.created_at.slice(0, 10),
});

export type ReviewPage = { reviews: Review[]; count: number; average: number | null; pageSize: number };

/** Approved reviews only, newest first, with the average and total computed from every approved review. */
export async function getApprovedReviews(options: { productSlug?: string; page?: number; pageSize?: number } = {}): Promise<ReviewPage> {
  const pageSize = options.pageSize ?? 9;
  const page = Math.max(1, options.page ?? 1);
  if (!isSupabaseConfigured()) return { reviews: [], count: 0, average: null, pageSize };

  const db = anonymous();
  let list = db.from("public_reviews").select("*", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  let ratings = db.from("public_reviews").select("rating").limit(10000);
  if (options.productSlug) {
    list = list.eq("product_slug", options.productSlug);
    ratings = ratings.eq("product_slug", options.productSlug);
  }
  const [{ data, count, error }, { data: all }] = await Promise.all([list, ratings]);
  if (error) throw new Error(`Reviews could not be loaded: ${error.message}`);
  const values = ((all ?? []) as { rating: number }[]).map((r) => r.rating);
  return {
    reviews: ((data ?? []) as ReviewRow[]).map(toReview),
    count: count ?? 0,
    average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
    pageSize,
  };
}

/** Average and count per football, for the collection cards. Only products with approved reviews appear. */
export async function getRatingSummaries(): Promise<Record<string, { average: number; count: number }>> {
  if (!isSupabaseConfigured()) return {};
  const { data } = await anonymous().from("public_reviews").select("product_slug, rating").not("product_slug", "is", null).limit(10000);
  const sums: Record<string, { total: number; count: number }> = {};
  for (const row of (data ?? []) as { product_slug: string; rating: number }[]) {
    const s = (sums[row.product_slug] ??= { total: 0, count: 0 });
    s.total += row.rating;
    s.count += 1;
  }
  return Object.fromEntries(Object.entries(sums).map(([slug, s]) => [slug, { average: s.total / s.count, count: s.count }]));
}
