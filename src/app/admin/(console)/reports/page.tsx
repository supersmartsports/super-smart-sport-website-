import type { Metadata } from "next";
import Link from "next/link";
import { DateRangeBar } from "@/components/admin/DateRangeBar";
import { DataTable } from "@/components/admin/format";
import { hasPermission } from "@/features/auth/permissions";
import { createUserClient } from "@/lib/database/server";
import { resolveRange } from "@/lib/utilities/date-range";
import { requirePermission } from "@/server/auth";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ preset?: string; from?: string; to?: string }> }) {
  const user = await requirePermission("reports.read");
  const q = await searchParams;
  const range = resolveRange(q.preset, q.from, q.to);
  const supabase = await createUserClient();
  const args = { p_from: range.from, p_to: range.to };

  const [countries, production, orders, shipments] = await Promise.all([
    supabase.rpc("report_sales_by_country", args),
    supabase.rpc("report_production_summary"),
    supabase.from("orders").select("status").gte("order_date", range.from).lte("order_date", range.to).limit(5000),
    hasPermission(user, "shipping.read") ? supabase.from("shipments").select("status").limit(5000) : Promise.resolve({ data: null }),
  ]);

  const tally = (rows: { status: string }[] | null) => Object.entries((rows ?? []).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {})).map(([status, count], id) => ({ id, status, count }));
  const orderRows = (orders.data ?? []) as { status: string }[];
  const finished = orderRows.filter((o) => ["delivered", "completed"].includes(o.status)).length;
  const cancelled = orderRows.filter((o) => o.status === "cancelled").length;

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="type-h2">Reports</h1>
      <p className="mt-2 text-slate">Real records only. Financial reports (profit, costs, outstanding balances) are in <Link href="/admin/profit-loss" className="font-semibold text-navy underline">Profit &amp; Loss</Link>.</p>
      <div className="mt-5"><DateRangeBar path="/admin/reports" range={range} /></div>

      <section className="mt-8">
        <h2 className="type-h3">Orders in this range</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          {([["Orders placed", orderRows.length], ["Completion rate", orderRows.length ? `${Math.round((finished / orderRows.length) * 100)}%` : "No orders"], ["Cancelled", cancelled]] as [string, string | number][]).map(([label, value]) => (
            <div key={label} className="rounded-sm bg-white p-4 ring-1 ring-line"><dt className="type-label text-slate">{label}</dt><dd className="mt-1 text-2xl font-extrabold tabular-nums">{value}</dd></div>
          ))}
        </dl>
        <div className="mt-3"><DataTable empty="No orders in this range." columns={[{ key: "status", label: "Status", format: "status" }, { key: "count", label: "Orders", format: "number" }]} rows={tally(orderRows)} /></div>
      </section>

      <section className="mt-10">
        <h2 className="type-h3">Sales by country</h2>
        {countries.error ? <p className="mt-3 text-slate">{hasPermission(user, "reports.read") ? countries.error.message : ""}</p> : (
          <div className="mt-3"><DataTable empty="No sales in this range." columns={[{ key: "country", label: "Country" }, { key: "orders", label: "Orders", format: "number" }, { key: "revenue", label: "Revenue (reporting currency)", format: "money" }]}
            rows={((countries.data ?? []) as { country: string; orders: number; revenue: number }[]).map((c, id) => ({ id, ...c }))} /></div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="type-h3">Production</h2>
        <div className="mt-3"><DataTable empty="No production batches yet." columns={[{ key: "status", label: "Batch status", format: "status" }, { key: "batches", label: "Batches", format: "number" }, { key: "footballs", label: "Footballs", format: "number" }]}
          rows={((production.data ?? []) as { status: string; batches: number; footballs: number }[]).map((p, id) => ({ id, ...p }))} /></div>
      </section>

      {shipments.data && (
        <section className="mt-10">
          <h2 className="type-h3">Shipping</h2>
          <div className="mt-3"><DataTable empty="No shipments yet." columns={[{ key: "status", label: "Shipment status", format: "status" }, { key: "count", label: "Shipments", format: "number" }]} rows={tally(shipments.data as { status: string }[])} /></div>
        </section>
      )}
    </div>
  );
}
