// Checks a REAL Supabase project from the outside, the way a website visitor would reach it.
// Run it on a staging project only: it creates a few clearly marked test rows and removes them again.
// Usage: node --env-file=.env.local scripts/live-check.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local first");

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = createClient(url, anonKey, options);
const service = serviceKey ? createClient(url, serviceKey, options) : null;
const results = [];
const check = async (name, run) => {
  try {
    const detail = await run();
    results.push({ name, ok: true, detail });
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
  }
};
const expect = (condition, message) => { if (!condition) throw new Error(message); };
const stamp = `live-check-${Date.now()}`;

// 1. A visitor can read only what is published.
await check("anonymous cannot read private tables", async () => {
  for (const table of ["customers", "inquiries", "orders", "payments", "invoices", "expenses", "profiles", "audit_logs", "reviews", "products"]) {
    const { data, error } = await anon.from(table).select("*").limit(1);
    expect(error || (data ?? []).length === 0, `${table} returned data to an anonymous visitor`);
  }
  return "10 tables closed";
});
await check("published catalogue is readable", async () => {
  const { data, error } = await anon.from("public_products").select("slug, name, model_path").limit(50);
  expect(!error, error?.message);
  return `${data.length} published products`;
});
await check("public views hide internal columns", async () => {
  const { data } = await anon.from("public_products").select("*").limit(1);
  if (!data?.length) return "no products yet (load database/seed/products.sql)";
  for (const hidden of ["created_by", "is_active", "created_at"]) expect(!(hidden in data[0]), `${hidden} is exposed`);
  return "no internal columns";
});

// 2. The website's front doors.
let inquiryId;
await check("quote request is saved, with a reference", async () => {
  const { data, error } = await anon.rpc("submit_inquiry_v2", {
    p_key: stamp, p_name: "Live Check", p_email: `${stamp}@example.com`, p_whatsapp: null, p_country: "ZZ", p_company: "TEST",
    p_football_type: "Match football", p_quantity: 1, p_message: "Automated check, safe to delete", p_requirements: { test: true }, p_source: "live-check",
  });
  expect(!error, error?.message);
  const row = Array.isArray(data) ? data[0] : data;
  expect(/^INQ-\d{4}-\d{4}$/.test(row.inquiry_number), "no reference returned");
  inquiryId = row.id;
  return row.inquiry_number;
});
await check("the same request sent twice creates one inquiry", async () => {
  const { data, error } = await anon.rpc("submit_inquiry_v2", {
    p_key: stamp, p_name: "Live Check", p_email: `${stamp}@example.com`, p_whatsapp: null, p_country: "ZZ", p_company: "TEST",
    p_football_type: null, p_quantity: null, p_message: null, p_requirements: {}, p_source: "live-check",
  });
  expect(!error, error?.message);
  const row = Array.isArray(data) ? data[0] : data;
  expect(row.duplicate === true && row.id === inquiryId, "a second inquiry was created");
  return "duplicate recognised";
});
await check("old open inquiry function is closed", async () => {
  const { error } = await anon.rpc("submit_inquiry", { p_name: "x", p_email: "a@b.co", p_whatsapp: null, p_country: null, p_company: null, p_football_type: null, p_quantity: null, p_message: null, p_requirements: {} });
  expect(error, "an anonymous visitor could call the old function");
  return "denied";
});
await check("a visitor's review stays hidden until approved", async () => {
  const { error } = await anon.rpc("submit_review", { p_product_slug: null, p_name: "Live Check", p_country: null, p_rating: 5, p_body: `Automated check ${stamp}` });
  expect(!error, error?.message);
  const { data } = await anon.from("public_reviews").select("id").ilike("body", `%${stamp}%`);
  expect((data ?? []).length === 0, "an unapproved review is public");
  return "pending, not public";
});
await check("admin pages need a sign-in function", async () => {
  const { error } = await anon.rpc("dashboard_summary_range", { p_from: "2026-01-01", p_to: "2026-12-31" });
  expect(error, "dashboard data was available without signing in");
  return "denied";
});

// 3. Clean up the test rows (needs the service key).
if (service) {
  await check("test rows removed", async () => {
    await service.from("reviews").delete().ilike("body", `%${stamp}%`);
    await service.from("inquiries").delete().eq("idempotency_key", stamp);
    await service.from("customers").delete().ilike("email", `${stamp}%`);
    return "cleaned";
  });
} else results.push({ name: "test rows removed", ok: false, detail: "no service key: delete rows with email starting " + stamp + " by hand" });

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  (" + r.detail + ")" : ""}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
