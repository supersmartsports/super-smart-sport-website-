/**
 * Money arithmetic in whole minor units (cents), so sums never pick up floating-point errors
 * such as 0.1 + 0.2 = 0.30000000000000004. Amounts enter as decimal strings from the database
 * ("1234.50") and leave the same way.
 */
export type Minor = number;

/** "1234.5" or 1234.5 -> 123450. Rejects anything that is not a plain decimal amount. */
export function toMinor(value: string | number): Minor {
  const text = typeof value === "number" ? value.toFixed(2) : value.trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error(`Not a valid money amount: "${value}"`);
  const [, sign, whole, fraction = ""] = match;
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor)) throw new Error(`Amount is too large: "${value}"`);
  return sign ? -minor : minor;
}

/** 123450 -> "1234.50" */
export function fromMinor(minor: Minor): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export const sumMinor = (values: Minor[]): Minor => values.reduce((total, value) => total + value, 0);

/** Rounds half away from zero, the same rule PostgreSQL's round() uses for numeric. */
export function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/**
 * Converts with an explicit rate (1 unit of the source currency = `rate` units of the target).
 * There is deliberately no default rate: a conversion without a stated rate is an error.
 */
export function convertMinor(amount: Minor, rate: string | number): Minor {
  const r = typeof rate === "string" ? Number(rate) : rate;
  if (!Number.isFinite(r) || r <= 0) throw new Error(`Exchange rate must be a positive number, got "${rate}"`);
  return roundHalfUp(amount * r);
}

export type MoneyAmount = { currency: string; minor: Minor };

/** Adds amounts only when they share a currency. Mixed currencies are a programming error. */
export function addSameCurrency(amounts: MoneyAmount[]): MoneyAmount | null {
  if (amounts.length === 0) return null;
  const currency = amounts[0].currency;
  for (const amount of amounts) {
    if (amount.currency !== currency) throw new Error(`Cannot add ${amount.currency} to ${currency} without an exchange rate`);
  }
  return { currency, minor: sumMinor(amounts.map((amount) => amount.minor)) };
}

/** Groups amounts by currency, giving one total per currency and never a mixed sum. */
export function totalsByCurrency(amounts: MoneyAmount[]): Record<string, Minor> {
  const totals: Record<string, Minor> = {};
  for (const { currency, minor } of amounts) totals[currency] = (totals[currency] ?? 0) + minor;
  return totals;
}
