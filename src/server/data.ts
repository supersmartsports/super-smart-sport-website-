import "server-only";
import { createUserClient } from "@/lib/database/server";
import { safeSearchTerm } from "@/features/admin/schema";
import type { Child, Field, ModuleConfig, Option, Related } from "@/features/admin/types";

export const PAGE_SIZE = 25;
type Row = Record<string, unknown>;

/** Every query here runs as the signed-in user, so the database returns only what that user may see. */
export async function listRecords(config: ModuleConfig, query: { q?: string; filters: Record<string, string>; page: number; all?: boolean }) {
  const supabase = await createUserClient();
  let request = supabase.from(config.table).select(config.select, { count: "exact" });
  if (config.baseFilter) request = request.is(config.baseFilter.column, null);
  for (const filter of config.filters ?? []) {
    const value = query.filters[filter.name];
    if (value && filter.options.some((option) => option.value === value)) request = request.eq(filter.column, value);
  }
  const term = safeSearchTerm(query.q ?? "");
  if (term && config.search.length) request = request.or(config.search.map((column) => `${column}.ilike.%${term}%`).join(","));
  request = request.order(config.order.column, { ascending: config.order.ascending });
  if (query.all) request = request.limit(5000);
  else request = request.range((query.page - 1) * PAGE_SIZE, query.page * PAGE_SIZE - 1);
  const { data, count, error } = await request;
  return { rows: (data ?? []) as unknown as Row[], count: count ?? 0, error: error?.message };
}

export async function getRecord(config: ModuleConfig, id: string) {
  const supabase = await createUserClient();
  const column = config.singleton?.idColumn ?? "id";
  const { data, error } = await supabase.from(config.table).select(config.select).eq(column, config.singleton ? config.singleton.idValue : id).maybeSingle();
  return { row: (data ?? null) as unknown as Row | null, error: error?.message };
}

export async function getChildRows(child: Child, parentId: string) {
  const supabase = await createUserClient();
  const { data, error } = await supabase.from(child.table).select(child.select ?? "*").eq(child.fk, parentId)
    .order(child.order?.column ?? "created_at", { ascending: child.order?.ascending ?? true }).limit(500);
  return { rows: (data ?? []) as unknown as Row[], error: error?.message };
}

export async function getRelatedRows(related: Related, parentId: string) {
  const supabase = await createUserClient();
  const { data, error } = await supabase.from(related.table).select(related.select ?? "*").eq(related.fk, parentId).limit(100);
  return { rows: (data ?? []) as unknown as Row[], error: error?.message };
}

/** Choices for fields that point at another table (customers, orders, employees ...). */
export async function loadRelationOptions(fields: Field[]): Promise<Record<string, Option[]>> {
  const supabase = await createUserClient();
  const result: Record<string, Option[]> = {};
  await Promise.all(
    fields.filter((field) => field.relation).map(async (field) => {
      const { table, label, value = "id", filter } = field.relation!;
      let request = supabase.from(table).select(`${value}, ${label}`).order(label).limit(500);
      if (filter) request = request.eq(filter[0], filter[1] as never);
      const { data } = await request;
      result[field.name] = ((data ?? []) as unknown as Row[]).map((row) => ({ value: String(row[value]), label: String(row[label] ?? row[value]) }));
    }),
  );
  return result;
}
