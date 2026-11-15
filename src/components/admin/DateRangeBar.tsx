import Link from "next/link";
import { Button } from "@/components/buttons/Button";
import { RANGE_PRESETS, type DateRange } from "@/lib/utilities/date-range";

/** Preset buttons plus a custom range. Works as plain links and a GET form, so it needs no scripts. */
export function DateRangeBar({ path, range }: { path: string; range: DateRange }) {
  return (
    <div className="rounded-sm bg-white p-4 ring-1 ring-line">
      <ul className="flex flex-wrap gap-2" aria-label="Date range">
        {RANGE_PRESETS.filter((p) => p.id !== "custom").map((preset) => (
          <li key={preset.id}>
            <Link href={`${path}?preset=${preset.id}`} aria-current={range.preset === preset.id ? "true" : undefined}
              className={`inline-flex min-h-10 items-center rounded-xs px-3 text-sm font-semibold ${range.preset === preset.id ? "bg-navy text-white" : "ring-1 ring-line hover:ring-navy"}`}>
              {preset.label}
            </Link>
          </li>
        ))}
      </ul>
      <form method="get" action={path} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="preset" value="custom" />
        <div><label htmlFor="from" className="type-label">From</label><input id="from" name="from" type="date" defaultValue={range.from} required className="mt-1 min-h-10 rounded-xs border border-line px-2" /></div>
        <div><label htmlFor="to" className="type-label">To</label><input id="to" name="to" type="date" defaultValue={range.to} required className="mt-1 min-h-10 rounded-xs border border-line px-2" /></div>
        <Button type="submit" variant="dark">Apply</Button>
        <p className="text-sm text-slate">Showing {range.from} to {range.to}</p>
      </form>
    </div>
  );
}
