import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/features/orders/workflow";
import type { Child, Column, Field, Filter, ModuleConfig, Option, Related } from "./types";

/** Currencies offered in forms. Add more here; every amount still stores its own currency. */
export const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR", "CAD", "AUD", "PKR"];

const human = (value: string) => value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const opts = (values: readonly string[], labels: Record<string, string> = {}): Option[] =>
  values.map((value) => ({ value, label: labels[value] ?? human(value) }));
const filter = (name: string, label: string, column: string, values: readonly string[]): Filter => ({ name, label, column, options: opts(values) });

const currency: Field = { name: "currency", label: "Currency", type: "select", required: true, options: CURRENCIES.map((c) => ({ value: c, label: c })), default: "USD" };
const customerField: Field = { name: "customer_id", label: "Customer", type: "relation", required: true, relation: { table: "customers", label: "name" } };
const orderField: Field = { name: "order_id", label: "Order", type: "relation", required: true, relation: { table: "orders", label: "order_number" } };
const footballType = opts(["match", "training", "futsal", "other"]);
const construction = opts(["stitched", "thermo_bonded", "hybrid", "other"]);

/** Line items are the same shape on quotations and orders. */
const itemFields: Field[] = [
  { name: "description", label: "Description", type: "text", required: true, max: 300 },
  { name: "football_type", label: "Football type", type: "select", options: footballType },
  { name: "quantity", label: "Quantity", type: "number", required: true },
  { name: "unit_price", label: "Unit price", type: "money", required: true },
  { name: "size", label: "Size", type: "text", max: 40 },
  { name: "material", label: "Material", type: "text", max: 120 },
  { name: "construction", label: "Construction", type: "select", options: construction },
  { name: "panel_count", label: "Panels", type: "number" },
  { name: "logo_requirements", label: "Logo requirements", type: "textarea", max: 2000 },
  { name: "colors", label: "Colours", type: "text", max: 300 },
  { name: "printing_requirements", label: "Printing", type: "textarea", max: 2000 },
];
const itemColumns: Column[] = [
  { key: "description", label: "Item" },
  { key: "quantity", label: "Qty", format: "number" },
  { key: "unit_price", label: "Unit price", format: "money" },
  { key: "line_total", label: "Line total", format: "money" },
];

const documentMoneyFields: Field[] = [
  currency,
  { name: "discount_amount", label: "Discount", type: "money", default: 0, help: "Set after the items are added: a discount cannot exceed the subtotal." },
  { name: "shipping_charge", label: "Shipping charge", type: "money", default: 0 },
  { name: "tax_rate", label: "Tax rate (%)", type: "number", default: 0 },
];

const quotationNext: Record<string, string[]> = {
  draft: ["sent"],
  sent: ["under_discussion", "accepted", "rejected", "expired"],
  under_discussion: ["accepted", "rejected", "expired"],
};
const allInquiry = ["new", "contacted", "negotiating", "quotation_sent", "converted", "lost"];

const customerRelated = (key: string, label: string, table: string, module: string, read: ModuleConfig["read"], columns: Column[]): Related =>
  ({ key, label, table, fk: "customer_id", read, module, columns });
const orderRelated = (key: string, label: string, table: string, module: string, read: ModuleConfig["read"], columns: Column[]): Related =>
  ({ key, label, table, fk: "order_id", read, module, columns });

export const MODULES: Record<string, ModuleConfig> = {
  customers: {
    slug: "customers", label: "Customers", singular: "customer", table: "customers", select: "*", titleKey: "name",
    columns: [
      { key: "customer_code", label: "Code", link: true }, { key: "name", label: "Name" }, { key: "company", label: "Company" },
      { key: "country", label: "Country" }, { key: "customer_type", label: "Type", format: "status" }, { key: "created_at", label: "Added", format: "date" },
    ],
    search: ["name", "company", "email", "customer_code", "country", "whatsapp"],
    filters: [filter("type", "Type", "customer_type", ["brand", "club", "academy", "distributor", "individual", "other"])],
    order: { column: "created_at", ascending: false }, baseFilter: { column: "archived_at", isNull: true },
    read: "customers.read", write: "customers.write", exportPermission: "customers.export",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, max: 200 },
      { name: "company", label: "Company", type: "text", max: 200 },
      { name: "email", label: "Email", type: "email", max: 254 },
      { name: "whatsapp", label: "WhatsApp", type: "tel", max: 40, help: "Include the country code." },
      { name: "country", label: "Country", type: "text", max: 100 },
      { name: "address", label: "Address", type: "textarea", max: 1000 },
      { name: "customer_type", label: "Customer type", type: "select", options: opts(["brand", "club", "academy", "distributor", "individual", "other"]), default: "other" },
      { name: "source", label: "Source", type: "select", options: opts(["website", "whatsapp", "instagram", "facebook", "threads", "linkedin", "tiktok", "referral", "other"]), default: "other" },
      { name: "notes", label: "Notes", type: "textarea", max: 4000 },
    ],
    actions: [{ type: "update", label: "Archive customer", set: { archived_at: "now" }, permission: "customers.archive", when: (r) => !r.archived_at, confirm: "Archive this customer? Their orders and payments stay on record." }],
    children: [{ key: "notes", label: "Internal notes", table: "customer_notes", fk: "customer_id", read: "customers.read", write: "customers.write",
      columns: [{ key: "body", label: "Note" }, { key: "created_at", label: "When", format: "datetime" }],
      fields: [{ name: "body", label: "Add a note", type: "textarea", required: true, max: 4000 }], order: { column: "created_at", ascending: false } }],
    related: [
      customerRelated("quotes", "Quotations", "quotations", "quotations", "quotations.read", [{ key: "quotation_number", label: "Number", link: true }, { key: "status", label: "Status", format: "status" }, { key: "total", label: "Total", format: "money", currencyKey: "currency" }]),
      customerRelated("orders", "Orders", "orders", "orders", "orders.read", [{ key: "order_number", label: "Number", link: true }, { key: "status", label: "Status", format: "status" }, { key: "total", label: "Total", format: "money", currencyKey: "currency" }, { key: "payment_status", label: "Payment", format: "status" }]),
      customerRelated("payments", "Payments", "payments", "payments", "payments.read", [{ key: "payment_number", label: "Number", link: true }, { key: "amount", label: "Amount", format: "money", currencyKey: "currency" }, { key: "status", label: "Status", format: "status" }, { key: "payment_date", label: "Date", format: "date" }]),
    ],
  },

  inquiries: {
    slug: "inquiries", label: "Inquiries", singular: "inquiry", table: "inquiries", select: "*, profiles:assigned_to(full_name)", titleKey: "inquiry_number",
    columns: [
      { key: "inquiry_number", label: "Number", link: true }, { key: "name", label: "From" }, { key: "country", label: "Country" },
      { key: "football_type", label: "Football" }, { key: "quantity", label: "Qty", format: "number" }, { key: "status", label: "Status", format: "status" },
      { key: "profiles.full_name", label: "Assigned to" }, { key: "created_at", label: "Received", format: "date" },
    ],
    search: ["name", "email", "company", "inquiry_number", "country", "message"],
    filters: [filter("status", "Status", "status", allInquiry)],
    order: { column: "created_at", ascending: false }, read: "inquiries.read", write: "inquiries.write",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, max: 200 }, { name: "company", label: "Company", type: "text", max: 200 },
      { name: "email", label: "Email", type: "email", max: 254 }, { name: "whatsapp", label: "WhatsApp", type: "tel", max: 40 },
      { name: "country", label: "Country", type: "text", max: 100 }, { name: "football_type", label: "Football type", type: "text", max: 100 },
      { name: "quantity", label: "Quantity", type: "number" }, { name: "message", label: "Message", type: "textarea", max: 5000 },
      { name: "assigned_to", label: "Assigned to", type: "relation", relation: { table: "profiles", label: "full_name" } },
      { name: "follow_up_date", label: "Follow-up date", type: "date" },
    ],
    actions: [{ type: "status", label: "Move to", column: "status", next: (r) => allInquiry.filter((s) => s !== r.status), permission: "inquiries.write" }],
    children: [{ key: "activity", label: "Communication history", table: "inquiry_activities", fk: "inquiry_id", read: "inquiries.read", write: "inquiries.write",
      columns: [{ key: "kind", label: "Type", format: "status" }, { key: "body", label: "Note" }, { key: "created_at", label: "When", format: "datetime" }],
      fields: [{ name: "kind", label: "Type", type: "select", required: true, options: opts(["note", "call", "email", "whatsapp"]), default: "note" }, { name: "body", label: "Details", type: "textarea", required: true, max: 4000 }],
      order: { column: "created_at", ascending: false } }],
  },

  quotations: {
    slug: "quotations", label: "Quotations", singular: "quotation", table: "quotations", select: "*, customers(name)", titleKey: "quotation_number", detail: "quotation",
    columns: [
      { key: "quotation_number", label: "Number", link: true }, { key: "customers.name", label: "Customer" }, { key: "status", label: "Status", format: "status" },
      { key: "total", label: "Total", format: "money", currencyKey: "currency" }, { key: "valid_until", label: "Valid until", format: "date" }, { key: "created_at", label: "Created", format: "date" },
    ],
    search: ["quotation_number"], filters: [filter("status", "Status", "status", ["draft", "sent", "under_discussion", "accepted", "rejected", "expired", "converted"])],
    order: { column: "created_at", ascending: false }, read: "quotations.read", write: "quotations.write",
    fields: [customerField, ...documentMoneyFields, { name: "valid_until", label: "Valid until", type: "date" }, { name: "terms", label: "Terms", type: "textarea", max: 4000 }, { name: "internal_notes", label: "Internal notes", type: "textarea", max: 4000 }],
    actions: [
      { type: "status", label: "Mark as", column: "status", next: (r) => quotationNext[String(r.status)] ?? [], permission: "quotations.write" },
      { type: "rpc", label: "Convert to order", rpc: "convert_quotation_to_order", idArg: "p_quotation", permission: "quotations.convert", when: (r) => r.status === "accepted" },
    ],
    children: [{ key: "items", label: "Items", table: "quotation_items", fk: "quotation_id", read: "quotations.read", write: "quotations.write", columns: itemColumns, fields: itemFields, canDelete: true,
      order: { column: "sort_order", ascending: true }, editableWhen: (r) => ["draft", "sent", "under_discussion"].includes(String(r.status)) }],
  },

  orders: {
    slug: "orders", label: "Orders", singular: "order", table: "orders", select: "*, customers(name)", titleKey: "order_number", detail: "order",
    columns: [
      { key: "order_number", label: "Number", link: true }, { key: "customers.name", label: "Customer" }, { key: "status", label: "Status", format: "status" },
      { key: "total", label: "Total", format: "money", currencyKey: "currency" }, { key: "payment_status", label: "Payment", format: "status" },
      { key: "production_status", label: "Production", format: "status" }, { key: "expected_delivery", label: "Due", format: "date" },
    ],
    search: ["order_number"], filters: [filter("status", "Status", "status", ORDER_STATUSES), filter("payment", "Payment", "payment_status", ["unpaid", "partial", "paid", "overpaid"])],
    order: { column: "created_at", ascending: false }, read: "orders.read", write: "orders.write",
    fields: [
      { ...customerField, createOnly: true }, ...documentMoneyFields,
      { name: "fx_rate_to_base", label: "Exchange rate to reporting currency", type: "number", default: 1, help: "Required before confirming an order in a foreign currency." },
      { name: "expected_delivery", label: "Expected delivery", type: "date" }, { name: "internal_notes", label: "Internal notes", type: "textarea", max: 4000 },
    ],
    actions: [{ type: "order_status", permission: "orders.update_status" }],
    children: [
      { key: "items", label: "Items", table: "order_items", fk: "order_id", read: "orders.read", write: "orders.write", columns: itemColumns, fields: itemFields, canDelete: true,
        order: { column: "sort_order", ascending: true }, editableWhen: (r) => ["new_inquiry", "quotation_prepared", "quotation_accepted", "awaiting_deposit", "design_approval"].includes(String(r.status)) },
      { key: "costs", label: "Order costs", table: "order_costs", fk: "order_id", read: "finance.read", write: "finance.write",
        columns: [{ key: "cost_class", label: "Class", format: "status" }, { key: "category", label: "Category", format: "status" }, { key: "amount", label: "Amount", format: "money", currencyKey: "currency" }, { key: "amount_base", label: "In reporting currency", format: "money" }],
        fields: [
          { name: "cost_class", label: "Class", type: "select", required: true, options: opts(["direct", "additional"]), default: "direct", help: "Direct = making the football. Additional = shipping paid, payment fees, other." },
          { name: "category", label: "Category", type: "select", required: true, options: opts(["materials", "labor", "printing", "stitching_bonding", "packaging", "shipping", "payment_fees", "other"]) },
          { name: "description", label: "Description", type: "text", max: 300 }, { name: "amount", label: "Amount", type: "money", required: true }, currency,
          { name: "fx_rate_to_base", label: "Rate to reporting currency", type: "number", default: 1 },
          { name: "expense_id", label: "From expense (optional)", type: "relation", relation: { table: "expenses", label: "expense_number" }, help: "Takes this cost from a recorded expense without counting it twice." },
        ] },
    ],
    related: [
      orderRelated("payments", "Payments", "payments", "payments", "payments.read", [{ key: "payment_number", label: "Number", link: true }, { key: "kind", label: "Type", format: "status" }, { key: "amount", label: "Amount", format: "money", currencyKey: "currency" }, { key: "status", label: "Status", format: "status" }]),
      orderRelated("invoices", "Invoices", "invoices", "invoices", "invoices.read", [{ key: "invoice_number", label: "Number", link: true }, { key: "status", label: "Status", format: "status" }, { key: "total", label: "Total", format: "money", currencyKey: "currency" }]),
      orderRelated("batches", "Production batches", "production_batches", "production", "production.read", [{ key: "batch_number", label: "Batch", link: true }, { key: "quantity", label: "Qty", format: "number" }, { key: "status", label: "Status", format: "status" }]),
      orderRelated("shipments", "Shipments", "shipments", "shipping", "shipping.read", [{ key: "shipment_number", label: "Shipment", link: true }, { key: "carrier", label: "Carrier", format: "status" }, { key: "status", label: "Status", format: "status" }]),
    ],
  },

  production: {
    slug: "production", label: "Production", singular: "batch", table: "production_batches", select: "*, orders(order_number)", titleKey: "batch_number",
    columns: [
      { key: "batch_number", label: "Batch", link: true }, { key: "orders.order_number", label: "Order" }, { key: "quantity", label: "Qty", format: "number" },
      { key: "status", label: "Status", format: "status" }, { key: "current_stage", label: "Stage", format: "status" }, { key: "planned_end", label: "Planned end", format: "date" },
    ],
    search: ["batch_number"], filters: [filter("status", "Status", "status", ["waiting", "materials_preparation", "in_production", "quality_check", "rework_required", "approved", "completed"])],
    order: { column: "created_at", ascending: false }, read: "production.read", write: "production.write",
    fields: [
      { ...orderField, createOnly: true }, { name: "quantity", label: "Quantity to manufacture", type: "number", required: true },
      { name: "current_stage", label: "Current stage", type: "select", options: opts(["panel_preparation", "printing", "stitching_or_bonding", "assembly", "quality_inspection", "final_approval"]), default: "panel_preparation" },
      { name: "planned_start", label: "Planned start", type: "date" }, { name: "planned_end", label: "Planned end", type: "date" },
      { name: "assigned_to", label: "Assigned to", type: "relation", relation: { table: "profiles", label: "full_name" } }, { name: "notes", label: "Notes", type: "textarea", max: 4000 },
    ],
    actions: [{ type: "update", label: "Mark completed", set: { status: "completed", completed_at: "now" }, permission: "production.write", when: (r) => r.status === "approved", confirm: "Mark this batch completed?" },
      { type: "status", label: "Move to", column: "status", next: (r) => ["waiting", "materials_preparation", "in_production", "quality_check", "rework_required", "approved"].filter((s) => s !== r.status && r.status !== "completed"), permission: "production.write" }],
    children: [{ key: "tasks", label: "Tasks", table: "production_tasks", fk: "batch_id", read: "production.read", write: "production.write",
      columns: [{ key: "stage", label: "Stage", format: "status" }, { key: "title", label: "Task" }, { key: "status", label: "Status", format: "status" }, { key: "due_date", label: "Due", format: "date" }],
      fields: [
        { name: "stage", label: "Stage", type: "select", required: true, options: opts(["panel_preparation", "printing", "stitching_or_bonding", "assembly", "quality_inspection", "final_approval"]) },
        { name: "title", label: "Task", type: "text", required: true, max: 200 }, { name: "assigned_to", label: "Assigned to", type: "relation", relation: { table: "profiles", label: "full_name" } },
        { name: "due_date", label: "Due date", type: "date" },
      ] }],
  },

  quality: {
    slug: "quality", label: "Quality Control", singular: "inspection", table: "quality_inspections", select: "*, orders(order_number)", titleKey: "inspection_number",
    columns: [
      { key: "inspection_number", label: "Inspection", link: true }, { key: "orders.order_number", label: "Order" }, { key: "inspected_on", label: "Date", format: "date" },
      { key: "quantity_inspected", label: "Inspected", format: "number" }, { key: "quantity_approved", label: "Approved", format: "number" }, { key: "quantity_rejected", label: "Rejected", format: "number" }, { key: "result", label: "Result", format: "status" },
    ],
    search: ["inspection_number"], filters: [filter("result", "Result", "result", ["pass", "fail", "rework"])],
    order: { column: "inspected_on", ascending: false }, read: "quality.read", write: "quality.write",
    fields: [
      { ...orderField, createOnly: true }, { name: "batch_id", label: "Batch (optional)", type: "relation", relation: { table: "production_batches", label: "batch_number" }, createOnly: true },
      { name: "inspected_on", label: "Inspection date", type: "date", default: "today" },
      { name: "quantity_inspected", label: "Quantity inspected", type: "number", required: true, createOnly: true },
      { name: "quantity_approved", label: "Quantity approved", type: "number", required: true, createOnly: true },
      { name: "quantity_rejected", label: "Quantity rejected", type: "number", required: true, createOnly: true, help: "Approved plus rejected must equal inspected." },
      { name: "result", label: "Result", type: "select", required: true, options: opts(["pass", "fail", "rework"]), createOnly: true },
      { name: "defect_description", label: "Defect description", type: "textarea", max: 4000, help: "Required unless the result is pass." }, { name: "notes", label: "Notes", type: "textarea", max: 4000 },
    ],
  },

  products: {
    slug: "products", label: "Products", singular: "product", table: "products", select: "*", titleKey: "name",
    columns: [{ key: "sku", label: "SKU", link: true }, { key: "name", label: "Name" }, { key: "panel_count", label: "Panels", format: "number" }, { key: "construction", label: "Construction" }, { key: "is_active", label: "Active", format: "boolean" }],
    search: ["name", "sku", "slug"], order: { column: "sort_order", ascending: true }, read: "products.read", write: "products.write",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, max: 200 }, { name: "sku", label: "SKU", type: "text", required: true, max: 60 },
      { name: "slug", label: "URL slug", type: "text", required: true, max: 80, help: "Lowercase letters, numbers and hyphens." },
      { name: "panel_count", label: "Panels", type: "number" }, { name: "construction", label: "Construction", type: "text", max: 100 }, { name: "material", label: "Material", type: "text", max: 100 },
      { name: "description", label: "Description", type: "textarea", max: 2000 }, { name: "model_path", label: "3D model path", type: "text", max: 300 }, { name: "poster_path", label: "Poster image path", type: "text", max: 300 },
      { name: "featured", label: "Show on the homepage", type: "checkbox", default: false },
      { name: "sort_order", label: "Display order (lowest first)", type: "number", default: 0 },
      { name: "is_active", label: "Published on the website", type: "checkbox", default: true, help: "Unpublished products are not shown to the public." },
    ],
  },

  reviews: {
    slug: "reviews", label: "Reviews", singular: "review", table: "reviews", select: "*, products(name)", titleKey: "customer_name",
    columns: [
      { key: "customer_name", label: "Customer", link: true }, { key: "country", label: "Country" }, { key: "products.name", label: "Football" },
      { key: "rating", label: "Rating", format: "number" }, { key: "status", label: "Status", format: "status" }, { key: "created_at", label: "Received", format: "date" },
    ],
    search: ["customer_name", "body"], filters: [filter("status", "Status", "status", ["pending", "approved", "rejected"])],
    order: { column: "created_at", ascending: false }, read: "reviews.read", write: "reviews.write",
    fields: [
      { name: "customer_name", label: "Customer name", type: "text", required: true, max: 120 }, { name: "country", label: "Country", type: "text", max: 100 },
      { name: "product_id", label: "Football (optional)", type: "relation", relation: { table: "products", label: "name" } },
      { name: "rating", label: "Rating", type: "select", required: true, options: ["1", "2", "3", "4", "5"].map((v) => ({ value: v, label: v + " of 5" })) },
      { name: "body", label: "Review", type: "textarea", required: true, max: 2000, help: "Only add a review a real customer has given you permission to publish." },
    ],
    actions: [{ type: "status", label: "Set status", column: "status", next: (r) => ["pending", "approved", "rejected"].filter((s) => s !== r.status), permission: "reviews.write" }],
  },

  materials: {
    slug: "materials", label: "Raw Materials", singular: "material", table: "materials", select: "*, suppliers(name)", titleKey: "name",
    columns: [{ key: "name", label: "Material", link: true }, { key: "category", label: "Category", format: "status" }, { key: "suppliers.name", label: "Supplier" }, { key: "unit", label: "Unit" }, { key: "reorder_level", label: "Reorder level", format: "number" }],
    search: ["name"], filters: [filter("category", "Category", "category", ["pu_leather", "tpu", "fabric", "lining", "bladder", "ink", "thread", "adhesive", "packaging", "other"])],
    order: { column: "name", ascending: true }, read: "materials.read", write: "materials.write",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, max: 200 },
      { name: "category", label: "Category", type: "select", required: true, options: opts(["pu_leather", "tpu", "fabric", "lining", "bladder", "ink", "thread", "adhesive", "packaging", "other"]) },
      { name: "supplier_id", label: "Supplier", type: "relation", relation: { table: "suppliers", label: "name" } }, { name: "unit", label: "Unit", type: "text", required: true, max: 20, help: "For example m, kg, litre, piece." },
      { name: "purchase_price", label: "Purchase price per unit", type: "number" }, currency, { name: "reorder_level", label: "Reorder level", type: "number", default: 0 },
      { name: "storage_location", label: "Storage location", type: "text", max: 120 }, { name: "is_active", label: "Active", type: "checkbox", default: true },
    ],
    children: [{ key: "movements", label: "Stock movements", table: "material_movements", fk: "material_id", read: "materials.read", write: "materials.write",
      columns: [{ key: "kind", label: "Type", format: "status" }, { key: "quantity_delta", label: "Change", format: "number" }, { key: "reason", label: "Reason" }, { key: "created_at", label: "When", format: "datetime" }],
      fields: [
        { name: "kind", label: "Type", type: "select", required: true, options: opts(["purchase", "consumption", "adjustment", "return_to_supplier", "return_from_production"]) },
        { name: "quantity_delta", label: "Quantity change", type: "number", required: true, help: "Positive for purchases and returns in, negative for use and returns out." },
        { name: "batch_id", label: "Production batch (for consumption)", type: "relation", relation: { table: "production_batches", label: "batch_number" } },
        { name: "reason", label: "Reason", type: "text", max: 300, help: "Required for adjustments." },
      ], order: { column: "created_at", ascending: false } }],
  },

  suppliers: {
    slug: "suppliers", label: "Suppliers", singular: "supplier", table: "suppliers", select: "*", titleKey: "name",
    columns: [{ key: "supplier_code", label: "Code", link: true }, { key: "name", label: "Name" }, { key: "company", label: "Company" }, { key: "country", label: "Country" }, { key: "email", label: "Email" }],
    search: ["name", "company", "email", "supplier_code", "country"], order: { column: "name", ascending: true }, baseFilter: { column: "archived_at", isNull: true },
    read: "suppliers.read", write: "suppliers.write",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, max: 200 }, { name: "company", label: "Company", type: "text", max: 200 }, { name: "contact_person", label: "Contact person", type: "text", max: 200 },
      { name: "email", label: "Email", type: "email", max: 254 }, { name: "phone", label: "Phone", type: "tel", max: 40 }, { name: "country", label: "Country", type: "text", max: 100 }, { name: "notes", label: "Notes", type: "textarea", max: 4000 },
    ],
    actions: [{ type: "update", label: "Archive supplier", set: { archived_at: "now" }, permission: "suppliers.write", when: (r) => !r.archived_at, confirm: "Archive this supplier?" }],
  },

  payments: {
    slug: "payments", label: "Payments", singular: "payment", table: "payments", select: "*, customers(name), orders(order_number)", titleKey: "payment_number", derive: "from_order",
    columns: [
      { key: "payment_number", label: "Number", link: true }, { key: "customers.name", label: "Customer" }, { key: "orders.order_number", label: "Order" }, { key: "kind", label: "Type", format: "status" },
      { key: "amount", label: "Amount", format: "money", currencyKey: "currency" }, { key: "status", label: "Status", format: "status" }, { key: "payment_date", label: "Date", format: "date" },
    ],
    search: ["payment_number", "reference"], filters: [filter("status", "Status", "status", ["pending", "received", "partially_received", "failed", "refunded"]), filter("kind", "Type", "kind", ["payment", "refund"])],
    order: { column: "created_at", ascending: false }, read: "payments.read", write: "payments.write",
    fields: [
      { ...orderField, createOnly: true }, { name: "kind", label: "Type", type: "select", required: true, options: opts(["payment", "refund"]), default: "payment", createOnly: true },
      { name: "method", label: "Method", type: "select", required: true, options: opts(["bank_transfer", "western_union", "moneygram", "other"]) },
      { name: "reference", label: "Reference", type: "text", max: 120 }, { name: "amount", label: "Amount paid", type: "money", required: true, createOnly: true }, { ...currency, createOnly: true },
      { name: "order_currency_amount", label: "Amount credited to the order (in the order's currency)", type: "money", required: true, createOnly: true, help: "Same as the amount when the currencies match." },
      { name: "fx_rate_to_base", label: "Rate to reporting currency", type: "number", default: 1, createOnly: true }, { name: "payment_date", label: "Payment date", type: "date", default: "today", required: true },
      { name: "notes", label: "Notes", type: "textarea", max: 2000 },
    ],
    actions: [{ type: "rpc", label: "Confirm money received", rpc: "confirm_payment", idArg: "p_payment", permission: "payments.confirm", when: (r) => r.status === "pending",
      numberArg: { name: "p_received_order_amount", label: "Amount received (leave empty if the full amount arrived)" }, confirm: "Confirm that this money has arrived? This cannot be undone." }],
  },

  invoices: {
    slug: "invoices", label: "Invoices", singular: "invoice", table: "invoices", select: "*, customers(name), orders(order_number)", titleKey: "invoice_number", derive: "from_order", detail: "invoice",
    columns: [
      { key: "invoice_number", label: "Number", link: true }, { key: "customers.name", label: "Customer" }, { key: "orders.order_number", label: "Order" }, { key: "status", label: "Status", format: "status" },
      { key: "total", label: "Total", format: "money", currencyKey: "currency" }, { key: "issue_date", label: "Issued", format: "date" }, { key: "due_date", label: "Due", format: "date" },
    ],
    search: ["invoice_number"], filters: [filter("status", "Status", "status", ["draft", "finalized", "void"])],
    order: { column: "created_at", ascending: false }, read: "invoices.read", write: "invoices.write",
    fields: [{ ...orderField, createOnly: true }, ...documentMoneyFields.filter((f) => f.name !== "currency"), { name: "issue_date", label: "Issue date", type: "date", default: "today" }, { name: "due_date", label: "Due date", type: "date" },
      { name: "notes", label: "Notes", type: "textarea", max: 2000 }, { name: "payment_instructions", label: "Payment instructions", type: "textarea", max: 2000 }],
    actions: [{ type: "rpc", label: "Finalize invoice", rpc: "finalize_invoice", idArg: "p_invoice", permission: "invoices.finalize", when: (r) => r.status === "draft", confirm: "Finalize this invoice? Its amounts can no longer be edited; corrections will use credit or debit notes." }],
    children: [
      { key: "items", label: "Items", table: "invoice_items", fk: "invoice_id", read: "invoices.read", write: "invoices.write", canDelete: true, editableWhen: (r) => r.status === "draft",
        columns: [{ key: "description", label: "Item" }, { key: "quantity", label: "Qty", format: "number" }, { key: "unit_price", label: "Unit price", format: "money" }, { key: "line_total", label: "Line total", format: "money" }],
        fields: [{ name: "description", label: "Description", type: "text", required: true, max: 300 }, { name: "quantity", label: "Quantity", type: "number", required: true }, { name: "unit_price", label: "Unit price", type: "money", required: true }],
        order: { column: "sort_order", ascending: true } },
      { key: "adjustments", label: "Credit and debit notes", table: "invoice_adjustments", fk: "invoice_id", read: "invoices.read", write: "invoices.write", editableWhen: (r) => r.status === "finalized",
        columns: [{ key: "kind", label: "Type", format: "status" }, { key: "amount", label: "Amount", format: "money" }, { key: "reason", label: "Reason" }, { key: "created_at", label: "When", format: "datetime" }],
        fields: [{ name: "kind", label: "Type", type: "select", required: true, options: opts(["credit", "debit"]) }, { name: "amount", label: "Amount", type: "money", required: true }, { name: "reason", label: "Reason", type: "text", required: true, max: 300 }],
        order: { column: "created_at", ascending: false } },
    ],
  },

  expenses: {
    slug: "expenses", label: "Expenses", singular: "expense", table: "expenses", select: "*, expense_categories(name), suppliers(name)", titleKey: "expense_number",
    columns: [
      { key: "expense_number", label: "Number", link: true }, { key: "expense_date", label: "Date", format: "date" }, { key: "expense_categories.name", label: "Category" },
      { key: "amount", label: "Amount", format: "money", currencyKey: "currency" }, { key: "suppliers.name", label: "Supplier" }, { key: "voided_at", label: "Voided", format: "date" },
    ],
    search: ["expense_number", "reference_number", "description"], order: { column: "expense_date", ascending: false }, read: "expenses.read", write: "expenses.write",
    fields: [
      { name: "category_id", label: "Category", type: "relation", required: true, relation: { table: "expense_categories", label: "name" }, createOnly: true },
      { name: "expense_date", label: "Date", type: "date", default: "today", required: true, createOnly: true }, { name: "amount", label: "Amount", type: "money", required: true, createOnly: true }, { ...currency, createOnly: true },
      { name: "fx_rate_to_base", label: "Rate to reporting currency", type: "number", default: 1, createOnly: true, help: "Fixed when recorded. Use 1 when the currency is the reporting currency." },
      { name: "supplier_id", label: "Supplier", type: "relation", relation: { table: "suppliers", label: "name" } },
      { name: "payment_method", label: "Payment method", type: "select", options: opts(["cash", "bank_transfer", "cheque", "card", "other"]) },
      { name: "reference_number", label: "Reference", type: "text", max: 120 }, { name: "description", label: "Description", type: "textarea", max: 2000 },
    ],
    actions: [{ type: "update", label: "Void expense", set: { voided_at: "now" }, permission: "expenses.write", when: (r) => !r.voided_at, confirm: "Void this expense? It stays on record but is excluded from totals." }],
  },

  shipping: {
    slug: "shipping", label: "Shipping", singular: "shipment", table: "shipments", select: "*, orders(order_number), customers(name)", titleKey: "shipment_number", derive: "from_order",
    columns: [
      { key: "shipment_number", label: "Shipment", link: true }, { key: "orders.order_number", label: "Order" }, { key: "customers.name", label: "Customer" }, { key: "carrier", label: "Carrier", format: "status" },
      { key: "tracking_number", label: "Tracking" }, { key: "status", label: "Status", format: "status" }, { key: "expected_delivery", label: "Expected", format: "date" },
    ],
    search: ["shipment_number", "tracking_number"], filters: [filter("status", "Status", "status", ["preparing", "dispatched", "in_transit", "customs_clearance", "out_for_delivery", "delivered", "delayed"])],
    order: { column: "created_at", ascending: false }, read: "shipping.read", write: "shipping.write",
    fields: [
      { ...orderField, createOnly: true }, { name: "carrier", label: "Carrier", type: "select", required: true, options: opts(["dhl", "fedex", "ups", "other"]) },
      { name: "carrier_name", label: "Carrier name (if other)", type: "text", max: 120 }, { name: "tracking_number", label: "Tracking number", type: "text", max: 120 },
      { name: "tracking_url", label: "Tracking link", type: "text", max: 500 }, { name: "destination_country", label: "Destination country", type: "text", max: 100 },
      { name: "dispatch_date", label: "Dispatch date", type: "date" }, { name: "expected_delivery", label: "Expected delivery", type: "date" },
      { name: "shipping_charge", label: "Shipping charge", type: "money" }, { ...currency, required: false }, { name: "notes", label: "Notes", type: "textarea", max: 2000 },
    ],
    actions: [{ type: "update", label: "Mark delivered", set: { status: "delivered", delivered_at: "now" }, permission: "shipping.write", when: (r) => r.status !== "delivered", confirm: "Mark this shipment as delivered?" },
      { type: "status", label: "Move to", column: "status", next: (r) => ["preparing", "dispatched", "in_transit", "customs_clearance", "out_for_delivery", "delayed"].filter((s) => s !== r.status && r.status !== "delivered"), permission: "shipping.write" }],
    children: [{ key: "events", label: "Tracking events (entered by staff)", table: "shipment_events", fk: "shipment_id", read: "shipping.read", write: "shipping.write",
      columns: [{ key: "occurred_at", label: "When", format: "datetime" }, { key: "status", label: "Status", format: "status" }, { key: "location", label: "Location" }, { key: "description", label: "Details" }],
      fields: [
        { name: "status", label: "Status", type: "select", required: true, options: opts(["preparing", "dispatched", "in_transit", "customs_clearance", "out_for_delivery", "delivered", "delayed"]) },
        { name: "occurred_at", label: "When (date)", type: "date", required: true, default: "today" }, { name: "location", label: "Location", type: "text", max: 200 }, { name: "description", label: "Details", type: "text", max: 500 },
      ], order: { column: "occurred_at", ascending: false } }],
  },

  employees: {
    slug: "employees", label: "Employees", singular: "employee", table: "profiles", select: "*, roles(name)", titleKey: "full_name", customCreate: "employee",
    columns: [{ key: "full_name", label: "Name", link: true }, { key: "email", label: "Email" }, { key: "roles.name", label: "Role" }, { key: "is_active", label: "Active", format: "boolean" }],
    search: ["full_name", "email"], order: { column: "full_name", ascending: true }, read: "employees.read", write: "employees.manage",
    fields: [
      { name: "full_name", label: "Full name", type: "text", required: true, max: 200 }, { name: "phone", label: "Phone", type: "tel", max: 40 },
      { name: "role_id", label: "Role", type: "relation", required: true, relation: { table: "roles", label: "name" } }, { name: "is_active", label: "Active", type: "checkbox", default: true, help: "Turn off to remove all access immediately." },
    ],
    children: [{ key: "overrides", label: "Permission exceptions", table: "profile_permissions", fk: "profile_id", read: "employees.read", write: "employees.manage", canDelete: true,
      columns: [{ key: "permission_key", label: "Permission" }, { key: "granted", label: "Granted", format: "boolean" }],
      fields: [{ name: "permission_key", label: "Permission", type: "relation", required: true, relation: { table: "permissions", label: "key", value: "key" } }, { name: "granted", label: "Granted", type: "checkbox", default: true, help: "Untick to take this permission away from this person only." }] }],
  },

  notifications: {
    slug: "notifications", label: "Notifications", singular: "notification", table: "notifications", select: "*", titleKey: "title",
    columns: [{ key: "title", label: "Notification", link: true }, { key: "kind", label: "Type", format: "status" }, { key: "created_at", label: "When", format: "datetime" }, { key: "read_at", label: "Read", format: "datetime" }],
    search: ["title"], order: { column: "created_at", ascending: false }, read: "notifications.read", fields: [],
    actions: [{ type: "update", label: "Mark as read", set: { read_at: "now" }, permission: "notifications.read", when: (r) => !r.read_at }],
  },

  settings: {
    slug: "settings", label: "Settings", singular: "setting", table: "business_settings", select: "*", titleKey: "company_name", singleton: { idColumn: "id", idValue: true },
    columns: [], search: [], order: { column: "updated_at", ascending: false }, read: "settings.read", write: "settings.manage",
    fields: [
      { name: "company_name", label: "Company name", type: "text", required: true, max: 200 }, { name: "legal_name", label: "Legal name", type: "text", max: 200 },
      { name: "address", label: "Address", type: "textarea", max: 1000 }, { name: "email", label: "Email", type: "email", max: 254 }, { name: "phone", label: "Phone", type: "tel", max: 40 },
      { name: "reporting_currency", label: "Reporting currency", type: "select", required: true, options: CURRENCIES.map((c) => ({ value: c, label: c })), help: "All profit reports are shown in this currency." },
      { name: "default_tax_rate", label: "Default tax rate (%)", type: "number" }, { name: "quotation_validity_days", label: "Quotation validity (days)", type: "number" },
      { name: "invoice_payment_terms_days", label: "Invoice payment terms (days)", type: "number" },
      { name: "overhead_allocation_method", label: "How shared expenses are spread over orders", type: "select", options: [{ value: "revenue_share", label: "By revenue share" }, { value: "direct_cost_share", label: "By direct cost share" }] },
      { name: "payment_instructions", label: "Payment instructions (shown on invoices)", type: "textarea", max: 2000 },
    ],
  },

  activity: {
    slug: "activity", label: "Activity Logs", singular: "log entry", table: "audit_logs", select: "*", titleKey: "table_name", detail: "audit",
    columns: [{ key: "at", label: "When", format: "datetime", link: true }, { key: "table_name", label: "Record type" }, { key: "action", label: "Action", format: "status" }, { key: "record_id", label: "Record" }, { key: "actor", label: "By (user id)" }],
    search: ["record_id", "table_name"], filters: [filter("action", "Action", "action", ["INSERT", "UPDATE", "DELETE"])], order: { column: "at", ascending: false },
    read: "audit.read", fields: [],
  },
};

export const moduleBySlug = (slug: string): ModuleConfig | undefined => MODULES[slug];
export { ORDER_STATUS_LABELS };
export const statusLabel = (value: string) => human(String(value));
export type { Child };

/** Which kind of record a module's attached files belong to (the `attachments.entity_type` values). */
export const ATTACHMENT_ENTITY: Record<string, string> = {
  customers: "customer", inquiries: "inquiry", quotations: "quotation", orders: "order", production: "batch", quality: "inspection",
  payments: "payment", invoices: "invoice", expenses: "expense", shipping: "shipment", suppliers: "supplier",
};
export const ATTACHMENT_KINDS = ["artwork", "logo", "proof", "receipt", "document", "photo", "other"] as const;
