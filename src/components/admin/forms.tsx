"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/buttons/Button";
import type { ActionState } from "@/features/admin/actions";
import type { Field, Option } from "@/features/admin/types";

const control =
  "mt-1.5 min-h-11 w-full rounded-xs border bg-white px-3 text-base text-navy-deep focus:border-navy focus:outline-2 focus:outline-offset-0 focus:outline-navy";

const today = () => new Date().toISOString().slice(0, 10);

function Input({ field, options, error, value }: { field: Field; options: Option[]; error?: string; value?: unknown }) {
  const id = `f-${field.name}`;
  const common = { id, name: field.name, "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${id}-err` : field.help ? `${id}-help` : undefined };
  const border = error ? "border-red" : "border-line";
  const initial = value ?? (field.default === "today" ? today() : field.default);

  let input: React.ReactNode;
  if (field.type === "checkbox") {
    input = <input {...common} type="checkbox" defaultChecked={Boolean(initial)} className="mt-2 size-5 accent-red" />;
  } else if (field.type === "textarea") {
    input = <textarea {...common} rows={3} defaultValue={String(initial ?? "")} maxLength={field.max} className={`${control} ${border} py-2`} />;
  } else if (field.type === "select" || field.type === "relation") {
    const list = field.type === "select" ? field.options ?? [] : options;
    input = (
      <select {...common} defaultValue={String(initial ?? "")} className={`${control} ${border}`}>
        <option value="">{field.required ? "Choose..." : "None"}</option>
        {list.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    );
  } else {
    const type = field.type === "money" || field.type === "number" ? "text" : field.type;
    input = (
      <input {...common} type={type} inputMode={field.type === "money" || field.type === "number" ? "decimal" : undefined}
        defaultValue={initial === undefined || initial === null ? "" : String(initial)} maxLength={field.max}
        autoComplete={field.type === "password" ? "new-password" : "off"} className={`${control} ${border}`} />
    );
  }
  return (
    <div className={field.type === "textarea" ? "sm:col-span-2" : ""}>
      <label htmlFor={id} className="type-label text-navy-deep">{field.label}{field.required && <span aria-hidden className="text-red"> *</span>}</label>
      {input}
      {field.help && !error && <p id={`${id}-help`} className="mt-1 text-sm text-slate">{field.help}</p>}
      {error && <p id={`${id}-err`} className="mt-1 text-sm font-semibold text-red-deep">{error}</p>}
    </div>
  );
}

function Feedback({ state }: { state: ActionState }) {
  return (
    <p role={state.error ? "alert" : "status"} aria-live="polite" className={`min-h-5 text-sm font-semibold ${state.error ? "text-red-deep" : "text-green-800"}`}>
      {state.error ?? state.ok}
    </p>
  );
}

type SaveAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** One form for creating or editing any record. The action is bound on the server, with the module and record id. */
export function RecordForm({ fields, options, record, action, submitLabel }: {
  fields: Field[]; options: Record<string, Option[]>; record?: Record<string, unknown>; action: SaveAction; submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} noValidate className="grid gap-5 rounded-sm bg-white p-5 ring-1 ring-line sm:grid-cols-2 sm:p-6">
      {fields.map((field) => (
        <Input key={field.name} field={field} options={options[field.name] ?? []} error={state.fieldErrors?.[field.name]} value={record?.[field.name]} />
      ))}
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving" : submitLabel}</Button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

/** The small "add a row" form under a list of items, notes, tasks or movements. */
export function ChildForm({ fields, options, action, title }: { fields: Field[]; options: Record<string, Option[]>; action: SaveAction; title: string }) {
  const [state, formAction, pending] = useActionState(async (prev: ActionState, data: FormData) => {
    const result = await action(prev, data);
    if (result.ok) setVersion((v) => v + 1); // clears the form after a successful add
    return result;
  }, {});
  const [version, setVersion] = useState(0);
  return (
    <form key={version} action={formAction} noValidate className="mt-4 grid gap-4 rounded-sm bg-paper p-4 sm:grid-cols-2">
      <h4 className="font-bold sm:col-span-2">{title}</h4>
      {fields.map((field) => <Input key={field.name} field={field} options={options[field.name] ?? []} error={state.fieldErrors?.[field.name]} />)}
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <Button type="submit" variant="dark" disabled={pending}>{pending ? "Adding" : "Add"}</Button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

/** A button (or a small form) for a record action: change status, confirm a payment, finalize an invoice ... */
export function ActionForm({ label, action, choices, numberArg, confirm, withNote }: {
  label: string; action: SaveAction; choices?: Option[]; numberArg?: { name: string; label: string }; confirm?: string; withNote?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      onSubmit={(event) => { if (confirm && !window.confirm(confirm)) event.preventDefault(); }}
      className="flex flex-wrap items-end gap-3 rounded-sm bg-white p-4 ring-1 ring-line"
    >
      {choices && (
        <div>
          <label htmlFor={`to-${label}`} className="type-label">{label}</label>
          <select id={`to-${label}`} name="to" required className={`${control} min-w-48 border-line`}>
            <option value="">Choose...</option>
            {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </select>
        </div>
      )}
      {withNote && (
        <div className="min-w-56 flex-1">
          <label htmlFor="note" className="type-label">Note (optional)</label>
          <input id="note" name="note" maxLength={1000} className={`${control} border-line`} />
        </div>
      )}
      {numberArg && (
        <div className="min-w-56 flex-1">
          <label htmlFor={numberArg.name} className="type-label">{numberArg.label}</label>
          <input id={numberArg.name} name={numberArg.name} inputMode="decimal" className={`${control} border-line`} />
        </div>
      )}
      <Button type="submit" disabled={pending}>{pending ? "Working" : choices ? "Apply" : label}</Button>
      <div className="basis-full"><Feedback state={state} /></div>
    </form>
  );
}

export function DeleteRowButton({ action, label }: { action: () => Promise<void>; label: string }) {
  return (
    <form action={action} onSubmit={(event) => { if (!window.confirm(`Remove ${label}?`)) event.preventDefault(); }}>
      <button type="submit" className="min-h-9 rounded-xs px-2 text-sm font-semibold text-red-deep underline-offset-4 hover:underline">Remove</button>
    </form>
  );
}

/** Upload a file to a record. Only PNG, JPEG, WebP and PDF up to 10 MB are accepted; the server checks the real file type. */
export function UploadForm({ action, kinds }: { action: SaveAction; kinds: readonly string[] }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3 rounded-sm bg-paper p-4">
      <div>
        <label htmlFor="att-kind" className="type-label">Type</label>
        <select id="att-kind" name="kind" className={`${control} min-w-40 border-line`} defaultValue="document">
          {kinds.map((k) => <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
        </select>
      </div>
      <div className="min-w-60 flex-1">
        <label htmlFor="att-file" className="type-label">File (PNG, JPEG, WebP or PDF, up to 10 MB)</label>
        <input id="att-file" name="file" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required className="mt-1.5 block w-full text-sm file:mr-3 file:min-h-11 file:rounded-xs file:border-0 file:bg-navy file:px-4 file:font-semibold file:text-white" />
      </div>
      <Button type="submit" variant="dark" disabled={pending}>{pending ? "Uploading" : "Attach file"}</Button>
      <div className="basis-full"><Feedback state={state} /></div>
    </form>
  );
}
