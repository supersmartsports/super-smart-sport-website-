import Link from "next/link";
import type { Column } from "@/features/admin/types";

type Row = Record<string, unknown>;

/** Reads "customers.name" from a row, whether the embedded record arrives as an object or a one-item list. */
export function getPath(row: Row, path: string): unknown {
  let current: unknown = row;
  for (const part of path.split(".")) {
    if (Array.isArray(current)) current = current[0];
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Row)[part];
  }
  return Array.isArray(current) ? current[0] : current;
}

const human = (value: string) => value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function formatMoney(value: unknown, currency?: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const text = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return typeof currency === "string" && currency ? `${currency} ${text}` : text;
}

const STATUS_TONE: Record<string, string> = {
  paid: "bg-green-100 text-green-900", received: "bg-green-100 text-green-900", completed: "bg-green-100 text-green-900", delivered: "bg-green-100 text-green-900",
  approved: "bg-green-100 text-green-900", accepted: "bg-green-100 text-green-900", pass: "bg-green-100 text-green-900", finalized: "bg-green-100 text-green-900",
  unpaid: "bg-red/10 text-red-deep", failed: "bg-red/10 text-red-deep", cancelled: "bg-red/10 text-red-deep", rejected: "bg-red/10 text-red-deep", fail: "bg-red/10 text-red-deep",
  void: "bg-red/10 text-red-deep", lost: "bg-red/10 text-red-deep", delayed: "bg-red/10 text-red-deep", rework_required: "bg-red/10 text-red-deep", expired: "bg-red/10 text-red-deep",
};

export function Cell({ column, row, slug }: { column: Column; row: Row; slug?: string }) {
  const value = getPath(row, column.key);
  if (value === null || value === undefined || value === "") return <span className="text-slate">-</span>;
  let content: React.ReactNode;
  switch (column.format) {
    case "money": content = formatMoney(value, column.currencyKey ? getPath(row, column.currencyKey) : undefined); break;
    case "date": content = String(value).slice(0, 10); break;
    case "datetime": content = new Date(String(value)).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC"; break;
    case "boolean": content = value ? "Yes" : "No"; break;
    case "number": content = Number(value).toLocaleString("en-US"); break;
    case "status":
      content = <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[String(value)] ?? "bg-paper text-navy-deep"}`}>{human(String(value))}</span>;
      break;
    default: content = String(value);
  }
  if (column.link && slug && row.id !== undefined) {
    return <Link href={`/admin/${slug}/${row.id}`} className="font-bold text-navy underline-offset-4 hover:underline">{content}</Link>;
  }
  return <>{content}</>;
}

export function DataTable({ columns, rows, slug, empty }: { columns: Column[]; rows: Row[]; slug?: string; empty: string }) {
  if (rows.length === 0) return <p className="rounded-sm bg-white p-6 text-slate ring-1 ring-line">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-sm bg-white ring-1 ring-line">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b border-line text-slate">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={`p-3 font-semibold ${column.format === "money" || column.format === "number" ? "text-right" : ""}`}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id ?? index)} className="border-b border-line last:border-0">
              {columns.map((column) => (
                <td key={column.key} className={`p-3 align-top ${column.format === "money" || column.format === "number" ? "text-right tabular-nums" : ""}`}>
                  <Cell column={column} row={row} slug={slug} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
