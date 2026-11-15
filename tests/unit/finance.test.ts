import { describe, expect, it } from "vitest";
import { addSameCurrency, convertMinor, fromMinor, toMinor, totalsByCurrency } from "@/lib/finance/money";
import {
  allocateOverhead, amountDue, cashReceived, documentTotals, orderProfit, outstandingBalance, paymentStatus, periodProfit,
  type PaymentEntry,
} from "@/lib/finance/calculations";

describe("money", () => {
  it("converts to and from minor units exactly", () => {
    expect(toMinor("1234.50")).toBe(123450);
    expect(toMinor("0.1") + toMinor("0.2")).toBe(30);
    expect(toMinor(19.99)).toBe(1999);
    expect(fromMinor(123450)).toBe("1234.50");
    expect(fromMinor(-5)).toBe("-0.05");
    expect(fromMinor(toMinor("-12.3"))).toBe("-12.30");
  });

  it("rejects values that are not money", () => {
    for (const bad of ["", "abc", "1.234", "1,000", "1e5", "--1"]) expect(() => toMinor(bad)).toThrow();
  });

  it("converts only with an explicit, positive rate", () => {
    expect(convertMinor(toMinor("900.00"), "1.08")).toBe(toMinor("972.00"));
    expect(convertMinor(toMinor("28000.00"), 0.0036)).toBe(toMinor("100.80"));
    expect(() => convertMinor(100, 0)).toThrow();
    expect(() => convertMinor(100, "x")).toThrow();
  });

  it("never adds different currencies together", () => {
    expect(() => addSameCurrency([{ currency: "USD", minor: 100 }, { currency: "EUR", minor: 100 }])).toThrow(/exchange rate/);
    expect(addSameCurrency([{ currency: "USD", minor: 100 }, { currency: "USD", minor: 250 }])).toEqual({ currency: "USD", minor: 350 });
    expect(totalsByCurrency([{ currency: "USD", minor: 100 }, { currency: "PKR", minor: 5000 }, { currency: "USD", minor: 1 }]))
      .toEqual({ USD: 101, PKR: 5000 });
  });
});

describe("document totals", () => {
  it("applies discount, then tax on the discounted amount, then shipping", () => {
    const t = documentTotals([{ quantity: 10, unitPrice: 2550 }, { quantity: 5, unitPrice: 1000 }], 500, 2000, 10);
    expect(t).toEqual({ subtotal: 30500, discount: 500, taxable: 30000, tax: 3000, shipping: 2000, total: 35000 });
  });

  it("rounds tax half up to the cent", () => {
    expect(documentTotals([{ quantity: 1, unitPrice: 1005 }], 0, 0, 5).tax).toBe(50); // 50.25 -> 50
    expect(documentTotals([{ quantity: 1, unitPrice: 1010 }], 0, 0, 5).tax).toBe(51); // 50.5 -> 51
  });

  it("rejects impossible inputs", () => {
    expect(() => documentTotals([{ quantity: 1, unitPrice: 100 }], 200, 0, 0)).toThrow(/Discount/);
    expect(() => documentTotals([{ quantity: 0, unitPrice: 100 }], 0, 0, 0)).toThrow();
    expect(() => documentTotals([{ quantity: 1.5, unitPrice: 100 }], 0, 0, 0)).toThrow();
    expect(() => documentTotals([{ quantity: 1, unitPrice: -1 }], 0, 0, 0)).toThrow();
    expect(() => documentTotals([], 0, 0, 101)).toThrow();
  });
});

describe("payments and balances", () => {
  const deposit: PaymentEntry = { kind: "payment", status: "received", receivedOrderAmount: 10000 };
  const pending: PaymentEntry = { kind: "payment", status: "pending", receivedOrderAmount: 0 };
  const partial: PaymentEntry = { kind: "payment", status: "partially_received", receivedOrderAmount: 4000 };
  const failed: PaymentEntry = { kind: "payment", status: "failed", receivedOrderAmount: 0 };
  const refund: PaymentEntry = { kind: "refund", status: "received", receivedOrderAmount: 2500 };

  it("a deposit is not the whole order: only confirmed money counts", () => {
    expect(cashReceived([deposit, pending, failed])).toBe(10000);
    expect(outstandingBalance(35000, [deposit, pending])).toBe(25000);
  });

  it("counts each payment once and subtracts refunds", () => {
    expect(cashReceived([deposit, partial, refund])).toBe(11500);
    expect(cashReceived([deposit, deposit])).toBe(20000); // two separate payments, each counted once
  });

  it("includes credit and debit notes in the amount due", () => {
    expect(amountDue(35000, [{ kind: "credit", amount: 2000 }, { kind: "debit", amount: 500 }])).toBe(33500);
    expect(outstandingBalance(35000, [deposit], [{ kind: "credit", amount: 2000 }])).toBe(23000);
  });

  it("derives the payment status", () => {
    expect(paymentStatus(35000, 0)).toBe("unpaid");
    expect(paymentStatus(35000, 10000)).toBe("partial");
    expect(paymentStatus(35000, 35000)).toBe("paid");
    expect(paymentStatus(35000, 36000)).toBe("overpaid");
  });
});

describe("profit", () => {
  it("separates gross profit, contribution margin and net profit", () => {
    const p = orderProfit({ orderTotal: 44000, taxAmount: 4000, directCosts: 20000, additionalCosts: 3000, allocatedOperatingExpenses: 5000 });
    expect(p.netSalesRevenue).toBe(40000);
    expect(p.grossProfit).toBe(20000);
    expect(p.contributionMargin).toBe(17000);
    expect(p.netProfit).toBe(12000);
    expect(p.grossMarginPercent).toBe(50);
    expect(p.netMarginPercent).toBe(30);
  });

  it("reports a loss as a loss and has no margin without revenue", () => {
    expect(orderProfit({ orderTotal: 1000, taxAmount: 0, directCosts: 1500, additionalCosts: 0 }).grossProfit).toBe(-500);
    expect(orderProfit({ orderTotal: 0, taxAmount: 0, directCosts: 0, additionalCosts: 0 }).grossMarginPercent).toBeNull();
  });

  it("allocates overhead by share so the parts always equal the whole", () => {
    const shares = allocateOverhead(10000, [{ id: "a", weight: 1 }, { id: "b", weight: 1 }, { id: "c", weight: 1 }]);
    expect(Object.values(shares).reduce((s, v) => s + v, 0)).toBe(10000);
    expect(Object.values(shares).sort()).toEqual([3333, 3333, 3334]);

    const weighted = allocateOverhead(9999, [{ id: "a", weight: 70000 }, { id: "b", weight: 20000 }, { id: "c", weight: 10000 }]);
    expect(weighted.a + weighted.b + weighted.c).toBe(9999);
    expect(weighted.a).toBeGreaterThan(weighted.b);
  });

  it("allocates nothing when there is nothing to allocate or no basis", () => {
    expect(allocateOverhead(0, [{ id: "a", weight: 5 }])).toEqual({ a: 0 });
    expect(allocateOverhead(500, [{ id: "a", weight: 0 }])).toEqual({ a: 0 });
    expect(() => allocateOverhead(-1, [])).toThrow();
  });

  it("period profit: expenses are subtracted once", () => {
    const p = periodProfit({ netSalesRevenue: 100000, directCosts: 45000, additionalCosts: 5000, operatingExpenses: 20000 });
    expect(p.grossProfit).toBe(55000);
    expect(p.contributionMargin).toBe(50000);
    expect(p.netProfit).toBe(30000);
    expect(p.netSalesRevenue - p.directCosts - p.additionalCosts - p.operatingExpenses).toBe(p.netProfit);
  });
});
