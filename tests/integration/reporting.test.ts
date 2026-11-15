import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createDatabase, createUser, rejects, type Db } from "./helpers/db";

/** A fixed test ledger with hand-calculated expected results. The reporting currency is USD. */
let db: Db;
let finance: string, sales: string, owner: string;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
const num = (v: unknown) => Number(v);

beforeAll(async () => {
  db = await createDatabase();
  owner = await createUser(db, "super_admin", "owner");
  finance = await createUser(db, "finance_manager", "finance");
  sales = await createUser(db, "sales_manager", "sales");
  const cust = (await one<{ id: string }>("insert into customers (name, country) values ('Buyer', 'DE') returning id")).id;

  // Order A: USD 1000, no tax. Order B: EUR, 450 of goods plus 11.11% tax = 500, rate 1.10 -> revenue 495 USD.
  const a = (await one<{ id: string }>("insert into orders (customer_id, currency, order_date, status) values ($1,'USD','2026-03-10','quotation_accepted') returning id", [cust])).id;
  await db.query("insert into order_items (order_id, description, quantity, unit_price) values ($1,'Footballs',10,100)", [a]);
  const b = (await one<{ id: string }>("insert into orders (customer_id, currency, fx_rate_to_base, order_date, status, tax_rate) values ($1,'EUR',1.10,'2026-03-15','quotation_accepted',11.11111111) returning id", [cust])).id;
  await db.query("insert into order_items (order_id, description, quantity, unit_price) values ($1,'Footballs',5,90)", [b]);

  // A cancelled order and an order outside the period must not appear in the March figures.
  const cancelled = (await one<{ id: string }>("insert into orders (customer_id, currency, order_date, status) values ($1,'USD','2026-03-20','new_inquiry') returning id", [cust])).id;
  await db.query("insert into order_items (order_id, description, quantity, unit_price) values ($1,'Never made',1,5000)", [cancelled]);
  await asUser(db, owner, () => db.query("select change_order_status($1,'cancelled')", [cancelled]));
  const old = (await one<{ id: string }>("insert into orders (customer_id, currency, order_date, status) values ($1,'USD','2025-12-01','quotation_accepted') returning id", [cust])).id;
  await db.query("insert into order_items (order_id, description, quantity, unit_price) values ($1,'Old',1,777)", [old]);

  // Costs: A has 200 direct of its own, 100 direct taken from a 150 expense, and 20 additional. B has 100 EUR direct.
  const rawMaterials = (await one<{ id: string }>("select id from expense_categories where key = 'raw_materials'")).id;
  const office = (await one<{ id: string }>("select id from expense_categories where key = 'office'")).id;
  const exp150 = (await one<{ id: string }>("insert into expenses (category_id, expense_date, amount, currency) values ($1,'2026-03-05',150,'USD') returning id", [rawMaterials])).id;
  await db.query("insert into expenses (category_id, expense_date, amount, currency) values ($1,'2026-03-06',200,'USD')", [office]);
  await db.query("insert into expenses (category_id, expense_date, amount, currency) values ($1,'2026-03-07',60,'USD')", [office]);
  const voided = (await one<{ id: string }>("insert into expenses (category_id, expense_date, amount, currency) values ($1,'2026-03-08',999,'USD') returning id", [office])).id;
  await db.query("update expenses set voided_at = now(), void_reason = 'duplicate' where id = $1", [voided]);
  await db.query("insert into order_costs (order_id, cost_class, category, amount, currency) values ($1,'direct','materials',200,'USD'),($1,'additional','shipping',20,'USD')", [a]);
  await db.query("insert into order_costs (order_id, cost_class, category, amount, currency, expense_id) values ($1,'direct','materials',100,'USD',$2)", [a, exp150]);
  await db.query("insert into order_costs (order_id, cost_class, category, amount, currency, fx_rate_to_base) values ($1,'direct','labor',100,'EUR',1.10)", [b]);

  // Payments: A receives 400 USD, B receives 200 EUR (= 220 USD). A pending payment counts for nothing.
  const pay = async (order: string, amount: number, currency: string, fx: number) =>
    (await one<{ id: string }>(
      "insert into payments (customer_id, order_id, method, amount, currency, order_currency_amount, fx_rate_to_base, payment_date) values ($1,$2,'bank_transfer',$3,$4,$3,$5,'2026-03-25') returning id",
      [cust, order, amount, currency, fx])).id;
  const p1 = await pay(a, 400, "USD", 1);
  const p2 = await pay(b, 200, "EUR", 1.1);
  await pay(a, 999, "USD", 1); // stays pending
  await asUser(db, finance, () => db.query("select confirm_payment($1)", [p1]));
  await asUser(db, finance, () => db.query("select confirm_payment($1)", [p2]));
});

describe("profit and loss (hand-calculated)", () => {
  const march = () =>
    asUser(db, finance, async () => (await one<{ r: Record<string, number | string> }>("select report_profit_loss('2026-03-01','2026-03-31') as r")).r);

  it("matches the expected figures exactly", async () => {
    const r = await march();
    expect(r.currency).toBe("USD");
    expect(num(r.orders)).toBe(2); // the cancelled and the out-of-period orders are excluded
    expect(num(r.revenue)).toBe(1495); // 1000 + 450 EUR * 1.10
    expect(num(r.direct_costs)).toBe(410); // 200 + 100 + 100 EUR * 1.10
    expect(num(r.additional_costs)).toBe(20);
    expect(num(r.gross_profit)).toBe(1085); // 1495 - 410
    expect(num(r.contribution_margin)).toBe(1065); // 1085 - 20
    expect(num(r.unallocated_direct_expenses)).toBe(50); // a 150 expense, 100 of it already inside order costs
    expect(num(r.operating_expenses)).toBe(260); // 200 + 60; the voided 999 is ignored
    expect(num(r.net_profit)).toBe(755); // 1065 - 50 - 260
    expect(num(r.cash_received)).toBe(620); // 400 + 200 EUR * 1.10; the pending 999 is not counted
    expect(num(r.outstanding_receivables)).toBe(930); // A: 1000 - 400, B: (500 - 200) EUR * 1.10
  });

  it("counts each expense once: the allocated part sits in order costs, only the remainder is an expense", async () => {
    const r = await march();
    const recorded = 150 + 200 + 60;
    expect(num(r.unallocated_direct_expenses) + num(r.operating_expenses) + 100).toBe(recorded);
  });

  it("returns zeros for a period with no activity", async () => {
    const r = await asUser(db, finance, async () => (await one<{ r: Record<string, number> }>("select report_profit_loss('2024-01-01','2024-01-31') as r")).r);
    expect(num(r.revenue)).toBe(0);
    expect(num(r.net_profit)).toBe(0);
  });

  it("shows monthly figures from the same ledger", async () => {
    const rows = (await asUser(db, finance, () => db.query<{ revenue: string; cash_received: string }>("select * from report_monthly('2026-01-01','2026-03-31')"))).rows;
    expect(rows).toHaveLength(3);
    expect(num(rows[2].revenue)).toBe(1495);
    expect(num(rows[2].cash_received)).toBe(620);
    expect(num(rows[0].revenue)).toBe(0);
  });

  it("reports order profitability, sales by country and the expense breakdown", async () => {
    const orders = (await asUser(db, finance, () => db.query<{ revenue: string; direct_costs: string }>("select * from report_order_profitability('2026-03-01','2026-03-31')"))).rows;
    expect(orders.map((o) => num(o.revenue))).toEqual([1000, 495]);
    expect(orders.map((o) => num(o.direct_costs))).toEqual([300, 110]);
    const countries = (await asUser(db, owner, () => db.query<{ country: string; revenue: string }>("select * from report_sales_by_country('2026-03-01','2026-03-31')"))).rows;
    expect(countries).toHaveLength(1);
    expect(countries[0].country).toBe("DE");
    expect(num(countries[0].revenue)).toBe(1495);
    const breakdown = (await asUser(db, finance, () => db.query<{ amount: string }>("select * from report_expense_breakdown('2026-03-01','2026-03-31')"))).rows;
    expect(breakdown.reduce((sum, row) => sum + num(row.amount), 0)).toBe(410);
  });

  it("keeps financial reports away from roles without finance access", async () => {
    await rejects(asUser(db, sales, () => db.query("select report_profit_loss('2026-03-01','2026-03-31')")));
    await rejects(asUser(db, sales, () => db.query("select * from report_monthly('2026-03-01','2026-03-31')")));
    await rejects(asUser(db, sales, () => db.query("select * from report_expense_breakdown('2026-03-01','2026-03-31')")));
  });
});

describe("foreign-currency orders", () => {
  it("must carry an explicit exchange rate before they are confirmed", async () => {
    const cust = (await one<{ id: string }>("select id from customers limit 1")).id;
    const o = (await one<{ id: string }>("insert into orders (customer_id, currency, status) values ($1,'EUR','quotation_accepted') returning id", [cust])).id;
    await asUser(db, owner, () => db.query("select change_order_status($1,'design_approval')", [o]));
    const message = await rejects(asUser(db, owner, () => db.query("select change_order_status($1,'order_confirmed')", [o])));
    expect(message).toMatch(/exchange rate/);
    await db.query("update orders set fx_rate_to_base = 1.08 where id = $1", [o]);
    await asUser(db, owner, () => db.query("select change_order_status($1,'order_confirmed')", [o]));
  });
});
