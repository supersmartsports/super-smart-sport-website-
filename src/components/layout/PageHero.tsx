import type { ReactNode } from "react";

/** Navy title band that opens every inner page and sits under the fixed header. */
export function PageHero({ title, lead, children }: { title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-navy-deep text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/2 right-[-10%] aspect-square w-[70vw] max-w-5xl rounded-full bg-navy opacity-70 blur-3xl"
      />
      <div className="shell relative pt-36 pb-16 lg:pt-48 lg:pb-24">
        <h1 className="type-h1 max-w-5xl">{title}</h1>
        {lead && <p className="type-lead mt-6 max-w-[60ch] text-white/75">{lead}</p>}
        {children && <div className="mt-9">{children}</div>}
      </div>
    </section>
  );
}
