import { z } from "zod";
import type { Field } from "./types";

export type FormValues = Record<string, string | number | boolean | null>;
export type ParseResult = { values: FormValues; errors: Record<string, string> };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONEY = /^\d{1,12}(\.\d{1,2})?$/;

/** Validates one field. Returns the cleaned value or an error message. */
function parseField(field: Field, raw: FormDataEntryValue | null): { value: string | number | boolean | null } | { error: string } {
  if (field.type === "checkbox") return { value: raw === "on" || raw === "true" };

  const text = typeof raw === "string" ? raw.trim() : "";
  if (text === "") return field.required ? { error: `${field.label} is required.` } : { value: null };

  const fail = (message: string) => ({ error: message });
  switch (field.type) {
    case "text":
    case "textarea":
    case "tel":
    case "password": {
      if (text.length > (field.max ?? 500)) return fail(`${field.label} is too long (at most ${field.max ?? 500} characters).`);
      if (field.type === "tel" && !/^\+?[\d\s()-]{5,40}$/.test(text)) return fail(`${field.label} should be a phone number with its country code.`);
      return { value: text };
    }
    case "email": {
      const parsed = z.email().safeParse(text);
      return parsed.success ? { value: parsed.data.toLowerCase() } : fail(`${field.label} should look like name@company.com.`);
    }
    case "money":
      return MONEY.test(text) ? { value: text } : fail(`${field.label} should be an amount such as 1250.50.`);
    case "number": {
      const n = Number(text);
      return Number.isFinite(n) && Math.abs(n) < 1e12 ? { value: n } : fail(`${field.label} should be a number.`);
    }
    case "date": {
      if (!DATE.test(text) || Number.isNaN(Date.parse(text))) return fail(`${field.label} should be a date.`);
      return { value: text };
    }
    case "select": {
      const allowed = field.options?.some((option) => option.value === text);
      return allowed ? { value: text } : fail(`Choose a valid ${field.label.toLowerCase()}.`);
    }
    case "relation": {
      const isKey = field.relation?.value === "key";
      const ok = isKey ? /^[a-z_.]{3,60}$/.test(text) : z.uuid().safeParse(text).success;
      return ok ? { value: text } : fail(`Choose a ${field.label.toLowerCase()}.`);
    }
  }
}

/**
 * Turns submitted form data into clean values, using only the fields the module defines.
 * Anything else the browser sends is ignored, so a person cannot set columns the form does not offer.
 */
export function parseForm(fields: Field[], data: FormData, mode: "create" | "update"): ParseResult {
  const values: FormValues = {};
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (mode === "update" && field.createOnly) continue;
    const result = parseField(field, data.get(field.name));
    if ("error" in result) errors[field.name] = result.error;
    else values[field.name] = result.value;
  }
  return { values, errors };
}

/** Escapes a value for CSV and neutralises spreadsheet formulas (a cell starting with = + - @ would otherwise run). */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Keeps a search term from altering the database filter: only letters, digits, spaces and a few safe marks. */
export function safeSearchTerm(term: string): string {
  return term.replace(/[^\p{L}\p{N}\s@.+_-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
