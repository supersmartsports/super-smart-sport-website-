import type { Metadata } from "next";
import { DateRangeBar } from "@/components/admin/DateRangeBar";
import { DataTable } from "@/components/admin/format";
import { allocateOverhead, orderProfit, periodProfit } from "@/lib/finance/calculations";
import { fromMinor, toMinor } from "@/lib/finance/money";
import { createUserClient } from "@/lib/database/server";
import { resolveRange } from "@/lib/utilities/date-range";
import { requirePermission } from "@/server/auth";

export const metadata: Metadata = { title: "Profit & Loss" };

type Q = Promise<{ preset?: string; from?: string; to?: string }>;
// Report amounts arrive as numbers with at most two decimals; convert exactly.
const minor = (value: unknown) => toMinor(Number(value ?? 0).toFixed(2));
const money = (value: number) => fromMinor(value);

export default async function ProfitLossPage({ searchParams }: { searchParams: Q }) {
  await requirePermission("finance.read");
  const q = await searchParams;
  const range = resolveRange(q.preset, q.from, q.to);
  const supabase = await createUserClient();
  const args = { p_from: range.from, p_to: range.to };

  const [pl, monthly, orders, expenses, settings] = await Promise.all([
    supabase.rpc("report_profit_loss", args),
    supabase.rpc("report_monthly", args),
    supabase.rpc("report_order_profitability", args),
    supabase.rpc("report_expense_breakdown", args),
    supabase.from("business_settings").select("overhead_allocation_method").maybeSingle(),
  ]);
  const failed = pl.error ?? monthly.error ?? orders.error ?? expenses.error;
  if (failed) return <p role="alert" className="rounded-sm bg-red/10 p-4 font-semibold text-red-deep">The report could not be loaded: {failed.message}</p>;

  const r = pl.data as Record<string, number | string>;
  const currency = String(r.currency);
  const revenue = minor(r.revenue), direct = minor(r.direct_costs), additional = minor(r.additional_costs);
  const unallocatedDirect = minor(r.unallocated_direct_expenses), operating = minor(r.operating_expenses);
  const period = periodProfit({ netSalesRevenue: revenue, directCosts: direct, additionalCosts: additional + unallocatedDirect, operatingExpenses: operating });

  // Spread shared operating expenses over the orders, by the method chosen in Settings.
  const rows = (orders.data ?? []) as { order_id: string; order_number: string; customer_id: string; customer_name: string; revenue: number; direct_costs: number; additional_costs: number }[];
  const byDirect = settings.data?.overhead_allocation_method === "direct_cost_share";
  const shares = allocateOverhead(operating, rows.map((o) => ({ id: o.order_id, weight: byDirect ? minor(o.direct_costs) : minor(o.revenue) })));
  const perOrder = rows.map((o) => {
    const p = orderProfit({ orderTotal: minor(o.revenue), taxAmount: 0, directCosts: minor(o.direct_costs), additionalCosts: minor(o.additional_costs), allocatedOperatingExpenses: shares[o.order_id] });
    return { ...o, ...p, overhead: shares[o.order_id] };
  });
  const byCustomer = Object.values(perOrder.reduce<Record<string, { name: string; orders: number; revenue: number; gross: number; net: number }>>((acc, o) => {
    const c = (acc[o.customer_id] ??= { name: o.customer_name, orders: 0, revenue: 0, gross: 0, net: 0 });
    c.orders += 1; c.revenue += o.netSalesRevenue; c.gross += o.grossProfit; c.net += o.netProfit;
    return acc;
  }, {}));
  const months = (monthly.data ?? []) as { month: string; revenue: number; expenses: number; direct_costs: number }[];
  const peak = Math.max(1, ...months.flatMap((m) => [Number(m.revenue), Number(m.direct_costs) + Number(m.expenses)]));

  const line = (label: string, value: number, note?: string, strong?: boolean) => (
    <tr className={`border-b border-line last:border-0 ${strong ? "bg-paper font-bold" : ""}`}>
      <th scope="row" className="p-3 text-left font-semibold">{label}{note && <span className="block text-xs font-normal text-slate">{note}</span>}</th>
      <td className="p-3 text-right tabular-nums">{money(value)}</td>
    </tr>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="type-h2">Profit &amp; Loss</h1>
      <p className="mt-2 text-slate">All amounts in {currency}, converted with the explicit rate recorded on each order, payment and expense. Every figure comes from stored records.</p>
      <div className="mt-5"><DateRangeBar path="/admin/profit-loss" range={range} /></div>

      <section aria-labelledby="pl-h" className="mt-8">
        <h2 id="pl-h" className="type-h3">Profit and loss</h2>
        <div className="mt-3 overflow-x-auto rounded-sm bg-white ring-1 ring-line">
          <table className="w-full text-sm"><tbody>
            {line(`Revenue (${r.orders} orders)`, revenue, "Order totals minus pass-through tax; cancelled orders excluded")}
            {line("Direct manufacturing costs", -direct, "Materials, labour, printing, stitching or bonding, packaging")}
            {line("Gross profit", period.grossProfit, undefined, true)}
            {line("Additional order costs and unassigned manufacturing expenses", -(additional + unallocatedDirect), "Shipping paid, payment fees, direct expenses not yet assigned to orders")}
            {line("Contribution margin", period.contributionMargin, undefined, true)}
            {line("Operating expenses", -operating, "Office, marketing, utilities, equipment, other")}
            {line("Net profit", period.netProfit, undefined, true)}
          </tbody></table>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {([["Cash received in period", r.cash_received], ["Outstanding on these orders", r.outstanding_receivables], ["Value of orders still open", r.open_order_revenue]] as [string, unknown][]).map(([label, value]) => (
            <div key={label} className="rounded-sm bg-white p-4 ring-1 ring-line"><dt className="type-label text-slate">{label}</dt><dd className="mt-1 text-xl font-extrabold tabular-nums">{money(minor(value))}</dd></div>
          ))}
        </dl>
        <p className="mt-2 text-sm text-slate">Cash received is confirmed money only. Revenue is not cash: a deposit does not make the whole order received.</p>
      </section>

      <section aria-labelledby="m-h" className="mt-10">
        <h2 id="m-h" className="type-h3">Monthly trend</h2>
        {months.length === 0 ? <p className="mt-3 rounded-sm bg-white p-6 ring-1 ring-line">No months in this range.</p> : (
          <figure className="mt-3 overflow-x-auto rounded-sm bg-white p-4 ring-1 ring-line">
            <svg role="img" aria-label="Monthly revenue and costs" viewBox={`0 0 ${Math.max(480, months.length * 90)} 220`} className="min-w-[30rem]">
              {months.map((m, i) => {
                const rev = (Number(m.revenue) / peak) * 150, cost = ((Number(m.direct_costs) + Number(m.expenses)) / peak) * 150, x = 20 + i * 90;
                return (
                  <g key={m.month}>
                    <rect x={x} y={170 - rev} width="30" height={rev} fill="var(--color-navy)"><title>{`${m.month.slice(0, 7)} revenue ${Number(m.revenue).toFixed(2)} ${currency}`}</title></rect>
                    <rect x={x + 34} y={170 - cost} width="30" height={cost} fill="var(--color-red)"><title>{`${m.month.slice(0, 7)} costs and expenses ${(Number(m.direct_costs) + Number(m.expenses)).toFixed(2)} ${currency}`}</title></rect>
                    <text x={x + 32} y="192" textAnchor="middle" fontSize="11" fill="currentColor">{m.month.slice(0, 7)}</text>
                  </g>
                );
              })}
            </svg>
            <figcaption className="mt-2 flex gap-4 text-sm"><span><span aria-hidden className="mr-1 inline-block size-3 bg-navy" />Revenue</span><span><span aria-hidden className="mr-1 inline-block size-3 bg-red" />Direct costs and expenses</span></figcaption>
          </figure>
        )}
      </section>

      <section aria-labelledby="o-h" className="mt-10">
        <h2 id="o-h" className="type-h3">Profit by order</h2>
        <p className="mt-1 text-sm text-slate">Operating expenses are spread by {byDirect ? "direct cost share" : "revenue share"} (Settings). The shares add up exactly to the total.</p>
        <div className="mt-3"><DataTable empty="No orders in this range."
          columns={[{ key: "order_number", label: "Order" }, { key: "customer_name", label: "Customer" }, { key: "rev", label: "Revenue", format: "money" }, { key: "direct", label: "Direct costs", format: "money" }, { key: "gross", label: "Gross profit", format: "money" }, { key: "oh", label: "Overhead share", format: "money" }, { key: "net", label: "Net profit", format: "money" }]}
          rows={perOrder.map((o) => ({ id: o.order_id, order_number: o.order_number, customer_name: o.customer_name, rev: money(o.netSalesRevenue), direct: money(minor(o.direct_costs)), gross: money(o.grossProfit), oh: money(o.overhead), net: money(o.netProfit) }))} /></div>
      </section>

      <section aria-labelledby="c-h" className="mt-10">
        <h2 id="c-h" className="type-h3">Profit by customer</h2>
        <div className="mt-3"><DataTable empty="No customers in this range."
          columns={[{ key: "name", label: "Customer" }, { key: "orders", label: "Orders", format: "number" }, { key: "revenue", label: "Revenue", format: "money" }, { key: "gross", label: "Gross profit", format: "money" }, { key: "net", label: "Net profit", format: "money" }]}
          rows={byCustomer.map((c, i) => ({ id: i, name: c.name, orders: c.orders, revenue: money(c.revenue), gross: money(c.gross), net: money(c.net) }))} /></div>
      </section>

      <section aria-labelledby="e-h" className="mt-10">
        <h2 id="e-h" className="type-h3">Expense breakdown</h2>
        <div className="mt-3"><DataTable empty="No expenses in this range."
          columns={[{ key: "category", label: "Category" }, { key: "kind", label: "Type", format: "status" }, { key: "amount", label: "Amount", format: "money" }]}
          rows={((expenses.data ?? []) as { category: string; kind: string; amount: number }[]).map((e, i) => ({ id: i, category: e.category, kind: e.kind, amount: money(minor(e.amount)) }))} /></div>
      </section>
    </div>
  );
}
