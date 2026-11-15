export const RANGE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "this_year", label: "This year" },
  { id: "custom", label: "Custom range" },
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number]["id"];
export type DateRange = { from: string; to: string; preset: RangePreset };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const isDate = (value: string | undefined): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

/** Turns a preset (or a custom from/to) into inclusive start and end dates, in UTC. */
export function resolveRange(preset: string | undefined, from?: string, to?: string, now: Date = new Date()): DateRange {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  switch (preset) {
    case "today": return { preset: "today", from: iso(utc(y, m, d)), to: iso(utc(y, m, d)) };
    case "last7": return { preset: "last7", from: iso(utc(y, m, d - 6)), to: iso(utc(y, m, d)) };
    case "last30": return { preset: "last30", from: iso(utc(y, m, d - 29)), to: iso(utc(y, m, d)) };
    case "last_month": return { preset: "last_month", from: iso(utc(y, m - 1, 1)), to: iso(utc(y, m, 0)) };
    case "this_year": return { preset: "this_year", from: iso(utc(y, 0, 1)), to: iso(utc(y, 11, 31)) };
    case "custom":
      if (isDate(from) && isDate(to) && from <= to) return { preset: "custom", from, to };
      break;
  }
  return { preset: "this_month", from: iso(utc(y, m, 1)), to: iso(utc(y, m + 1, 0)) };
}
