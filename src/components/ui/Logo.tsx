import Image from "next/image";
import Link from "next/link";
import { site } from "@/config/site";

/** The official logo, shown unaltered on its own white roundel, with the company name beside it. */
export function Logo({ size = 48, withName = true, className = "" }: { size?: number; withName?: boolean; className?: string }) {
  return (
    <Link href="/" aria-label={`${site.name} home`} className={`group inline-flex items-center gap-3 ${className}`}>
      <Image
        src={site.logo.round}
        alt=""
        width={size}
        height={size}
        priority
        className="rounded-full bg-white ring-1 ring-white/20"
      />
      {withName && (
        <span className="text-[1.0625rem] leading-[0.95] font-extrabold tracking-[0.01em] text-white uppercase [font-stretch:70%]">
          Super Smart
          <br />
          <span className="text-red">Sports</span>
        </span>
      )}
    </Link>
  );
}
