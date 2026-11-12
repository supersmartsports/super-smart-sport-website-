import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  lead?: ReactNode;
  tone?: "light" | "dark";
  as?: "h1" | "h2";
  /** Optional action aligned to the heading on wide screens. */
  action?: ReactNode;
  className?: string;
};

export function SectionHeading({ title, lead, tone = "light", as: Heading = "h2", action, className = "" }: Props) {
  const onDark = tone === "dark";
  return (
    <div className={`flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between ${className}`}>
      <div className="max-w-4xl">
        <Heading className={`${Heading === "h1" ? "type-h1" : "type-h2"} ${onDark ? "text-white" : "text-navy-deep"}`}>
          {title}
        </Heading>
        {lead && <p className={`type-lead mt-5 max-w-[62ch] ${onDark ? "text-white/75" : "text-slate"}`}>{lead}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
