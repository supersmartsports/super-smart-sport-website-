import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "light" | "dark" | "outline-light" | "outline-dark";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2.5 rounded-xs font-bold uppercase tracking-[0.06em] [font-stretch:82%] " +
  "transition-[background-color,color,border-color,transform] duration-200 ease-out active:translate-y-px " +
  "disabled:pointer-events-none disabled:opacity-50";

const sizes: Record<Size, string> = {
  md: "min-h-11 px-5 text-[0.8125rem]",
  lg: "min-h-14 px-7 text-[0.9375rem]",
};

const variants: Record<Variant, string> = {
  primary: "bg-red text-white hover:bg-red-deep focus-light",
  light: "bg-white text-navy hover:bg-paper",
  dark: "bg-navy text-white hover:bg-navy-deep",
  "outline-light": "border border-white/35 text-white hover:border-white hover:bg-white hover:text-navy-deep",
  "outline-dark": "border border-navy/30 text-navy hover:border-navy hover:bg-navy hover:text-white",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className = "") {
  return `${base} ${sizes[size]} ${variants[variant]} ${className}`;
}

type Shared = { variant?: Variant; size?: Size; children: ReactNode; className?: string };

/** Internal navigation styled as a button. */
export function ButtonLink({
  variant,
  size,
  className,
  children,
  ...props
}: Shared & Omit<ComponentProps<typeof Link>, "className" | "children">) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

/** External link (WhatsApp, email, social) styled as a button. */
export function ButtonAnchor({
  variant,
  size,
  className,
  children,
  ...props
}: Shared & Omit<ComponentProps<"a">, "className" | "children">) {
  const external = props.href?.startsWith("http");
  return (
    <a
      className={buttonClass(variant, size, className)}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...props}
    >
      {children}
    </a>
  );
}

export function Button({
  variant,
  size,
  className,
  children,
  ...props
}: Shared & Omit<ComponentProps<"button">, "className" | "children">) {
  return (
    <button className={buttonClass(variant, size, className)} {...props}>
      {children}
    </button>
  );
}
