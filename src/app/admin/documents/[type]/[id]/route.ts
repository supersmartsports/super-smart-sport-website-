import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { site } from "@/config/site";
import { hasPermission } from "@/features/auth/permissions";
import { createUserClient } from "@/lib/database/server";
import { buildDocumentPdf } from "@/lib/pdf/document";
import { getSessionUser } from "@/server/auth";

type Ctx = { params: Promise<{ type: string; id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Row = Record<string, unknown>;

/** Quotation and invoice PDFs. The data is read as the signed-in user, so row level security decides who may download what. */
export async function GET(_request: Request, { params }: Ctx) {
  const { type, id } = await params;
  const user = await getSessionUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  if ((type !== "quotation" && type !== "invoice") || !UUID.test(id)) return new Response("Not found", { status: 404 });
  const permission = type === "quotation" ? "quotations.read" : "invoices.read";
  if (!hasPermission(user, permission)) return new Response("Forbidden", { status: 403 });

  const supabase = await createUserClient();
  const table = type === "quotation" ? "quotations" : "invoices";
  const itemsTable = type === "quotation" ? "quotation_items" : "invoice_items";
  const fk = type === "quotation" ? "quotation_id" : "invoice_id";
  const { data: doc } = await supabase.from(table).select("*, customers(name, company, email, whatsapp, country, address)").eq("id", id).maybeSingle();
  if (!doc) return new Response("Not found", { status: 404 });
  const { data: items } = await supabase.from(itemsTable).select("description, quantity, unit_price, line_total").eq(fk, id).order("sort_order");
  const { data: settings } = await supabase.from("business_settings").select("*").maybeSingle();

  const d = doc as Row;
  const customer = (Array.isArray(d.customers) ? d.customers[0] : d.customers) as Row | null;
  const logoPng = await readFile(join(process.cwd(), "public", "brand", "logo", "sss-logo-round.png")).catch(() => undefined);
  const companyLines = [settings?.address, settings?.email ?? site.contact.email, settings?.phone ?? site.contact.whatsappDisplay].filter(Boolean).map(String).flatMap((s) => s.split(/\r?\n/));

  // Paid and balance come from the ledger for invoices, never from the invoice row itself.
  let totals: [string, string][] = [["Subtotal", String(d.subtotal)], ["Discount", String(d.discount_amount)], ["Tax", String(d.tax_amount)], ["Shipping", String(d.shipping_charge)], ["Total", String(d.total)]];
  if (type === "invoice" && hasPermission(user, "payments.read")) {
    const { data: fin } = await supabase.from("v_order_financials").select("cash_received, outstanding_balance").eq("order_id", String(d.order_id)).maybeSingle();
    if (fin) totals = [...totals, ["Paid to date", String(fin.cash_received)], ["Balance due", String(fin.outstanding_balance)]];
  }

  const number = String(d.quotation_number ?? d.invoice_number);
  const pdf = await buildDocumentPdf({
    title: type === "quotation" ? "Quotation" : "Invoice",
    number,
    company: { name: String(settings?.company_name ?? site.name), lines: companyLines, logoPng },
    customer: { name: String(customer?.name ?? ""), lines: [customer?.company, customer?.address, customer?.country, customer?.email, customer?.whatsapp].filter(Boolean).map(String) },
    meta: type === "quotation"
      ? [["Date", String(d.created_at).slice(0, 10)], ["Valid until", String(d.valid_until ?? "").slice(0, 10) || "-"], ["Status", String(d.status)], ["Currency", String(d.currency)]]
      : [["Issue date", String(d.issue_date)], ["Due date", String(d.due_date ?? "-")], ["Status", String(d.status)], ["Currency", String(d.currency)]],
    currency: String(d.currency),
    items: ((items ?? []) as Row[]).map((i) => ({ description: String(i.description), quantity: Number(i.quantity), unitPrice: String(i.unit_price), lineTotal: String(i.line_total) })),
    totals,
    notes: type === "quotation"
      ? [{ heading: "Terms", text: String(d.terms ?? "") }]
      : [{ heading: "Notes", text: String(d.notes ?? "") }, { heading: "Payment instructions", text: String(d.payment_instructions ?? settings?.payment_instructions ?? "") }],
    stamp: d.status === "draft" ? "DRAFT" : d.status === "void" ? "VOID" : undefined,
  });

  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${number}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
