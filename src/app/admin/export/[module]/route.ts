import { moduleBySlug } from "@/features/admin/modules";
import { toCsv } from "@/features/admin/schema";
import { getPath } from "@/components/admin/format";
import { hasPermission } from "@/features/auth/permissions";
import { getSessionUser } from "@/server/auth";
import { listRecords } from "@/server/data";

/** CSV export of a module's list, with the same search and filters. Needs the module's read and export permissions. */
export async function GET(request: Request, { params }: { params: Promise<{ module: string }> }) {
  const { module: slug } = await params;
  const config = moduleBySlug(slug);
  const user = await getSessionUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  if (!config || config.singleton || config.columns.length === 0) return new Response("Not found", { status: 404 });
  if (!hasPermission(user, config.read) || !hasPermission(user, config.exportPermission ?? "reports.export")) return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const filters = Object.fromEntries((config.filters ?? []).map((f) => [f.name, url.searchParams.get(f.name) ?? ""]));
  const { rows, error } = await listRecords(config, { q: url.searchParams.get("q") ?? "", filters, page: 1, all: true });
  if (error) return new Response(error, { status: 500 });

  const csv = toCsv(config.columns.map((c) => c.label), rows.map((row) => config.columns.map((c) => getPath(row, c.key))));
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
