import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { MODULES } from "@/features/admin/modules";
import { csvCell, parseForm, safeSearchTerm, toCsv } from "@/features/admin/schema";
import { ADMIN_MODULES, PERMISSION_KEYS } from "@/features/auth/permissions";
import { buildDocumentPdf, safe } from "@/lib/pdf/document";
import { resolveRange } from "@/lib/utilities/date-range";

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(entries)) data.set(k, v);
  return data;
};

describe("module configuration", () => {
  it("every module is reachable from the sidebar and guarded by real permissions", () => {
    const hrefs = new Set(ADMIN_MODULES.map((m) => m.href));
    for (const [slug, config] of Object.entries(MODULES)) {
      expect(hrefs.has(`/admin/${slug}`), slug).toBe(true);
      expect(PERMISSION_KEYS).toContain(config.read);
      if (config.write) expect(PERMISSION_KEYS).toContain(config.write);
      for (const child of config.children ?? []) {
        expect(PERMISSION_KEYS).toContain(child.read);
        if (child.write) expect(PERMISSION_KEYS).toContain(child.write);
      }
      for (const action of config.actions ?? []) expect(PERMISSION_KEYS).toContain(action.permission);
    }
  });

  it("covers every sidebar module (profit and reports have their own pages)", () => {
    const own = new Set(["overview", "profit", "reports"]);
    for (const module of ADMIN_MODULES.filter((m) => !own.has(m.key))) {
      expect(MODULES[module.href.replace("/admin/", "")], module.key).toBeDefined();
    }
  });

  it("never lets a form edit the ledger columns that the database freezes", () => {
    const payment = MODULES.payments.fields.filter((f) => !f.createOnly).map((f) => f.name);
    for (const frozen of ["amount", "status", "received_order_amount", "confirmed_at"]) expect(payment).not.toContain(frozen);
    const expense = MODULES.expenses.fields.filter((f) => !f.createOnly).map((f) => f.name);
    expect(expense).not.toContain("amount");
    const everything = Object.values(MODULES).flatMap((m) => m.fields.map((f) => f.name));
    for (const forbidden of ["status", "confirmed_at", "finalized_at", "payment_status"]) expect(everything).not.toContain(forbidden);
  });
});

describe("form parsing", () => {
  const fields = MODULES.customers.fields;

  it("accepts good input and cleans it", () => {
    const { values, errors } = parseForm(fields, form({ name: "  Ann  ", email: "ANN@Example.com", whatsapp: "+44 7700 900123", customer_type: "club" }), "create");
    expect(errors).toEqual({});
    expect(values.name).toBe("Ann");
    expect(values.email).toBe("ann@example.com");
    expect(values.company).toBeNull();
  });

  it("reports what is wrong, field by field", () => {
    const { errors } = parseForm(fields, form({ name: "", email: "nope", whatsapp: "abc", customer_type: "wizard" }), "create");
    expect(Object.keys(errors).sort()).toEqual(["customer_type", "email", "name", "whatsapp"]);
  });

  it("ignores fields the form does not define, so extra columns cannot be set", () => {
    const { values } = parseForm(fields, form({ name: "Ann", archived_at: "2020-01-01", id: "x", role_id: "y" }), "create");
    expect(Object.keys(values)).not.toContain("archived_at");
    expect(Object.keys(values)).not.toContain("id");
  });

  it("validates money, dates and dropdowns", () => {
    const f = MODULES.payments.fields;
    const good = { order_id: "7b0c3a4e-8f2a-4b5e-9d1c-2a3b4c5d6e7f", method: "bank_transfer", amount: "125.50", currency: "USD", order_currency_amount: "125.50", payment_date: "2026-03-25", kind: "payment" };
    expect(parseForm(f, form(good), "create").errors).toEqual({});
    const bad = parseForm(f, form({ ...good, order_id: "not-a-uuid", method: "crypto", amount: "12.345", currency: "XXX", order_currency_amount: "-1", payment_date: "25/03/2026" }), "create");
    expect(Object.keys(bad.errors).sort()).toEqual(["amount", "currency", "method", "order_currency_amount", "order_id", "payment_date"]);
  });

  it("skips create-only fields when updating", () => {
    const { values } = parseForm(MODULES.expenses.fields, form({ amount: "5" }), "update");
    expect(Object.keys(values)).not.toContain("amount");
  });
});

describe("csv export", () => {
  it("quotes values and neutralises spreadsheet formulas", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-12.50")).toBe("-12.50"); // a real negative number stays a number
    expect(csvCell(null)).toBe("");
    expect(toCsv(["a", "b"], [["1", "x,y"]])).toBe('a,b\r\n1,"x,y"\r\n');
  });

  it("keeps search terms from altering database filters", () => {
    expect(safeSearchTerm("a),status.eq.paid,(b")).not.toMatch(/[(),]/);
    expect(safeSearchTerm("  O'Brien  Ltd ")).toBe("O Brien Ltd");
    expect(safeSearchTerm("x".repeat(300)).length).toBe(80);
  });
});

describe("date ranges", () => {
  const now = new Date("2026-03-15T10:00:00Z");
  it("resolves every preset", () => {
    expect(resolveRange("today", undefined, undefined, now)).toMatchObject({ from: "2026-03-15", to: "2026-03-15" });
    expect(resolveRange("last7", undefined, undefined, now)).toMatchObject({ from: "2026-03-09", to: "2026-03-15" });
    expect(resolveRange("last30", undefined, undefined, now)).toMatchObject({ from: "2026-02-14", to: "2026-03-15" });
    expect(resolveRange("this_month", undefined, undefined, now)).toMatchObject({ from: "2026-03-01", to: "2026-03-31" });
    expect(resolveRange("last_month", undefined, undefined, now)).toMatchObject({ from: "2026-02-01", to: "2026-02-28" });
    expect(resolveRange("this_year", undefined, undefined, now)).toMatchObject({ from: "2026-01-01", to: "2026-12-31" });
  });

  it("accepts a valid custom range and falls back safely otherwise", () => {
    expect(resolveRange("custom", "2026-01-05", "2026-02-10", now)).toMatchObject({ preset: "custom", from: "2026-01-05", to: "2026-02-10" });
    expect(resolveRange("custom", "2026-02-10", "2026-01-05", now).preset).toBe("this_month");
    expect(resolveRange("custom", "garbage", "2026-01-05", now).preset).toBe("this_month");
    expect(resolveRange(undefined, undefined, undefined, now).preset).toBe("this_month");
  });

  it("handles a leap-year February", () => {
    expect(resolveRange("last_month", undefined, undefined, new Date("2028-03-10T00:00:00Z")).to).toBe("2028-02-29");
  });
});

describe("pdf documents", () => {
  it("builds a valid multi-page PDF for a long invoice", async () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      description: `Custom match football ${i + 1} with printed club logo on every panel`, quantity: 10, unitPrice: "25.50", lineTotal: "255.00",
    }));
    const bytes = await buildDocumentPdf({
      title: "Invoice", number: "INV-2026-0001", company: { name: "SUPER SMART SPORTS", lines: ["Pakistan"] }, customer: { name: "Buyer", lines: ["Germany"] },
      meta: [["Issue date", "2026-03-01"]], currency: "USD", items, totals: [["Subtotal", "15300.00"], ["Total", "15300.00"], ["Balance due", "15300.00"]],
      notes: [{ heading: "Payment instructions", text: "Bank transfer.\nQuote the invoice number." }], stamp: "DRAFT",
    });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBeGreaterThan(1);
    expect(loaded.getTitle()).toBe("Invoice INV-2026-0001");
  });

  it("replaces characters the PDF fonts cannot draw instead of failing", async () => {
    expect(safe("Zürich ✓ 北京")).toBe("Zürich ? ??");
    const bytes = await buildDocumentPdf({
      title: "Quotation", number: "QT-1", company: { name: "A ✓", lines: [] }, customer: { name: "北京", lines: [] }, meta: [], currency: "USD", items: [], totals: [["Total", "0.00"]], notes: [],
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
