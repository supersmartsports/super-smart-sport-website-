import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, createDatabase, createUser, rejects, type Db } from "./helpers/db";

/** The public website's database door: published catalogue, approved reviews, safe inquiry intake. */
let db: Db;
let owner: string, sales: string, finance: string, employee: string;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
const all = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const num = (v: unknown) => Number(v);

beforeAll(async () => {
  db = await createDatabase();
  owner = await createUser(db, "super_admin", "owner");
  sales = await createUser(db, "sales_manager", "sales");
  finance = await createUser(db, "finance_manager", "finance");
  employee = await createUser(db, "employee", "employee");
  await db.query("insert into products (slug, sku, name, panel_count, is_active, featured) values ('live-ball','SSS-1','Live Ball',32,true,true),('draft-ball','SSS-2','Draft Ball',20,false,false)");
});

describe("published catalogue", () => {
  it("shows the public only active products, through a view", async () => {
    const rows = await asAnon(db, () => all<{ slug: string }>("select slug from public_products order by slug"));
    expect(rows.map((r) => r.slug)).toEqual(["live-ball"]);
  });

  it("does not expose internal columns or the underlying table", async () => {
    await rejects(asAnon(db, () => db.query("select * from products")));
    const cols = (await asAnon(db, () => db.query("select * from public_products limit 1"))).fields.map((f) => f.name);
    for (const internal of ["created_by", "is_active", "created_at", "updated_at"]) expect(cols).not.toContain(internal);
  });
});

describe("reviews", () => {
  let reviewId: string;

  it("a visitor's review stays hidden until staff approve it", async () => {
    reviewId = await asAnon(db, async () => (await db.query<{ submit_review: string }>("select submit_review('live-ball','Ann','DE',5,'Great balls')")).rows[0].submit_review);
    expect((await asAnon(db, () => all("select * from public_reviews"))).length).toBe(0);
    expect((await asUser(db, sales, () => all("select status from reviews where id = $1", [reviewId])))[0]).toEqual({ status: "pending" });
  });

  it("appears publicly once approved, with who approved it recorded", async () => {
    await asUser(db, sales, () => db.query("update reviews set status = 'approved' where id = $1", [reviewId]));
    const pub = await asAnon(db, () => all<{ customer_name: string; product_slug: string; rating: number }>("select customer_name, product_slug, rating from public_reviews"));
    expect(pub).toEqual([{ customer_name: "Ann", product_slug: "live-ball", rating: 5 }]);
    const r = await one<{ approved_by: string }>("select approved_by from reviews where id = $1", [reviewId]);
    expect(r.approved_by).toBe(sales);
  });

  it("is hidden again when rejected", async () => {
    await asUser(db, sales, () => db.query("update reviews set status = 'rejected' where id = $1", [reviewId]));
    expect((await asAnon(db, () => all("select * from public_reviews"))).length).toBe(0);
    expect((await one<{ approved_by: string | null }>("select approved_by from reviews where id = $1", [reviewId])).approved_by).toBeNull();
  });

  it("is protected: the public cannot read or change reviews, and only permitted staff can", async () => {
    await rejects(asAnon(db, () => db.query("select * from reviews")));
    await rejects(asAnon(db, () => db.query("update reviews set status = 'approved'")));
    expect((await asUser(db, finance, () => all("select 1 from reviews"))).length).toBe(0);
    expect((await asUser(db, employee, () => all("select 1 from reviews"))).length).toBe(0);
    await rejects(asUser(db, finance, () => db.query("insert into reviews (customer_name, rating, body) values ('x',5,'y')")));
  });

  it("rejects invalid reviews", async () => {
    await rejects(asAnon(db, () => db.query("select submit_review(null,'Ann',null,6,'text')")));
    await rejects(asAnon(db, () => db.query("select submit_review(null,'',null,5,'text')")));
    await rejects(asAnon(db, () => db.query("select submit_review(null,'Ann',null,5,'')")));
  });

  it("ignores an unpublished product slug instead of leaking that it exists", async () => {
    const id = await asAnon(db, async () => (await db.query<{ submit_review: string }>("select submit_review('draft-ball','Bob',null,4,'ok')")).rows[0].submit_review);
    expect((await one<{ product_id: string | null }>("select product_id from reviews where id = $1", [id])).product_id).toBeNull();
  });
});

describe("inquiry intake", () => {
  const submit = (key: string, email: string | null, whatsapp: string | null, name = "Ann") =>
    asAnon(db, async () =>
      (await db.query<{ id: string; inquiry_number: string; duplicate: boolean }>(
        "select * from submit_inquiry_v2($1,$2,$3,$4,'DE','FC Test','Match football',500,'Need logos','{\"design\":\"Hybrid Pro\"}'::jsonb,'website')",
        [key, name, email, whatsapp])).rows[0]);

  it("creates a customer and an inquiry, and returns a reference", async () => {
    const r = await submit("key-0000001", "new.buyer@example.com", null, "New Buyer");
    expect(r.inquiry_number).toMatch(/^INQ-\d{4}-\d{4}$/);
    expect(r.duplicate).toBe(false);
    const inq = await one<{ customer_id: string; source: string }>("select customer_id, source from inquiries where id = $1", [r.id]);
    expect(inq.customer_id).toBeTruthy();
    expect(num((await one<{ n: number }>("select count(*)::int n from customers where lower(email) = 'new.buyer@example.com'")).n)).toBe(1);
  });

  it("returns the first record when the same submission is sent twice", async () => {
    const first = await submit("key-0000002", "twice@example.com", null);
    const again = await submit("key-0000002", "twice@example.com", null);
    expect(again.id).toBe(first.id);
    expect(again.inquiry_number).toBe(first.inquiry_number);
    expect(again.duplicate).toBe(true);
    expect(num((await one<{ n: number }>("select count(*)::int n from inquiries where idempotency_key = 'key-0000002'")).n)).toBe(1);
  });

  it("links a later inquiry to the same customer by email (any case) or WhatsApp digits", async () => {
    const a = await submit("key-0000003", "Repeat@Example.com", "+44 7700 900999");
    const b = await submit("key-0000004", "repeat@example.com", null);
    const c = await submit("key-0000005", null, "447700900999");
    const ids = await all<{ customer_id: string }>("select customer_id from inquiries where id = any($1)", [[a.id, b.id, c.id]]);
    expect(new Set(ids.map((i) => i.customer_id)).size).toBe(1);
    expect(num((await one<{ n: number }>("select count(*)::int n from customers where lower(email) = 'repeat@example.com'")).n)).toBe(1);
  });

  it("rejects bad input and keeps the old unprotected function closed to the public", async () => {
    await rejects(submit("key-0000006", null, null));
    await rejects(submit("key-0000007", "not-an-email", null));
    await rejects(asAnon(db, () => db.query("select submit_inquiry('A','a@b.co',null,null,null,null,null,null,'{}'::jsonb)")));
    expect((await all("select 1 from inquiries where idempotency_key in ('key-0000006','key-0000007')")).length).toBe(0);
  });

  it("staff with inquiry access see it, others do not, and the visitor cannot read anything back", async () => {
    expect((await asUser(db, sales, () => all("select 1 from inquiries"))).length).toBeGreaterThan(0);
    expect((await asUser(db, finance, () => all("select 1 from inquiries"))).length).toBe(0);
    await rejects(asAnon(db, () => db.query("select * from inquiries")));
  });
});

describe("dashboard with a date range", () => {
  it("adds finance only for people who may see finance", async () => {
    const own = await asUser(db, owner, async () => (await db.query<{ s: Record<string, unknown> }>("select dashboard_summary_range('2026-01-01','2026-12-31') as s")).rows[0].s);
    expect(own).toHaveProperty("finance");
    expect(own).toHaveProperty("inquiries_in_range");
    const sl = await asUser(db, sales, async () => (await db.query<{ s: Record<string, unknown> }>("select dashboard_summary_range('2026-01-01','2026-12-31') as s")).rows[0].s);
    expect(sl).not.toHaveProperty("finance");
    expect(sl).toHaveProperty("orders_in_range");
    await rejects(asAnon(db, () => db.query("select dashboard_summary_range('2026-01-01','2026-12-31')")));
  });
});

describe('catalogue seed', () => {
  it('loads the real catalogue and publishes all of it, with 3D model files', async () => {
    const { readFileSync } = await import('node:fs');
    const fresh = await createDatabase();
    await fresh.exec(readFileSync('database/seed/products.sql', 'utf8'));
    await fresh.exec(readFileSync('database/seed/products.sql', 'utf8')); // running it twice changes nothing
    const rows = (await fresh.query<{ slug: string; model_path: string; featured: boolean }>('select slug, model_path, featured from products order by sort_order')).rows;
    expect(rows).toHaveLength(20);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(20);
    for (const r of rows) expect(r.model_path).toMatch(/^\/models\/footballs\/.+\.glb$/);
    expect(rows.filter((r) => r.featured).length).toBe(6);
  });
});
