import type { PermissionKey } from "@/features/auth/permissions";

export type FieldType = "text" | "textarea" | "email" | "tel" | "number" | "money" | "date" | "select" | "relation" | "checkbox" | "password";

export type Option = { value: string; label: string };

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Option[];
  /** Options are loaded from another table. */
  relation?: { table: string; label: string; value?: string; filter?: [string, unknown] };
  help?: string;
  /** "today" fills the current date; anything else is a fixed default. */
  default?: string | number | boolean;
  /** Not editable after the record exists (the database enforces this for ledger tables). */
  createOnly?: boolean;
  max?: number;
};

export type Column = {
  /** A column name, or a dotted path into an embedded record, e.g. "customers.name". */
  key: string;
  label: string;
  format?: "money" | "date" | "datetime" | "status" | "boolean" | "number";
  /** The currency column to show beside a money amount. */
  currencyKey?: string;
  /** Makes the cell a link to this module's detail page, using the row's id. */
  link?: boolean;
};

export type Filter = { name: string; label: string; column: string; options: Option[] };

export type Action =
  | {
      type: "status";
      label: string;
      column: string;
      /** The statuses this record may move to next. Empty means no action is shown. */
      next: (record: Record<string, unknown>) => string[];
      permission: PermissionKey;
      labels?: Record<string, string>;
    }
  | { type: "order_status"; permission: PermissionKey }
  | {
      type: "rpc";
      label: string;
      rpc: string;
      /** The name of the id argument the function expects. */
      idArg: string;
      permission: PermissionKey;
      when?: (record: Record<string, unknown>) => boolean;
      /** An extra number the person fills in (for example the amount actually received). */
      numberArg?: { name: string; label: string };
      confirm?: string;
    }
  | {
      type: "update";
      label: string;
      /** Column values to set. "now" becomes the current time. */
      set: Record<string, string | boolean | null>;
      permission: PermissionKey;
      when?: (record: Record<string, unknown>) => boolean;
      confirm?: string;
    };

export type Child = {
  key: string;
  label: string;
  table: string;
  fk: string;
  read: PermissionKey;
  write?: PermissionKey;
  columns: Column[];
  fields: Field[];
  canDelete?: boolean;
  select?: string;
  order?: { column: string; ascending: boolean };
  /** Hide the add form when the parent is in a state that no longer allows changes. */
  editableWhen?: (record: Record<string, unknown>) => boolean;
};

export type Related = {
  key: string;
  label: string;
  table: string;
  fk: string;
  read: PermissionKey;
  module: string;
  select?: string;
  columns: Column[];
};

export type ModuleConfig = {
  slug: string;
  label: string;
  singular: string;
  table: string;
  /** PostgREST select string. Embedded tables give dotted column keys. */
  select: string;
  titleKey: string;
  columns: Column[];
  search: string[];
  filters?: Filter[];
  order: { column: string; ascending: boolean };
  /** Always applied to lists, e.g. hide archived customers. */
  baseFilter?: { column: string; isNull: true };
  read: PermissionKey;
  write?: PermissionKey;
  fields: Field[];
  /** Fields that cannot be changed once a record exists, listed by name. */
  actions?: Action[];
  children?: Child[];
  related?: Related[];
  exportPermission?: PermissionKey;
  /** A single record, edited directly (business settings). */
  singleton?: { idColumn: string; idValue: string | boolean };
  /** Own creation flow instead of the generic form. */
  customCreate?: "employee";
  /** Fills in values the person should not have to type, from related records. */
  derive?: "from_order";
  /** Show the order timeline / financials on the detail page. */
  detail?: "order" | "invoice" | "quotation" | "audit";
};
