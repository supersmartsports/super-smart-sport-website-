import type { ComponentProps, ReactNode } from "react";

const control =
  "w-full rounded-xs border bg-white px-4 text-base text-navy-deep placeholder:text-slate/60 transition-colors " +
  "focus:border-navy focus:outline-2 focus:outline-offset-0 focus:outline-navy";

function controlClass(invalid: boolean, extra: string) {
  return `${control} ${invalid ? "border-red" : "border-line hover:border-navy/50"} ${extra}`;
}

type Wrapper = {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
};

function FieldWrapper({ id, label, required, hint, error, children, className = "" }: Wrapper) {
  return (
    <div className={className}>
      <label htmlFor={id} className="type-label flex items-baseline justify-between gap-3 text-navy-deep">
        <span>{label}</span>
        {!required && <span className="font-medium tracking-normal text-slate normal-case">Optional</span>}
      </label>
      <div className="mt-2">{children}</div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-slate">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-semibold text-red-deep">
          {error}
        </p>
      )}
    </div>
  );
}

type Shared = { id: string; label: string; hint?: string; error?: string; wrapperClassName?: string };

function describedBy(id: string, hint?: string, error?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export function TextField({ id, label, hint, error, wrapperClassName, required, ...props }: Shared & ComponentProps<"input">) {
  return (
    <FieldWrapper id={id} label={label} required={required} hint={hint} error={error} className={wrapperClassName}>
      <input
        id={id}
        name={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={controlClass(Boolean(error), "min-h-12")}
        {...props}
      />
    </FieldWrapper>
  );
}

export function SelectField({
  id,
  label,
  hint,
  error,
  wrapperClassName,
  required,
  children,
  ...props
}: Shared & ComponentProps<"select">) {
  return (
    <FieldWrapper id={id} label={label} required={required} hint={hint} error={error} className={wrapperClassName}>
      <select
        id={id}
        name={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={controlClass(Boolean(error), "min-h-12 pr-10")}
        {...props}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}

export function TextAreaField({ id, label, hint, error, wrapperClassName, required, ...props }: Shared & ComponentProps<"textarea">) {
  return (
    <FieldWrapper id={id} label={label} required={required} hint={hint} error={error} className={wrapperClassName}>
      <textarea
        id={id}
        name={id}
        required={required}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={controlClass(Boolean(error), "min-h-28 py-3 leading-relaxed")}
        {...props}
      />
    </FieldWrapper>
  );
}
