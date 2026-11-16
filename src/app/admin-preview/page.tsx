import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { DataTable } from "@/components/admin/format";
import { RecordForm } from "@/components/admin/forms";
import { DateRangeBar } from "@/components/admin/DateRangeBar";
import { ADMIN_MODULES } from "@/features/auth/permissions";
import { MODULES } from "@/features/admin/modules";
import { resolveRange } from "@/lib/utilities/date-range";

/**
 * DEVELOPMENT ONLY. Shows the real admin interface with no data and no sign-in, so the layout can be
 * looked at before a database is connected. It does not exist in a production build.
 */
export default function AdminPreview() {
  if (process.env.NODE_ENV === "production") notFound();

  async function noop() {
    "use server";
    return { ok: "Preview only: nothing was saved." };
  }

  const customers = MODULES.customers;
  const modules = ADMIN_MODULES.map(({ key, label, href, status }) => ({ key, label, href: href.replace("/admin", "/admin-preview#"), status }));

  return (
    <AdminShell user={{ fullName: "Preview (not signed in)", roleName: "Owner / Super Admin" }} modules={modules}>
      <div className="mx-auto max-w-6xl">
        <p role="note" className="rounded-sm bg-navy-deep p-4 text-sm font-semibold text-white">
          Development preview: the real admin screens with an empty database. No sign-in, no saved data, and this page does not exist in production.
        </p>

        <h1 className="type-h2 mt-8">Overview</h1>
        <section aria-label="Business figures" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["Total orders", "Active orders", "Pending orders", "Completed orders", "Customers", "New inquiries", "Pending quotations", "Footballs in production"].map((label) => (
            <div key={label} className="rounded-sm bg-white p-5 ring-1 ring-line">
              <p className="type-label text-slate">{label}</p>
              <p className="mt-2 text-3xl font-extrabold tabular-nums [font-stretch:80%]">0</p>
            </div>
          ))}
        </section>
        <h2 className="type-h3 mt-10">Money, by currency</h2>
        <p className="mt-4 rounded-sm bg-white p-6 ring-1 ring-line">No orders have been recorded yet, so there is nothing to total.</p>

        <h2 id="customers" className="type-h3 mt-12">Customers</h2>
        <div className="mt-4"><DataTable columns={customers.columns} rows={[]} slug="customers" empty='No customers yet. Use "New customer" to add the first one.' /></div>

        <h2 id="new-customer" className="type-h3 mt-12">New customer</h2>
        <div className="mt-4"><RecordForm fields={customers.fields} options={{}} action={noop} submitLabel="Create customer" /></div>

        <h2 id="profit-loss" className="type-h3 mt-12">Profit &amp; Loss: date filters</h2>
        <div className="mt-4"><DateRangeBar path="/admin-preview" range={resolveRange("this_month")} /></div>
      </div>
    </AdminShell>
  );
}
