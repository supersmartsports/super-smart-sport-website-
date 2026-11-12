import type { IconType } from "react-icons";
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaThreads, FaTiktok } from "react-icons/fa6";
import { socials, type SocialId } from "@/config/site";

export const socialIcons: Record<SocialId, IconType> = {
  instagram: FaInstagram,
  facebook: FaFacebookF,
  threads: FaThreads,
  linkedin: FaLinkedinIn,
  tiktok: FaTiktok,
};

type Props = {
  tone?: "dark" | "light";
  /** "icons" is a compact row; "list" shows each network's name beside its icon. */
  layout?: "icons" | "list";
  className?: string;
};

export function SocialLinks({ tone = "dark", layout = "icons", className = "" }: Props) {
  const onDark = tone === "dark";

  if (layout === "list") {
    return (
      <ul className={`grid gap-px ${className}`}>
        {socials.map(({ id, label, href }) => {
          const Icon = socialIcons[id];
          return (
            <li key={id}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex min-h-14 items-center gap-4 border-b py-3 transition-colors ${
                  onDark ? "border-white/15 text-white hover:border-white/50" : "border-line text-navy-deep hover:border-navy"
                }`}
              >
                <Icon aria-hidden className="size-5 shrink-0 transition-colors group-hover:text-red" />
                <span className="font-semibold">{label}</span>
                <span className={`ml-auto text-sm ${onDark ? "text-white/50" : "text-slate"}`}>Opens in a new tab</span>
              </a>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className={`flex flex-wrap gap-2 ${className}`}>
      {socials.map(({ id, label, href }) => {
        const Icon = socialIcons[id];
        return (
          <li key={id}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`SUPER SMART SPORTS on ${label}`}
              title={label}
              className={`grid size-11 place-items-center rounded-xs border transition-colors ${
                onDark
                  ? "border-white/20 text-white hover:border-red hover:bg-red"
                  : "border-navy/20 text-navy hover:border-navy hover:bg-navy hover:text-white"
              }`}
            >
              <Icon aria-hidden className="size-[1.125rem]" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
