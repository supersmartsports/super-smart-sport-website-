import type { Metadata } from "next";
import Link from "next/link";
import { DateRangeBar } from "@/components/admin/DateRangeBar";
import { fromMinor, toMinor } from "@/lib/finance/money";
import { createUserClient } from "@/lib/database/server";
import { resolveRange } from "@/lib/utilities/date-range";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "Overview" };

type Money = { currency: string; order_value: string; cash_received: string; outstanding: string };
type Finance = {
  currency: string; orders: number; revenue: number; direct_costs: number; additional_costs: number; gross_profit: number; contribution_margin: number;
  unallocated_direct_expenses: number; operating_expenses: number; net_profit: number; cash_received: number; outstanding_receivables: number; open_order_revenue: number;
};
type Summary = {
  customers?: number; new_inquiries?: number; pending_quotations?: number;
  orders?: { total: number; pending: number; active: number; completed: number };
  production?: { footballs_in_production: number; batches_open: number };
  shipments_in_transit?: number; money_by_currency?: Money[];
  orders_in_range?: number; inquiries_in_range?: number; finance?: Finance;
};

const m = (value: unknown) => fromMinor(toMinor(Number(value ?? 0).toFixed(2)));

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-sm bg-white p-5 ring-1 ring-line">
      <p className="type-label text-slate">{label}</p>
      <p className="mt-2 text-3xl font-extrabold tabular-nums [font-stretch:80%]">{value}</p>
      {note && <p className="mt-1 text-sm text-slate">{note}</p>}
    </div>
  );
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ denied?: string; preset?: string; from?: string; to?: string }> }) {
  const user = await requireUser();
  const q = await searchParams;
  const range = resolveRange(q.preset, q.from, q.to);
  const supabase = await createUserClient();
  // Every figure comes from the database, which includes only what this user may see.
  const { data, error } = await supabase.rpc("dashboard_summary_range", { p_from: range.from, p_to: range.to });
  const summary = (data ?? {}) as Summary;
  const f = summary.finance;
  const hasAnything = Object.keys(summary).length > 1;

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="type-h2">Overview</h1>
      <p className="mt-2 text-slate">Welcome, {user.fullName}.</p>

      {q.denied && <p role="alert" className="mt-5 rounded-sm bg-red/10 p-4 font-semibold text-red-deep">Your role does not include access to that page.</p>}
      {error && <p role="alert" className="mt-5 rounded-sm bg-red/10 p-4 font-semibold text-red-deep">The figures could not be loaded. Try again; if it keeps happening, check that the database migrations are applied.</p>}
      {!error && !hasAnything && <p className="mt-8 rounded-sm bg-white p-6 ring-1 ring-line">Your role has no dashboard figures. Use the menu to open the areas you have access to.</p>}

      <section aria-label="Business figures" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.orders && (
          <>
            <Stat label="Total orders" value={summary.orders.total} />
            <Stat label="Active orders" value={summary.orders.active} note="Confirmed through shipped" />
            <Stat label="Pending orders" value={summary.orders.pending} note="Before confirmation" />
            <Stat label="Completed orders" value={summary.orders.completed} />
          </>
        )}
        {summary.customers !== undefined && <Stat label="Customers" value={summary.customers} />}
        {summary.new_inquiries !== undefined && <Stat label="New inquiries" value={summary.new_inquiries} />}
        {summary.pending_quotations !== undefined && <Stat label="Pending quotations" value={summary.pending_quotations} />}
        {summary.production && <Stat label="Footballs in production" value={summary.production.footballs_in_production} note={`${summary.production.batches_open} open batches`} />}
        {summary.shipments_in_transit !== undefined && <Stat label="Shipments in transit" value={summary.shipments_in_transit} />}
      </section>

      {(f || summary.orders_in_range !== undefined) && (
        <section aria-labelledby="period-h" className="mt-10">
          <h2 id="period-h" className="type-h3">For the selected period</h2>
          <div className="mt-3"><DateRangeBar path="/admin/dashboard" range={range} /></div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summary.orders_in_range !== undefined && <Stat label="Orders placed" value={summary.orders_in_range} />}
            {summary.inquiries_in_range !== undefined && <Stat label="Inquiries received" value={summary.inquiries_in_range} />}
            {f && (
              <>
                <Stat label={`Revenue (${f.currency})`} value={m(f.revenue)} note="Orders minus pass-through tax" />
                <Stat label={`Cash received (${f.currency})`} value={m(f.cash_received)} note="Confirmed payments only" />
                <Stat label={`Outstanding (${f.currency})`} value={m(f.outstanding_receivables)} note="Still owed on these orders" />
                <Stat label={`Total expenses (${f.currency})`} value={m(f.direct_costs + f.additional_costs + f.unallocated_direct_expenses + f.operating_expenses)} note="Order costs and expenses, counted once" />
                <Stat label={`Gross profit (${f.currency})`} value={m(f.gross_profit)} note="Revenue minus direct costs" />
                <Stat label={`Net profit (${f.currency})`} value={m(f.net_profit)} note="After all costs and expenses" />
              </>
            )}
          </dl>
          {f && <p className="mt-3 text-sm text-slate">Full breakdown, monthly trend and profit by order and customer: <Link href={`/admin/profit-loss?preset=${range.preset}${range.preset === "custom" ? `&from=${range.from}&to=${range.to}` : ""}`} className="font-semibold text-navy underline">Profit &amp; Loss</Link>.</p>}
        </section>
      )}

      {summary.money_by_currency && (
        <section aria-labelledby="money-heading" className="mt-10">
          <h2 id="money-heading" className="type-h3">All orders, by currency</h2>
          <p className="mt-1 text-sm text-slate">Currencies are never added together. Cash received counts confirmed payments only.</p>
          {summary.money_by_currency.length === 0 ? (
            <p className="mt-4 rounded-sm bg-white p-6 ring-1 ring-line">No orders have been recorded yet, so there is nothing to total.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-sm bg-white ring-1 ring-line">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="border-b border-line text-slate"><tr>
                  <th className="p-4 font-semibold">Currency</th><th className="p-4 text-right font-semibold">Amount due</th>
                  <th className="p-4 text-right font-semibold">Cash received</th><th className="p-4 text-right font-semibold">Outstanding</th>
                </tr></thead>
                <tbody>
                  {summary.money_by_currency.map((row) => (
                    <tr key={row.currency} className="border-b border-line last:border-0">
                      <th scope="row" className="p-4 font-bold">{row.currency}</th>
                      <td className="p-4 text-right tabular-nums">{fromMinor(toMinor(row.order_value))}</td>
                      <td className="p-4 text-right tabular-nums">{fromMinor(toMinor(row.cash_received))}</td>
                      <td className="p-4 text-right font-bold tabular-nums">{fromMinor(toMinor(row.outstanding))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
