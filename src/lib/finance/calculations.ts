import { roundHalfUp, sumMinor, type Minor } from "./money";

/**
 * The financial rules of the platform, as pure functions. The database applies the same rules
 * with triggers and views; tests check that the two agree. Definitions:
 *
 *   net sales revenue   = order total after discount, excluding pass-through tax
 *   gross profit        = net sales revenue - direct manufacturing costs
 *   contribution margin = net sales revenue - variable costs (direct + additional order costs)
 *   net profit          = gross profit - additional order costs - allocated operating expenses
 *   cash received       = confirmed payments - confirmed refunds   (pending and failed count as zero)
 *   outstanding balance = amount due (order total + debit notes - credit notes) - cash received
 */

export type LineItem = { quantity: number; unitPrice: Minor };

export type DocumentTotals = { subtotal: Minor; discount: Minor; taxable: Minor; tax: Minor; shipping: Minor; total: Minor };

/** Totals of a quotation, order or invoice. Tax applies to the discounted subtotal, not to shipping. */
export function documentTotals(items: LineItem[], discount: Minor, shipping: Minor, taxRatePercent: number): DocumentTotals {
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw new Error("Quantity must be a whole number above zero");
    if (item.unitPrice < 0) throw new Error("Unit price cannot be negative");
  }
  if (discount < 0 || shipping < 0) throw new Error("Discount and shipping cannot be negative");
  if (taxRatePercent < 0 || taxRatePercent > 100) throw new Error("Tax rate must be between 0 and 100");
  const subtotal = sumMinor(items.map((item) => item.quantity * item.unitPrice));
  if (discount > subtotal) throw new Error("Discount cannot exceed the subtotal");
  const taxable = subtotal - discount;
  const tax = roundHalfUp((taxable * taxRatePercent) / 100);
  return { subtotal, discount, taxable, tax, shipping, total: taxable + shipping + tax };
}

export type PaymentEntry = {
  kind: "payment" | "refund";
  status: "pending" | "received" | "partially_received" | "failed" | "refunded";
  /** Amount confirmed as received, in the order's currency. */
  receivedOrderAmount: Minor;
};

/** Money that has actually arrived. Only confirmed entries count, and each entry counts once. */
export function cashReceived(payments: PaymentEntry[]): Minor {
  let total = 0;
  for (const payment of payments) {
    if (payment.status !== "received" && payment.status !== "partially_received") continue;
    total += payment.kind === "refund" ? -payment.receivedOrderAmount : payment.receivedOrderAmount;
  }
  return total;
}

export type Adjustment = { kind: "credit" | "debit"; amount: Minor };

export function amountDue(orderTotal: Minor, adjustments: Adjustment[] = []): Minor {
  return orderTotal + sumMinor(adjustments.map((a) => (a.kind === "debit" ? a.amount : -a.amount)));
}

export function outstandingBalance(orderTotal: Minor, payments: PaymentEntry[], adjustments: Adjustment[] = []): Minor {
  return amountDue(orderTotal, adjustments) - cashReceived(payments);
}

export type PaymentStatus = "unpaid" | "partial" | "paid" | "overpaid";

export function paymentStatus(due: Minor, received: Minor): PaymentStatus {
  if (received <= 0) return "unpaid";
  if (received < due) return "partial";
  return received === due ? "paid" : "overpaid";
}

export type OrderProfitInput = {
  /** Order total, including tax and shipping charged to the customer. */
  orderTotal: Minor;
  /** Pass-through tax included in the total. */
  taxAmount: Minor;
  directCosts: Minor;
  additionalCosts: Minor;
  allocatedOperatingExpenses?: Minor;
};

export type OrderProfit = {
  netSalesRevenue: Minor;
  grossProfit: Minor;
  contributionMargin: Minor;
  netProfit: Minor;
  /** Percentages of net sales revenue, or null when there is no revenue. */
  grossMarginPercent: number | null;
  netMarginPercent: number | null;
};

export function orderProfit(input: OrderProfitInput): OrderProfit {
  const netSalesRevenue = input.orderTotal - input.taxAmount;
  const grossProfit = netSalesRevenue - input.directCosts;
  const contributionMargin = netSalesRevenue - input.directCosts - input.additionalCosts;
  const netProfit = contributionMargin - (input.allocatedOperatingExpenses ?? 0);
  const percent = (value: Minor) => (netSalesRevenue > 0 ? Math.round((value / netSalesRevenue) * 10000) / 100 : null);
  return { netSalesRevenue, grossProfit, contributionMargin, netProfit, grossMarginPercent: percent(grossProfit), netMarginPercent: percent(netProfit) };
}

/**
 * Spreads a shared operating expense total over orders in proportion to a weight (net sales revenue
 * by default, or direct cost). Uses the largest-remainder method, so the shares always add up to
 * exactly the total: no cent is lost or invented by rounding.
 */
export function allocateOverhead(total: Minor, orders: { id: string; weight: Minor }[]): Record<string, Minor> {
  if (total < 0) throw new Error("Total to allocate cannot be negative");
  const weightSum = sumMinor(orders.map((order) => Math.max(0, order.weight)));
  const shares: Record<string, Minor> = Object.fromEntries(orders.map((order) => [order.id, 0]));
  if (weightSum === 0 || total === 0) return shares;

  const exact = orders.map((order) => ({ id: order.id, exact: (total * Math.max(0, order.weight)) / weightSum }));
  let remaining = total;
  for (const entry of exact) {
    shares[entry.id] = Math.floor(entry.exact);
    remaining -= shares[entry.id];
  }
  const byRemainder = [...exact].sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)) || a.id.localeCompare(b.id));
  for (let i = 0; i < remaining; i += 1) shares[byRemainder[i % byRemainder.length].id] += 1;
  return shares;
}

export type PeriodProfitInput = {
  netSalesRevenue: Minor;
  directCosts: Minor;
  additionalCosts: Minor;
  operatingExpenses: Minor;
};

/** Profit and loss for a period, all in the reporting currency. */
export function periodProfit(input: PeriodProfitInput) {
  const grossProfit = input.netSalesRevenue - input.directCosts;
  const contributionMargin = grossProfit - input.additionalCosts;
  return { ...input, grossProfit, contributionMargin, netProfit: contributionMargin - input.operatingExpenses };
}
