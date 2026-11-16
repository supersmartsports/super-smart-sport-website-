import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, createDatabase, createUser, rejects, type Db } from "./helpers/db";

/**
 * Runs the real migrations in an in-memory Postgres and checks the rules that protect the business:
 * who can see what, that money cannot be edited or counted twice, and that workflows cannot be skipped.
 * Every row here is throwaway test data; nothing touches a real database.
 */
let db: Db;
let owner: string, sales: string, production: string, finance: string, employee: string, admin: string;
let customerId: string;

const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
const all = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const num = (value: unknown) => Number(value);

async function newOrder(currency = "USD", qty = 10, price = "25.50"): Promise<string> {
  const o = await one<{ id: string }>(
    "insert into orders (customer_id, currency, status) values ($1, $2, 'quotation_accepted') returning id",
    [customerId, currency],
  );
  await db.query("insert into order_items (order_id, description, quantity, unit_price) values ($1, 'Match football', $2, $3)", [o.id, qty, price]);
  return o.id;
}

beforeAll(async () => {
  db = await createDatabase();
  owner = await createUser(db, "super_admin", "owner");
  sales = await createUser(db, "sales_manager", "sales");
  production = await createUser(db, "production_manager", "production");
  finance = await createUser(db, "finance_manager", "finance");
  employee = await createUser(db, "employee", "employee");
  admin = await createUser(db, "admin", "admin");
  customerId = (await one<{ id: string }>("insert into customers (name, email, whatsapp, country) values ('Test Buyer', 'Buyer@Example.com', '+44 7700 900123', 'GB') returning id")).id;
});

describe("reference data", () => {
  it("creates permissions and roles but no business data", async () => {
    expect(num((await one<{ n: number }>("select count(*)::int n from permissions")).n)).toBeGreaterThan(40);
    expect(num((await one<{ n: number }>("select count(*)::int n from roles")).n)).toBe(6);
    for (const table of ["orders", "payments", "invoices", "expenses", "quotations", "shipments"]) {
      expect(num((await one<{ n: number }>(`select count(*)::int n from ${table}`)).n)).toBe(0);
    }
  });
});

describe("access control (row level security)", () => {
  it("lets each role see only what its permissions allow", async () => {
    expect((await asUser(db, sales, () => all("select 1 from customers"))).length).toBe(1);
    expect((await asUser(db, employee, () => all("select 1 from customers"))).length).toBe(0);
    expect((await asUser(db, finance, () => all("select 1 from customers"))).length).toBe(1);
    expect((await asUser(db, production, () => all("select 1 from customers"))).length).toBe(0);
  });

  it("keeps financial records away from sales and production", async () => {
    const orderId = await newOrder();
    await db.query(
      "insert into payments (customer_id, order_id, method, amount, currency, order_currency_amount, payment_date) values ($1,$2,'bank_transfer',50,'USD',50,current_date)",
      [customerId, orderId],
    );
    expect((await asUser(db, finance, () => all("select 1 from payments"))).length).toBeGreaterThan(0);
    expect((await asUser(db, sales, () => all("select 1 from payments"))).length).toBe(0);
    expect((await asUser(db, production, () => all("select 1 from payments"))).length).toBe(0);
    expect((await asUser(db, sales, () => all("select 1 from expenses"))).length).toBe(0);
    expect((await asUser(db, sales, () => all("select 1 from order_costs"))).length).toBe(0);
  });

  it("blocks writes that the role may not make", async () => {
    await rejects(asUser(db, sales, () => db.query("insert into expense_categories (key, name, kind) values ('x_cat', 'X', 'direct')")));
    await rejects(asUser(db, employee, () => db.query("insert into customers (name) values ('Nope')")));
    await rejects(asUser(db, production, () => db.query("insert into payments (customer_id, order_id, method, amount, currency, order_currency_amount, payment_date) select customer_id, id, 'other', 1, 'USD', 1, current_date from orders limit 1")));
  });

  it("only the owner reads the audit log and settings are owner-managed", async () => {
    expect((await asUser(db, owner, () => all("select 1 from audit_logs limit 1"))).length).toBe(1);
    expect((await asUser(db, sales, () => all("select 1 from audit_logs"))).length).toBe(0);
    expect((await asUser(db, finance, () => all("select 1 from audit_logs"))).length).toBe(0);
    expect((await asUser(db, admin, () => one<{ company_name: string }>("select company_name from business_settings"))).company_name).toBe("SUPER SMART SPORTS");
    const updated = await asUser(db, admin, () => db.query("update business_settings set company_name = 'Hacked' returning 1"));
    expect(updated.rows.length).toBe(0);
  });

  it("an anonymous visitor cannot read anything", async () => {
    await rejects(asAnon(db, () => db.query("select * from customers")));
    await rejects(asAnon(db, () => db.query("select * from inquiries")));
    await rejects(asAnon(db, () => db.query("select * from payments")));
  });

  it("honours per-user permission overrides and stops people changing their own role", async () => {
    const helper = await createUser(db, "sales_manager", "override");
    expect((await asUser(db, helper, () => all("select 1 from customers"))).length).toBe(1);
    await db.query("insert into profile_permissions values ($1, 'customers.read', false)", [helper]);
    expect((await asUser(db, helper, () => all("select 1 from customers"))).length).toBe(0);

    await db.query("insert into profile_permissions values ($1, 'employees.manage', true)", [helper]);
    const msg = await rejects(asUser(db, helper, () => db.query("update profiles set role_id = (select id from roles where key = 'super_admin') where id = $1", [helper])));
    expect(msg).toMatch(/own role/);
  });

  it("deactivated users lose all access", async () => {
    const gone = await createUser(db, "sales_manager", "gone");
    expect((await asUser(db, gone, () => all("select 1 from customers"))).length).toBe(1);
    await db.query("update profiles set is_active = false where id = $1", [gone]);
    expect((await asUser(db, gone, () => all("select 1 from customers"))).length).toBe(0);
  });
});

describe("customers", () => {
  it("prevents duplicate active customers by email and by WhatsApp number", async () => {
    await rejects(db.query("insert into customers (name, email) values ('Dup', 'buyer@example.COM')"));
    await rejects(db.query("insert into customers (name, whatsapp) values ('Dup', '447700900123')"));
  });

  it("allows a new record once the old one is archived", async () => {
    const c = await one<{ id: string }>("insert into customers (name, email) values ('Old', 'reuse@example.com') returning id");
    await db.query("update customers set archived_at = now() where id = $1", [c.id]);
    await db.query("insert into customers (name, email) values ('New', 'reuse@example.com')");
  });

  it("rejects a malformed email", async () => {
    await rejects(db.query("insert into customers (name, email) values ('Bad', 'not-an-email')"));
  });
});

describe("inquiries from the public website", () => {
  it("accepts a valid inquiry from an anonymous visitor and nothing else", async () => {
    const id = await asAnon(db, async () =>
      (await db.query<{ submit_inquiry: string }>("select id as submit_inquiry from submit_inquiry_v2('db-test-0001', 'Ann', 'ann@example.com', null, 'DE', 'FC Test', 'Match football', 500, 'Need logo balls', '{}'::jsonb, 'website')")).rows[0].submit_inquiry,
    );
    expect(id).toMatch(/[0-9a-f-]{36}/);
    expect((await asUser(db, sales, () => all("select 1 from inquiries where id = $1", [id]))).length).toBe(1);
    expect((await asUser(db, finance, () => all("select 1 from inquiries"))).length).toBe(0);
  });

  it("rejects an inquiry with no way to contact the sender", async () => {
    await rejects(asAnon(db, () => db.query("select * from submit_inquiry_v2('db-test-0002', 'Bob', null, null, null, null, null, null, null, '{}'::jsonb)")));
  });

  it("notifies staff who may read inquiries, and only them", async () => {
    expect(num((await one<{ n: number }>("select count(*)::int n from notifications where user_id = $1 and kind = 'new_inquiry'", [sales])).n)).toBeGreaterThan(0);
    expect(num((await one<{ n: number }>("select count(*)::int n from notifications where user_id = $1 and kind = 'new_inquiry'", [finance])).n)).toBe(0);
  });
});

describe("quotations and orders", () => {
  let quotation: string;

  it("computes totals from the items, including tax, discount and shipping", async () => {
    quotation = (await one<{ id: string }>("insert into quotations (customer_id, currency, tax_rate, shipping_charge) values ($1,'USD',10,20) returning id", [customerId])).id;
    await db.query("insert into quotation_items (quotation_id, description, quantity, unit_price) values ($1,'Match football',10,25.50),($1,'Training football',5,10)", [quotation]);
    await db.query("update quotations set discount_amount = 5 where id = $1", [quotation]);
    const q = await one<Record<string, string>>("select subtotal, tax_amount, total from quotations where id = $1", [quotation]);
    expect(num(q.subtotal)).toBe(305);
    expect(num(q.tax_amount)).toBe(30);
    expect(num(q.total)).toBe(350); // 305 - 5 + 20 + 30
  });

  it("rejects a discount larger than the subtotal", async () => {
    await rejects(db.query("update quotations set discount_amount = 99999 where id = $1", [quotation]));
  });

  it("enforces the quotation status flow", async () => {
    await rejects(db.query("update quotations set status = 'accepted' where id = $1", [quotation]));
    await db.query("update quotations set status = 'sent' where id = $1", [quotation]);
    await rejects(db.query("update quotations set status = 'converted' where id = $1", [quotation]));
    await db.query("update quotations set status = 'accepted' where id = $1", [quotation]);
    await rejects(db.query("insert into quotation_items (quotation_id, description, quantity, unit_price) values ($1,'Late addition',1,1)", [quotation]));
  });

  let order: string;
  it("converts an accepted quotation into an order with the same items and totals", async () => {
    await rejects(asUser(db, finance, () => db.query("select convert_quotation_to_order($1)", [quotation])));
    order = await asUser(db, sales, async () => (await db.query<{ convert_quotation_to_order: string }>("select convert_quotation_to_order($1)", [quotation])).rows[0].convert_quotation_to_order);
    const o = await one<Record<string, string>>("select status, subtotal, discount_amount, shipping_charge, tax_amount, total from orders where id = $1", [order]);
    expect(o.status).toBe("quotation_accepted");
    expect(num(o.total)).toBe(350);
    expect(num(o.discount_amount)).toBe(5);
    expect(num((await one<{ n: number }>("select count(*)::int n from order_items where order_id = $1", [order])).n)).toBe(2);
    expect((await one<{ status: string }>("select status from quotations where id = $1", [quotation])).status).toBe("converted");
    await rejects(asUser(db, sales, () => db.query("select convert_quotation_to_order($1)", [quotation])));
  });

  it("only moves along the allowed workflow, and records every change", async () => {
    await rejects(asUser(db, sales, () => db.query("update orders set status = 'shipped' where id = $1", [order])));
    await rejects(asUser(db, sales, () => db.query("select change_order_status($1, 'shipped')", [order])));
    await rejects(asUser(db, finance, () => db.query("select change_order_status($1, 'design_approval')", [order])));
    await asUser(db, sales, () => db.query("select change_order_status($1, 'awaiting_deposit', 'deposit requested')", [order]));
    await asUser(db, sales, () => db.query("select change_order_status($1, 'design_approval')", [order]));
    const history = await all<{ from_status: string | null; to_status: string; changed_by: string }>(
      "select from_status, to_status, changed_by from order_status_history where order_id = $1 order by changed_at, to_status", [order]);
    expect(history.map((h) => h.to_status)).toEqual(expect.arrayContaining(["quotation_accepted", "awaiting_deposit", "design_approval"]));
    expect(history.find((h) => h.to_status === "awaiting_deposit")?.changed_by).toBe(sales);
    await rejects(db.query("update order_status_history set note = 'edited' where order_id = $1", [order]));
    await rejects(db.query("delete from order_status_history where order_id = $1", [order]));
  });

  it("freezes order items once production is under way", async () => {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
    for (const s of ["order_confirmed"]) await asUser(db, owner, () => db.query("select change_order_status($1, $2)", [order, s]));
    await rejects(db.query("insert into order_items (order_id, description, quantity, unit_price) values ($1,'Extra',1,1)", [order]));
  });
});

describe("payments", () => {
  let order: string;
  let first: string;

  it("counts nothing until finance confirms it", async () => {
    order = await newOrder("USD", 10, "35.00"); // total 350
    first = (await one<{ id: string }>(
      "insert into payments (customer_id, order_id, method, reference, amount, currency, order_currency_amount, payment_date) values ($1,$2,'bank_transfer','TT-1',100,'USD',100,current_date) returning id",
      [customerId, order])).id;
    const f = await one<Record<string, string>>("select cash_received, outstanding_balance from v_order_financials where order_id = $1", [order]);
    expect(num(f.cash_received)).toBe(0);
    expect(num(f.outstanding_balance)).toBe(350);
    expect((await one<{ payment_status: string }>("select payment_status from orders where id = $1", [order])).payment_status).toBe("unpaid");
  });

  it("cannot be marked received by editing the row or by the wrong person", async () => {
    await rejects(asUser(db, finance, () => db.query("update payments set status = 'received', received_order_amount = 100 where id = $1", [first])));
    await rejects(asUser(db, finance, () => db.query("insert into payments (customer_id, order_id, method, amount, currency, order_currency_amount, payment_date, status, received_order_amount, confirmed_at) values ($1,$2,'other',10,'USD',10,current_date,'received',10, now())", [customerId, order])));
    await rejects(asUser(db, sales, () => db.query("select confirm_payment($1)", [first])));
    await rejects(asUser(db, production, () => db.query("select confirm_payment($1)", [first])));
  });

  it("tracks a partial receipt, then the rest, without double counting", async () => {
    await asUser(db, finance, () => db.query("select confirm_payment($1, 40)", [first]));
    let f = await one<Record<string, string>>("select cash_received, outstanding_balance from v_order_financials where order_id = $1", [order]);
    expect(num(f.cash_received)).toBe(40);
    expect(num(f.outstanding_balance)).toBe(310);
    expect((await one<{ payment_status: string }>("select payment_status from orders where id = $1", [order])).payment_status).toBe("partial");

    await rejects(asUser(db, finance, () => db.query("select confirm_payment($1)", [first])));   // cannot confirm twice
    const second = (await one<{ id: string }>(
      "insert into payments (customer_id, order_id, method, amount, currency, order_currency_amount, payment_date) values ($1,$2,'western_union',310,'USD',310,current_date) returning id",
      [customerId, order])).id;
    await asUser(db, finance, () => db.query("select confirm_payment($1)", [second]));
    f = await one("select cash_received, outstanding_balance from v_order_financials where order_id = $1", [order]);
    expect(num(f.cash_received)).toBe(350);
    expect(num(f.outstanding_balance)).toBe(0);
    expect((await one<{ payment_status: string }>("select payment_status from orders where id = $1", [order])).payment_status).toBe("paid");
  });

  it("freezes confirmed payments and never deletes any", async () => {
    await rejects(db.query("update payments set amount = 1 where id = $1", [first]));
    await rejects(db.query("delete from payments where id = $1", [first]));
  });

  it("handles a refund as a separate confirmed entry", async () => {
    const refund = (await one<{ id: string }>(
      "insert into payments (customer_id, order_id, kind, method, amount, currency, order_currency_amount, payment_date) values ($1,$2,'refund','bank_transfer',50,'USD',50,current_date) returning id",
      [customerId, order])).id;
    await asUser(db, finance, () => db.query("select confirm_payment($1)", [refund]));
    const f = await one<Record<string, string>>("select cash_received, outstanding_balance from v_order_financials where order_id = $1", [order]);
    expect(num(f.cash_received)).toBe(300);
    expect(num(f.outstanding_balance)).toBe(50);
    expect((await one<{ payment_status: string }>("select payment_status from orders where id = $1", [order])).payment_status).toBe("partial");
  });

  it("keeps the original currency and an explicit rate for foreign payments", async () => {
    const o = await newOrder("USD", 1, "1000.00");
    const p = await one<Record<string, string>>(
      "insert into payments (customer_id, order_id, method, amount, currency, order_currency_amount, fx_rate_to_base, payment_date) values ($1,$2,'bank_transfer',900,'EUR',972,1.08,current_date) returning amount, currency, amount_base, order_currency_amount",
      [customerId, o]);
    expect(p.currency).toBe("EUR");
    expect(num(p.amount)).toBe(900);
    expect(num(p.amount_base)).toBe(972);
  });

  it("rejects impossible payment values", async () => {
    await rejects(db.query("insert into payments (customer_id, order_id, method, amount, currency, order_currency_amount, payment_date) values ($1,$2,'other',-5,'USD',-5,current_date)", [customerId, order]));
    await rejects(db.query("insert into payments (customer_id, order_id, method, amount, currency, order_currency_amount, payment_date) values ($1,$2,'cheque',5,'USD',5,current_date)", [customerId, order]));
  });
});

describe("invoices", () => {
  let order: string, invoice: string;

  it("totals match the order and are computed by the database", async () => {
    order = await newOrder("USD", 4, "50.00"); // 200
    invoice = (await one<{ id: string }>("insert into invoices (order_id, customer_id, currency, tax_rate) values ($1,$2,'USD',5) returning id", [order, customerId])).id;
    await db.query("insert into invoice_items (invoice_id, description, quantity, unit_price) values ($1,'Match football',4,50)", [invoice]);
    const inv = await one<Record<string, string>>("select subtotal, tax_amount, total from invoices where id = $1", [invoice]);
    expect(num(inv.subtotal)).toBe(200);
    expect(num(inv.tax_amount)).toBe(10);
    expect(num(inv.total)).toBe(210);
    expect(num((await one<{ subtotal: string }>("select subtotal from orders where id = $1", [order])).subtotal)).toBe(num(inv.subtotal));
  });

  it("is finalized only by someone allowed, and cannot be finalized by editing the status", async () => {
    await rejects(asUser(db, finance, () => db.query("update invoices set status = 'finalized', finalized_at = now() where id = $1", [invoice])));
    await rejects(asUser(db, sales, () => db.query("select finalize_invoice($1)", [invoice])));
    await asUser(db, finance, () => db.query("select finalize_invoice($1)", [invoice]));
    expect((await one<{ status: string }>("select status from invoices where id = $1", [invoice])).status).toBe("finalized");
  });

  it("protects a finalized invoice and uses adjustments for corrections", async () => {
    await rejects(db.query("update invoices set shipping_charge = 99 where id = $1", [invoice]));
    await rejects(db.query("insert into invoice_items (invoice_id, description, quantity, unit_price) values ($1,'Sneaky',1,1)", [invoice]));
    await rejects(db.query("update invoice_items set unit_price = 1 where invoice_id = $1", [invoice]));
    await rejects(db.query("delete from invoices where id = $1", [invoice]));

    await asUser(db, finance, () => db.query("insert into invoice_adjustments (invoice_id, kind, amount, reason) values ($1,'credit',20,'Damaged panel')", [invoice]));
    const f = await one<Record<string, string>>("select order_total, adjustments, amount_due from v_order_financials where order_id = $1", [order]);
    expect(num(f.adjustments)).toBe(-20);
    expect(num(f.amount_due)).toBe(num(f.order_total) - 20);
    await rejects(db.query("update invoice_adjustments set amount = 1"));
    await rejects(db.query("delete from invoice_adjustments"));
  });

  it("can be voided with a reason, and a void invoice is final", async () => {
    await rejects(db.query("update invoices set status = 'void' where id = $1", [invoice]));
    await db.query("update invoices set status = 'void', void_reason = 'Issued to wrong customer' where id = $1", [invoice]);
    await rejects(db.query("update invoices set notes = 'x' where id = $1", [invoice]));
  });
});

describe("expenses and order costs", () => {
  let order: string, expense: string, category: string;

  it("records an expense with its original currency and rate", async () => {
    order = await newOrder();
    category = (await one<{ id: string }>("select id from expense_categories where key = 'pu_leather'")).id;
    const e = await one<Record<string, string>>(
      "insert into expenses (category_id, expense_date, amount, currency, fx_rate_to_base, description) values ($1, current_date, 28000, 'PKR', 0.0036, 'Leather rolls') returning id, amount_base, currency",
      [category]);
    expense = e.id;
    expect(e.currency).toBe("PKR");
    expect(num(e.amount_base)).toBe(100.8);
  });

  it("never lets one expense be allocated to orders more than once in total", async () => {
    await db.query("insert into order_costs (order_id, cost_class, category, amount, currency, fx_rate_to_base, expense_id) values ($1,'direct','materials',10000,'PKR',0.0036,$2)", [order, expense]); // 36.00
    const other = await newOrder();
    await db.query("insert into order_costs (order_id, cost_class, category, amount, currency, fx_rate_to_base, expense_id) values ($1,'direct','materials',17000,'PKR',0.0036,$2)", [other, expense]); // 61.20 -> 97.20 total
    const msg = await rejects(db.query("insert into order_costs (order_id, cost_class, category, amount, currency, fx_rate_to_base, expense_id) values ($1,'direct','materials',2000,'PKR',0.0036,$2)", [other, expense])); // +7.20 > 100.80? 104.40
    expect(msg).toMatch(/already allocated/);
  });

  it("cannot be edited or deleted, only voided", async () => {
    await rejects(db.query("update expenses set amount = 1 where id = $1", [expense]));
    await rejects(db.query("delete from expenses where id = $1", [expense]));
    await db.query("update expenses set voided_at = now(), voided_by = null, void_reason = 'Entered twice' where id = $1", [expense]);
    await rejects(db.query("update expenses set description = 'x' where id = $1", [expense]));
  });

  it("is invisible to sales and production, and visible to finance", async () => {
    expect((await asUser(db, finance, () => all("select 1 from expenses"))).length).toBeGreaterThan(0);
    expect((await asUser(db, sales, () => all("select 1 from expenses"))).length).toBe(0);
    expect((await asUser(db, production, () => all("select 1 from expenses"))).length).toBe(0);
  });

  it("feeds the order profit view and ignores voided costs", async () => {
    const o = await newOrder("USD", 10, "40.00");
    await db.query("insert into order_costs (order_id, cost_class, category, amount, currency) values ($1,'direct','materials',150,'USD'),($1,'direct','labor',50,'USD'),($1,'additional','shipping',30,'USD')", [o]);
    const bad = await one<{ id: string }>("insert into order_costs (order_id, cost_class, category, amount, currency) values ($1,'direct','other',999,'USD') returning id", [o]);
    await db.query("update order_costs set voided_at = now() where id = $1", [bad.id]);
    const p = await one<Record<string, string>>("select net_sales_revenue, direct_costs_base, additional_costs_base from v_order_profit where order_id = $1", [o]);
    expect(num(p.net_sales_revenue)).toBe(400);
    expect(num(p.direct_costs_base)).toBe(200);
    expect(num(p.additional_costs_base)).toBe(30);
    await rejects(db.query("update order_costs set amount = 1 where id = $1", [bad.id]));
  });
});

describe("manufacturing and quality", () => {
  let order: string;

  it("keeps batches within the ordered quantity", async () => {
    order = await newOrder("USD", 15, "10");
    await asUser(db, production, () => db.query("insert into production_batches (order_id, quantity) values ($1, 10)", [order]));
    await rejects(asUser(db, production, () => db.query("insert into production_batches (order_id, quantity) values ($1, 10)", [order])));
    await asUser(db, production, () => db.query("insert into production_batches (order_id, quantity) values ($1, 5)", [order]));
  });

  it("denies production access to people without it", async () => {
    await rejects(asUser(db, sales, () => db.query("insert into production_batches (order_id, quantity) values ($1, 1)", [order])));
    expect((await asUser(db, employee, () => all("select 1 from production_batches"))).length).toBe(0);
  });

  it("lets an employee see and update only their own task", async () => {
    const batch = (await one<{ id: string }>("select id from production_batches where order_id = $1 limit 1", [order])).id;
    await db.query("insert into production_tasks (batch_id, stage, title, assigned_to) values ($1,'printing','Print logos',$2),($1,'assembly','Assemble',$3)", [batch, employee, production]);
    const visible = await asUser(db, employee, () => all<{ title: string }>("select title from production_tasks"));
    expect(visible.map((t) => t.title)).toEqual(["Print logos"]);
    await asUser(db, employee, () => db.query("update production_tasks set status = 'in_progress' where title = 'Print logos'"));
    await rejects(asUser(db, employee, () => db.query("update production_tasks set title = 'Renamed' where title = 'Print logos'")));
    const none = await asUser(db, employee, () => db.query("update production_tasks set status = 'done', completed_at = now() where title = 'Assemble' returning 1"));
    expect(none.rows.length).toBe(0);
  });

  it("validates quality inspections and alerts the right people on a failure", async () => {
    await rejects(asUser(db, production, () => db.query("insert into quality_inspections (order_id, quantity_inspected, quantity_approved, quantity_rejected, result) values ($1,10,8,1,'pass')", [order])));
    await rejects(asUser(db, production, () => db.query("insert into quality_inspections (order_id, quantity_inspected, quantity_approved, quantity_rejected, result) values ($1,10,8,2,'fail')", [order]))); // no defect text
    await asUser(db, production, () => db.query("insert into quality_inspections (order_id, quantity_inspected, quantity_approved, quantity_rejected, result, defect_description) values ($1,10,8,2,'fail','Seam open')", [order]));
    expect(num((await one<{ n: number }>("select count(*)::int n from notifications where kind = 'inspection_failed' and user_id = $1", [owner])).n)).toBeGreaterThan(0);
    expect(num((await one<{ n: number }>("select count(*)::int n from notifications where kind = 'inspection_failed' and user_id = $1", [finance])).n)).toBe(0);
  });
});

describe("raw materials", () => {
  let material: string;
  it("tracks stock as movements and never lets it go negative", async () => {
    material = (await one<{ id: string }>("insert into materials (name, category, unit, reorder_level) values ('PU leather', 'pu_leather', 'm', 20) returning id")).id;
    await db.query("insert into material_movements (material_id, kind, quantity_delta) values ($1,'purchase',100)", [material]);
    await db.query("insert into material_movements (material_id, kind, quantity_delta) values ($1,'consumption',-30)", [material]);
    expect(num((await one<{ q: string }>("select quantity_on_hand q from v_material_stock where material_id = $1", [material])).q)).toBe(70);
    await rejects(db.query("insert into material_movements (material_id, kind, quantity_delta) values ($1,'consumption',-80)", [material]));
    await rejects(db.query("insert into material_movements (material_id, kind, quantity_delta) values ($1,'adjustment',-1)", [material])); // needs a reason
  });

  it("flags low stock and tells the people who manage materials", async () => {
    await db.query("insert into material_movements (material_id, kind, quantity_delta) values ($1,'consumption',-55)", [material]);
    expect((await one<{ is_low: boolean }>("select is_low from v_material_stock where material_id = $1", [material])).is_low).toBe(true);
    expect(num((await one<{ n: number }>("select count(*)::int n from notifications where kind = 'low_stock' and user_id = $1", [production])).n)).toBeGreaterThan(0);
  });

  it("makes the movement history permanent", async () => {
    await rejects(db.query("update material_movements set quantity_delta = 999"));
    await rejects(db.query("delete from material_movements"));
  });
});

describe("shipping", () => {
  it("requires a carrier name for 'other', a dispatch date once shipped, and a real tracking link", async () => {
    const order = await newOrder();
    await rejects(db.query("insert into shipments (order_id, customer_id, carrier) values ($1,$2,'other')", [order, customerId]));
    await rejects(db.query("insert into shipments (order_id, customer_id, carrier, status) values ($1,$2,'dhl','dispatched')", [order, customerId]));
    await rejects(db.query("insert into shipments (order_id, customer_id, carrier, tracking_url) values ($1,$2,'dhl','javascript:alert(1)')", [order, customerId]));
    await db.query("insert into shipments (order_id, customer_id, carrier, tracking_number, tracking_url, status, dispatch_date) values ($1,$2,'dhl','123','https://example.com/t/123','dispatched',current_date)", [order, customerId]);
  });
});

describe("audit trail", () => {
  it("records changes with before and after values and cannot be altered", async () => {
    const c = await one<{ id: string }>("insert into customers (name) values ('Audited') returning id");
    await db.query("update customers set name = 'Audited Ltd' where id = $1", [c.id]);
    const rows = await all<{ action: string; old_data: { name: string } | null; new_data: { name: string } }>(
      "select action, old_data, new_data from audit_logs where table_name = 'customers' and record_id = $1 order by id", [c.id]);
    expect(rows.map((r) => r.action)).toEqual(["INSERT", "UPDATE"]);
    expect(rows[1].old_data?.name).toBe("Audited");
    expect(rows[1].new_data.name).toBe("Audited Ltd");
    await rejects(db.query("update audit_logs set action = 'DELETE'"));
    await rejects(db.query("delete from audit_logs"));
  });

  it("records who made the change", async () => {
    const id = (await one<{ id: string }>("insert into customers (name) values ('Who') returning id")).id;
    await asUser(db, sales, () => db.query("update customers set notes = 'called' where id = $1", [id]));
    const row = await one<{ actor: string }>("select actor from audit_logs where table_name = 'customers' and record_id = $1 and action = 'UPDATE'", [id]);
    expect(row.actor).toBe(sales);
  });
});

describe("attachments", () => {
  it("follows the permission of the record the file belongs to and limits type and size", async () => {
    const order = await newOrder();
    await asUser(db, sales, () => db.query("insert into attachments (entity_type, entity_id, kind, storage_path, file_name, mime_type, size_bytes) values ('order',$1,'artwork','orders/a.png','a.png','image/png',1000)", [order]));
    await rejects(asUser(db, finance, () => db.query("insert into attachments (entity_type, entity_id, kind, storage_path, file_name, mime_type, size_bytes) values ('order',$1,'artwork','orders/b.png','b.png','image/png',1000)", [order]))); // finance has attachments.write but not orders access: governed by orders.write
    expect((await asUser(db, production, () => all("select 1 from attachments"))).length).toBe(1);
    expect((await asUser(db, employee, () => all("select 1 from attachments"))).length).toBe(0);
    await rejects(db.query("insert into attachments (entity_type, entity_id, storage_path, file_name, mime_type, size_bytes) values ('order',$1,'x.exe','x.exe','application/x-msdownload',10)", [order]));
    await rejects(db.query("insert into attachments (entity_type, entity_id, storage_path, file_name, mime_type, size_bytes) values ('order',$1,'big.pdf','big.pdf','application/pdf',99999999)", [order]));
  });
});

describe("application mirrors of database rules", () => {
  it("the app's permission list is identical to the database's", async () => {
    const { PERMISSION_KEYS } = await import("@/features/auth/permissions");
    const rows = await all<{ key: string }>("select key from permissions order by key");
    expect(rows.map((r) => r.key)).toEqual([...PERMISSION_KEYS].sort());
  });

  it("the app's order workflow is identical to the database's", async () => {
    const { allTransitions } = await import("@/features/orders/workflow");
    const rows = await all<{ t: string }>("select from_status || '>' || to_status as t from order_status_transitions order by 1");
    expect(rows.map((r) => r.t)).toEqual(allTransitions());
  });

  it("the app and the database compute the same totals", async () => {
    const { documentTotals } = await import("@/lib/finance/calculations");
    const { toMinor } = await import("@/lib/finance/money");
    const q = (await one<{ id: string }>("insert into quotations (customer_id, currency, tax_rate, shipping_charge) values ($1,'USD',7.5,12.34) returning id", [customerId])).id;
    await db.query("insert into quotation_items (quotation_id, description, quantity, unit_price) values ($1,'A',7,19.99),($1,'B',3,4.05)", [q]);
    await db.query("update quotations set discount_amount = 3.33 where id = $1", [q]);
    const row = await one<Record<string, string>>("select subtotal, tax_amount, total from quotations where id = $1", [q]);
    const mine = documentTotals([{ quantity: 7, unitPrice: 1999 }, { quantity: 3, unitPrice: 405 }], 333, 1234, 7.5);
    expect(toMinor(row.subtotal)).toBe(mine.subtotal);
    expect(toMinor(row.tax_amount)).toBe(mine.tax);
    expect(toMinor(row.total)).toBe(mine.total);
  });
});

describe("session helpers", () => {
  it("my_access returns the caller's own role and permissions, decided by the database", async () => {
    const me = await asUser(db, finance, () => one<{ role_key: string; permissions: string[] }>("select * from my_access()"));
    expect(me.role_key).toBe("finance_manager");
    expect(me.permissions).toContain("payments.confirm");
    expect(me.permissions).not.toContain("employees.manage");
    const boss = await asUser(db, owner, () => one<{ permissions: string[] }>("select * from my_access()"));
    expect(boss.permissions.length).toBe(num((await one<{ n: number }>("select count(*)::int n from permissions")).n));
  });

  it("dashboard_summary shows each role only its own figures, from real rows", async () => {
    const forOwner = await asUser(db, owner, () => one<{ s: Record<string, unknown> }>("select dashboard_summary() as s"));
    expect(forOwner.s).toHaveProperty("money_by_currency");
    expect(forOwner.s).toHaveProperty("orders");
    const forSales = await asUser(db, sales, () => one<{ s: Record<string, unknown> }>("select dashboard_summary() as s"));
    expect(forSales.s).toHaveProperty("customers");
    expect(forSales.s).not.toHaveProperty("money_by_currency");
    expect(forSales.s).not.toHaveProperty("expenses_base_total");
    const forEmployee = await asUser(db, employee, () => one<{ s: Record<string, unknown> }>("select dashboard_summary() as s"));
    expect(Object.keys(forEmployee.s)).toEqual([]);
    const money = forOwner.s.money_by_currency as { currency: string }[];
    expect(new Set(money.map((m) => m.currency)).size).toBe(money.length); // one row per currency, never mixed
  });
});
