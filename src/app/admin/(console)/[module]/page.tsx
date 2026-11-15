import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DataTable } from "@/components/admin/format";
import { RecordForm } from "@/components/admin/forms";
import { Button, ButtonLink } from "@/components/buttons/Button";
import { saveRecord } from "@/features/admin/actions";
import { moduleBySlug } from "@/features/admin/modules";
import { hasPermission } from "@/features/auth/permissions";
import { requireUser } from "@/server/auth";
import { getRecord, listRecords, loadRelationOptions, PAGE_SIZE } from "@/server/data";

type Props = { params: Promise<{ module: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: moduleBySlug((await params).module)?.label ?? "Not found" };
}

export default async function ModuleListPage({ params, searchParams }: Props) {
  const { module: slug } = await params;
  const config = moduleBySlug(slug);
  if (!config) notFound();
  const user = await requireUser();
  if (!hasPermission(user, config.read) && !(slug === "production" && hasPermission(user, "tasks.read_assigned"))) redirect("/admin/dashboard?denied=1");

  const query = await searchParams;
  const canWrite = Boolean(config.write && hasPermission(user, config.write));

  // Settings is one record, edited in place.
  if (config.singleton) {
    const { row, error } = await getRecord(config, "");
    const options = await loadRelationOptions(config.fields);
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="type-h2">{config.label}</h1>
        {error && <p role="alert" className="mt-4 text-red-deep">{error}</p>}
        {canWrite && row ? (
          <div className="mt-6"><RecordForm fields={config.fields} options={options} record={row} action={saveRecord.bind(null, slug, "settings")} submitLabel="Save settings" /></div>
        ) : (
          <p className="mt-6 rounded-sm bg-white p-6 ring-1 ring-line">Only the owner can change these settings.</p>
        )}
      </div>
    );
  }

  const page = Math.max(1, Number(query.page) || 1);
  const filters = Object.fromEntries((config.filters ?? []).map((f) => [f.name, query[f.name] ?? ""]));
  const { rows, count, error } = await listRecords(config, { q: query.q, filters, page });
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const exportPermission = config.exportPermission ?? "reports.export";
  const canExport = hasPermission(user, exportPermission);
  const canCreate = canWrite && (config.fields.length > 0 || Boolean(config.customCreate));

  const link = (extra: Record<string, string | number>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...query, ...extra })) if (v !== undefined && v !== "") params.set(k, String(v));
    return `/admin/${slug}?${params.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-h2">{config.label}</h1>
        <div className="flex gap-2">
          {canExport && count > 0 && (
            <a href={`/admin/export/${slug}?${new URLSearchParams(Object.entries(query).filter(([, v]) => v) as [string, string][]).toString()}`} className="inline-flex min-h-11 items-center rounded-xs border border-line px-4 text-sm font-semibold hover:border-navy">
              Export CSV
            </a>
          )}
          {canCreate && <ButtonLink href={`/admin/${slug}/new`}>New {config.singular}</ButtonLink>}
        </div>
      </div>

      {(config.search.length > 0 || (config.filters?.length ?? 0) > 0) && (
        <form method="get" className="mt-5 flex flex-wrap items-end gap-3">
          {config.search.length > 0 && (
            <div className="min-w-60 flex-1">
              <label htmlFor="q" className="type-label">Search</label>
              <input id="q" name="q" defaultValue={query.q ?? ""} className="mt-1.5 min-h-11 w-full rounded-xs border border-line bg-white px-3" />
            </div>
          )}
          {config.filters?.map((filter) => (
            <div key={filter.name}>
              <label htmlFor={filter.name} className="type-label">{filter.label}</label>
              <select id={filter.name} name={filter.name} defaultValue={query[filter.name] ?? ""} className="mt-1.5 min-h-11 rounded-xs border border-line bg-white px-3">
                <option value="">All</option>
                {filter.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
          <Button type="submit" variant="dark">Apply</Button>
        </form>
      )}

      {error && <p role="alert" className="mt-5 rounded-sm bg-red/10 p-4 font-semibold text-red-deep">The list could not be loaded: {error}</p>}

      <div className="mt-5">
        <DataTable columns={config.columns} rows={rows} slug={slug}
          empty={query.q || Object.values(filters).some(Boolean) ? "Nothing matches your search." : `No ${config.label.toLowerCase()} yet.${canCreate ? ` Use "New ${config.singular}" to add the first one.` : ""}`} />
      </div>

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-5 flex items-center justify-between text-sm">
          <p className="text-slate">{count} records, page {page} of {pages}</p>
          <div className="flex gap-2">
            {page > 1 && <Link href={link({ page: page - 1 })} className="inline-flex min-h-11 items-center rounded-xs border border-line px-4 font-semibold hover:border-navy">Previous</Link>}
            {page < pages && <Link href={link({ page: page + 1 })} className="inline-flex min-h-11 items-center rounded-xs border border-line px-4 font-semibold hover:border-navy">Next</Link>}
          </div>
        </nav>
      )}
      {pages === 1 && count > 0 && <p className="mt-4 text-sm text-slate">{count} {count === 1 ? "record" : "records"}</p>}
    </div>
  );
}
