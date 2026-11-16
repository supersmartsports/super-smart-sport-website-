/**
 * Permissions as the application sees them. The list mirrors the `permissions` table
 * (database/migrations/0009_reference_data.sql); a test checks the two stay identical.
 * These checks decide what the interface shows. The database decides what is allowed.
 */
export const PERMISSION_KEYS = [
  "customers.read", "customers.write", "customers.archive", "customers.export",
  "inquiries.read", "inquiries.write",
  "quotations.read", "quotations.write", "quotations.convert",
  "orders.read", "orders.write", "orders.update_status",
  "production.read", "production.write", "tasks.read_assigned",
  "quality.read", "quality.write",
  "products.read", "products.write",
  "reviews.read", "reviews.write",
  "materials.read", "materials.write",
  "suppliers.read", "suppliers.write",
  "payments.read", "payments.write", "payments.confirm",
  "invoices.read", "invoices.write", "invoices.finalize",
  "expenses.read", "expenses.write",
  "finance.read", "finance.write",
  "shipping.read", "shipping.write",
  "reports.read", "reports.export",
  "employees.read", "employees.manage",
  "notifications.read",
  "attachments.read", "attachments.write",
  "settings.read", "settings.manage",
  "audit.read",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  roleKey: string;
  roleName: string;
  permissions: string[];
};

export function hasPermission(user: Pick<SessionUser, "permissions">, permission: PermissionKey) {
  return user.permissions.includes(permission);
}

/** The 20 modules of the dashboard, in sidebar order. */
export type ModuleStatus = "ready" | "planned";

export type AdminModule = {
  key: string;
  label: string;
  href: string;
  /** Holding any one of these shows the module. */
  anyOf: PermissionKey[];
  /** "planned" modules have their database and rules in place, but no screens yet. */
  status: ModuleStatus;
};

export const ADMIN_MODULES: AdminModule[] = [
  { key: "overview", label: "Overview", href: "/admin/dashboard", anyOf: [...PERMISSION_KEYS], status: "ready" },
  { key: "customers", label: "Customers", href: "/admin/customers", anyOf: ["customers.read"], status: "ready" },
  { key: "inquiries", label: "Inquiries", href: "/admin/inquiries", anyOf: ["inquiries.read"], status: "ready" },
  { key: "quotations", label: "Quotations", href: "/admin/quotations", anyOf: ["quotations.read"], status: "ready" },
  { key: "orders", label: "Orders", href: "/admin/orders", anyOf: ["orders.read"], status: "ready" },
  { key: "production", label: "Production", href: "/admin/production", anyOf: ["production.read", "tasks.read_assigned"], status: "ready" },
  { key: "quality", label: "Quality Control", href: "/admin/quality", anyOf: ["quality.read"], status: "ready" },
  { key: "products", label: "Products", href: "/admin/products", anyOf: ["products.read"], status: "ready" },
  { key: "reviews", label: "Reviews", href: "/admin/reviews", anyOf: ["reviews.read"], status: "ready" },
  { key: "materials", label: "Raw Materials", href: "/admin/materials", anyOf: ["materials.read"], status: "ready" },
  { key: "suppliers", label: "Suppliers", href: "/admin/suppliers", anyOf: ["suppliers.read"], status: "ready" },
  { key: "payments", label: "Payments", href: "/admin/payments", anyOf: ["payments.read"], status: "ready" },
  { key: "invoices", label: "Invoices", href: "/admin/invoices", anyOf: ["invoices.read"], status: "ready" },
  { key: "expenses", label: "Expenses", href: "/admin/expenses", anyOf: ["expenses.read"], status: "ready" },
  { key: "profit", label: "Profit & Loss", href: "/admin/profit-loss", anyOf: ["finance.read"], status: "ready" },
  { key: "shipping", label: "Shipping", href: "/admin/shipping", anyOf: ["shipping.read"], status: "ready" },
  { key: "employees", label: "Employees", href: "/admin/employees", anyOf: ["employees.read"], status: "ready" },
  { key: "reports", label: "Reports", href: "/admin/reports", anyOf: ["reports.read"], status: "ready" },
  { key: "notifications", label: "Notifications", href: "/admin/notifications", anyOf: ["notifications.read"], status: "ready" },
  { key: "settings", label: "Settings", href: "/admin/settings", anyOf: ["settings.read"], status: "ready" },
  { key: "activity", label: "Activity Logs", href: "/admin/activity", anyOf: ["audit.read"], status: "ready" },
];

/** The modules this user may see, in order. */
export function visibleModules(user: Pick<SessionUser, "permissions">): AdminModule[] {
  return ADMIN_MODULES.filter((module) => module.anyOf.some((permission) => user.permissions.includes(permission)));
}
