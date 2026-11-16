import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm, ChildForm, DeleteRowButton, RecordForm, UploadForm } from "@/components/admin/forms";
import { Cell, DataTable, formatMoney, getPath } from "@/components/admin/format";
import { addChildRow, deleteAttachment, deleteChildRow, runAction, saveRecord, uploadAttachment } from "@/features/admin/actions";
import { ATTACHMENT_ENTITY, ATTACHMENT_KINDS, moduleBySlug } from "@/features/admin/modules";
import { hasPermission } from "@/features/auth/permissions";
import { nextStatuses, ORDER_STATUS_LABELS, orderProgress, type OrderStatus } from "@/features/orders/workflow";
import { createUserClient } from "@/lib/database/server";
import { requireUser } from "@/server/auth";
import { getChildRows, getRecord, getRelatedRows, loadRelationOptions } from "@/server/data";

type Props = { params: Promise<{ module: string; id: string }> };
type Row = Record<string, unknown>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const config = moduleBySlug((await params).module);
  return { title: config ? `${config.label}: record` : "Not found" };
}

const human = (value: string) => value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function Totals({ row }: { row: Row }) {
  const currency = String(row.currency ?? "");
  const lines: [string, unknown][] = [["Subtotal", row.subtotal], ["Discount", row.discount_amount], ["Tax", row.tax_amount], ["Shipping", row.shipping_charge], ["Total", row.total]];
  return (
    <dl className="grid max-w-sm gap-1.5 rounded-sm bg-white p-4 text-sm ring-1 ring-line">
      {lines.map(([label, value]) => (
        <div key={label} className={`flex justify-between gap-6 ${label === "Total" ? "border-t border-line pt-2 font-bold" : ""}`}>
          <dt className="text-slate">{label}</dt><dd className="tabular-nums">{formatMoney(value, currency)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function RecordPage({ params }: Props) {
  const { module: slug, id } = await params;
  const config = moduleBySlug(slug);
  if (!config || config.singleton) notFound();
  const user = await requireUser();
  if (!hasPermission(user, config.read) && !(slug === "production" && hasPermission(user, "tasks.read_assigned"))) redirect("/admin/dashboard?denied=1");
  const { row, error } = await getRecord(config, id);
  if (!row) {
    if (error && !/0 rows|invalid input syntax/i.test(error)) return <p role="alert" className="text-red-deep">{error}</p>;
    notFound();
  }

  const canWrite = Boolean(config.write && hasPermission(user, config.write));
  const supabase = await createUserClient();
  const title = String(getPath(row, config.titleKey) ?? config.singular);
  const options = await loadRelationOptions(config.fields);

  // Money position of an order, straight from the ledger views.
  let financials: Row | null = null;
  let profit: Row | null = null;
  let history: Row[] = [];
  if (config.detail === "order") {
    if (hasPermission(user, "payments.read")) financials = (await supabase.from("v_order_financials").select("*").eq("order_id", id).maybeSingle()).data as Row | null;
    if (hasPermission(user, "finance.read")) profit = (await supabase.from("v_order_profit").select("*").eq("order_id", id).maybeSingle()).data as Row | null;
    history = ((await supabase.from("order_status_history").select("from_status, to_status, note, changed_at, profiles:changed_by(full_name)").eq("order_id", id).order("changed_at")).data ?? []) as unknown as Row[];
  }

  const visibleChildren = (config.children ?? []).filter((child) => hasPermission(user, child.read));
  const children = await Promise.all(visibleChildren.map(async (child) => ({ child, rows: (await getChildRows(child, id)).rows, options: await loadRelationOptions(child.fields) })));
  const visibleRelated = (config.related ?? []).filter((related) => hasPermission(user, related.read));
  const related = await Promise.all(visibleRelated.map(async (rel) => ({ rel, rows: (await getRelatedRows(rel, id)).rows })));

  // Files attached to this record, each with a short-lived private download link.
  const entity = ATTACHMENT_ENTITY[slug];
  let files: { id: string; file_name: string; kind: string; size_bytes: number; url: string | null }[] = [];
  if (entity) {
    const { data: rows } = await supabase.from("attachments").select("id, file_name, kind, size_bytes, storage_path").eq("entity_type", entity).eq("entity_id", id).order("created_at", { ascending: false });
    files = await Promise.all((rows ?? []).map(async (r) => ({ id: r.id, file_name: r.file_name, kind: r.kind, size_bytes: r.size_bytes, url: (await supabase.storage.from("business-files").createSignedUrl(r.storage_path, 300)).data?.signedUrl ?? null })));
  }

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm"><Link href={`/admin/${slug}`} className="font-semibold text-navy underline-offset-4 hover:underline">{config.label}</Link></p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-h2">{title}</h1>
        {(config.detail === "quotation" || config.detail === "invoice") && hasPermission(user, config.read) && (
          <a href={`/admin/documents/${config.detail}/${id}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-xs border border-line px-4 text-sm font-semibold hover:border-navy">
            Download PDF
          </a>
        )}
      </div>

      {"status" in row && (
        <p className="mt-2 text-slate">Status: <Cell column={{ key: "status", label: "", format: "status" }} row={row} /></p>
      )}
      {config.detail === "order" && <p className="mt-1 text-sm text-slate">Progress: {orderProgress(row.status as OrderStatus)}%</p>}

      {/* Actions */}
      {canWrite || config.actions?.some((a) => hasPermission(user, a.permission)) ? (
        <section aria-label="Actions" className="mt-6 grid gap-3">
          {config.actions?.map((action, index) => {
            if (!hasPermission(user, action.permission)) return null;
            const bound = runAction.bind(null, slug, id, index);
            if (action.type === "order_status") {
              const next = nextStatuses(row.status as OrderStatus);
              if (next.length === 0) return null;
              return <ActionForm key={index} label="Move order to" action={bound} withNote choices={next.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] }))} />;
            }
            if (action.type === "status") {
              const next = action.next(row);
              if (next.length === 0) return null;
              return <ActionForm key={index} label={action.label} action={bound} choices={next.map((s) => ({ value: s, label: human(s) }))} />;
            }
            if (action.when && !action.when(row)) return null;
            return <ActionForm key={index} label={action.label} action={bound} confirm={action.confirm} numberArg={action.type === "rpc" ? action.numberArg : undefined} />;
          })}
        </section>
      ) : null}

      {config.detail === "audit" ? (
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {(["old_data", "new_data"] as const).map((key) => (
            <div key={key}><h2 className="font-bold">{key === "old_data" ? "Before" : "After"}</h2>
              <pre className="mt-2 max-h-96 overflow-auto rounded-sm bg-white p-4 text-xs ring-1 ring-line">{row[key] ? JSON.stringify(row[key], null, 2) : "None"}</pre></div>
          ))}
        </section>
      ) : (
        <>
          {"total" in row && row.total !== undefined && <div className="mt-6"><Totals row={row} /></div>}

          {financials && (
            <section aria-labelledby="fin-h" className="mt-8">
              <h2 id="fin-h" className="type-h3">Money position</h2>
              <dl className="mt-3 grid gap-3 sm:grid-cols-4">
                {([["Amount due", financials.amount_due], ["Cash received", financials.cash_received], ["Outstanding", financials.outstanding_balance]] as [string, unknown][]).map(([label, value]) => (
                  <div key={label} className="rounded-sm bg-white p-4 ring-1 ring-line"><dt className="type-label text-slate">{label}</dt><dd className="mt-1 text-xl font-extrabold tabular-nums">{formatMoney(value, financials!.currency)}</dd></div>
                ))}
                <div className="rounded-sm bg-white p-4 ring-1 ring-line"><dt className="type-label text-slate">Payment status</dt><dd className="mt-1"><Cell column={{ key: "payment_status", label: "", format: "status" }} row={row} /></dd></div>
              </dl>
              <p className="mt-2 text-sm text-slate">Cash received counts confirmed payments only, minus confirmed refunds.</p>
            </section>
          )}
          {profit && (
            <section aria-labelledby="profit-h" className="mt-8">
              <h2 id="profit-h" className="type-h3">Profit on this order (reporting currency)</h2>
              <dl className="mt-3 grid gap-3 sm:grid-cols-4">
                {([["Net sales revenue", profit.net_sales_revenue], ["Direct costs", profit.direct_costs_base], ["Additional costs", profit.additional_costs_base]] as [string, unknown][]).map(([label, value]) => (
                  <div key={label} className="rounded-sm bg-white p-4 ring-1 ring-line"><dt className="type-label text-slate">{label}</dt><dd className="mt-1 text-xl font-extrabold tabular-nums">{formatMoney(value)}</dd></div>
                ))}
                <div className="rounded-sm bg-white p-4 ring-1 ring-line"><dt className="type-label text-slate">Gross profit</dt>
                  <dd className="mt-1 text-xl font-extrabold tabular-nums">{formatMoney(Number(profit.net_sales_revenue) - Number(profit.direct_costs_base))}</dd></div>
              </dl>
              <p className="mt-2 text-sm text-slate">Actual figures from recorded costs. Shared operating expenses are allocated in the Profit &amp; Loss report.</p>
            </section>
          )}

          {config.fields.length > 0 && (
            <section aria-labelledby="edit-h" className="mt-8">
              <h2 id="edit-h" className="type-h3">Details</h2>
              <div className="mt-3">
                {canWrite ? (
                  <RecordForm fields={config.fields.filter((f) => !f.createOnly)} options={options} record={row} action={saveRecord.bind(null, slug, id)} submitLabel="Save changes" />
                ) : (
                  <dl className="grid gap-3 rounded-sm bg-white p-5 ring-1 ring-line sm:grid-cols-2">
                    {config.fields.map((f) => <div key={f.name}><dt className="type-label text-slate">{f.label}</dt><dd>{String(row[f.name] ?? "-")}</dd></div>)}
                  </dl>
                )}
              </div>
            </section>
          )}

          {history.length > 0 && (
            <section aria-labelledby="hist-h" className="mt-8">
              <h2 id="hist-h" className="type-h3">Order timeline</h2>
              <ol className="mt-3 grid gap-2">
                {history.map((h, i) => (
                  <li key={i} className="rounded-sm bg-white p-3 text-sm ring-1 ring-line">
                    <span className="font-bold">{h.from_status ? `${human(String(h.from_status))} to ` : ""}{human(String(h.to_status))}</span>
                    <span className="text-slate"> / {String(getPath(h, "profiles.full_name") ?? "system")} / {new Date(String(h.changed_at)).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC</span>
                    {h.note ? <p className="mt-1">{String(h.note)}</p> : null}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {children.map(({ child, rows, options: childOptions }) => {
            const canAdd = Boolean(child.write && hasPermission(user, child.write) && (!child.editableWhen || child.editableWhen(row)));
            return (
              <section key={child.key} aria-labelledby={`c-${child.key}`} className="mt-8">
                <h2 id={`c-${child.key}`} className="type-h3">{child.label}</h2>
                <div className="mt-3">
                  <DataTable columns={child.columns} rows={rows} empty={`No ${child.label.toLowerCase()} yet.`} />
                </div>
                {child.canDelete && canAdd && rows.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                    {rows.map((r, i) => <li key={String(r.id)}><DeleteRowButton action={deleteChildRow.bind(null, slug, id, child.key, String(r.id))} label={`${child.label.toLowerCase()} row ${i + 1}`} /></li>)}
                  </ul>
                )}
                {canAdd && <ChildForm title={`Add to ${child.label.toLowerCase()}`} fields={child.fields} options={childOptions} action={addChildRow.bind(null, slug, id, child.key)} />}
                {child.write && hasPermission(user, child.write) && child.editableWhen && !child.editableWhen(row) && <p className="mt-2 text-sm text-slate">This can no longer be changed at the current status.</p>}
              </section>
            );
          })}

          {entity && (files.length > 0 || canWrite) && (
            <section aria-labelledby="files-h" className="mt-8">
              <h2 id="files-h" className="type-h3">Files</h2>
              {files.length === 0 ? <p className="mt-3 rounded-sm bg-white p-6 text-slate ring-1 ring-line">No files attached yet.</p> : (
                <ul className="mt-3 grid gap-2">
                  {files.map((file) => (
                    <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-sm bg-white p-3 text-sm ring-1 ring-line">
                      <span>{file.url ? <a href={file.url} target="_blank" rel="noopener noreferrer" className="font-bold text-navy underline-offset-4 hover:underline">{file.file_name}</a> : file.file_name}<span className="text-slate"> / {human(file.kind)} / {(file.size_bytes / 1024).toFixed(0)} KB</span></span>
                      {canWrite && <DeleteRowButton action={deleteAttachment.bind(null, slug, id, file.id)} label={file.file_name} />}
                    </li>
                  ))}
                </ul>
              )}
              {canWrite && <UploadForm action={uploadAttachment.bind(null, slug, id)} kinds={ATTACHMENT_KINDS} />}
            </section>
          )}

          {related.map(({ rel, rows }) => (
            <section key={rel.key} aria-labelledby={`r-${rel.key}`} className="mt-8">
              <h2 id={`r-${rel.key}`} className="type-h3">{rel.label}</h2>
              <div className="mt-3"><DataTable columns={rel.columns} rows={rows} slug={rel.module} empty={`No ${rel.label.toLowerCase()}.`} /></div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
