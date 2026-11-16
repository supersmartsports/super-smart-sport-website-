"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Send, X } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa6";
import { site } from "@/config/site";

/** Official WhatsApp green. */
const GREEN = "#25D366";
const GREEN_DEEP = "#128C7E";

export type QuickReply = { label: string; message: string };

export type WhatsAppWidgetProps = {
  /** Number in international format, digits only, e.g. 923167327221. */
  phone?: string;
  name?: string;
  logo?: string;
  welcome?: string[];
  quickReplies?: QuickReply[];
  placeholder?: string;
};

const defaultQuickReplies: QuickReply[] = [
  {
    label: "Custom Football Inquiry",
    message:
      "Hello SUPER SMART SPORTS! I am interested in your customized football manufacturing services. Please share more information.",
  },
  {
    label: "Request a Price Quote",
    message:
      "Hello SUPER SMART SPORTS! I would like to request a price quote for customized footballs. Please tell me what details you need, such as football type, quantity, material and branding.",
  },
  {
    label: "Football Materials & Quality",
    message: "Hello SUPER SMART SPORTS! I would like to know more about your football materials and quality standards.",
  },
  {
    label: "Bulk Manufacturing Order",
    message:
      "Hello SUPER SMART SPORTS! I am interested in a bulk manufacturing order of customized footballs. Please share the details and next steps.",
  },
  {
    label: "Custom Logo & Design",
    message:
      "Hello SUPER SMART SPORTS! I would like to discuss custom logo and design options for my footballs. How can I send you my artwork?",
  },
];

const defaultWelcome = [
  "Hello! 👋 Welcome to SUPER SMART SPORTS.",
  "We manufacture premium customized footballs according to your brand, design and specifications.",
  "How can we help you today?",
];

/** Opens WhatsApp with the text filled in. Nothing is sent until the visitor presses send in WhatsApp. */
function openWhatsApp(phone: string, text: string) {
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function WhatsAppWidget({
  phone = site.contact.whatsappNumber,
  name = site.name,
  logo = site.logo.round,
  welcome = defaultWelcome,
  quickReplies = defaultQuickReplies,
  placeholder = "Type your message...",
}: WhatsAppWidgetProps) {
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const pathname = usePathname();
  // On a football page the chat offers a message about that football.
  const [productName, setProductName] = useState<string | null>(null);
  useEffect(() => {
    setProductName(pathname.startsWith("/product/") ? document.querySelector("h1")?.textContent?.trim() || null : null);
  }, [pathname]);
  const replies: QuickReply[] = productName
    ? [{ label: `Ask about the ${productName}`, message: `Hello ${name}! I am interested in the ${productName} football and would like to customize it. Please share more information.` }, ...quickReplies]
    : quickReplies;

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) button.current?.focus();
  }, []);

  // Escape closes; a press outside the widget closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  // On phones the popup nearly fills the screen, so the page behind it must not scroll.
  useEffect(() => {
    if (!open || !window.matchMedia("(max-width: 639px)").matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Move focus into the popup, but not onto the input, so phone keyboards stay closed.
  useEffect(() => {
    if (open) dialog.current?.focus();
  }, [open]);

  const send = (event: FormEvent) => {
    event.preventDefault();
    const message = text.trim();
    if (!message) return;
    openWhatsApp(phone, message);
    setText("");
  };

  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <div
      ref={root}
      className="pointer-events-none fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[38] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 sm:right-6 sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))]"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            ref={dialog}
            id="whatsapp-popup"
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.28, ease }}
            style={{ transformOrigin: "bottom right" }}
            className="pointer-events-auto flex max-h-[min(38rem,calc(100dvh-7.5rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-md bg-white shadow-overlay outline-none ring-1 ring-black/10"
          >
            {/* Header */}
            <div className="flex items-center gap-3 bg-navy px-4 py-3.5 text-white">
              <span className="relative shrink-0">
                <Image src={logo} alt="" width={44} height={44} className="rounded-full bg-white" />
                <span
                  aria-hidden
                  className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full ring-2 ring-navy"
                  style={{ backgroundColor: GREEN }}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p id={titleId} className="truncate text-[0.9375rem] leading-tight font-bold">
                  {name}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/75">
                  <FaWhatsapp aria-hidden className="size-3.5" style={{ color: GREEN }} />
                  WhatsApp Business
                  <span aria-hidden className="text-white/40">
                    /
                  </span>
                  Online
                </p>
              </div>
              <button
                type="button"
                onClick={() => close()}
                aria-label="Close chat"
                className="focus-light grid size-10 shrink-0 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>

            {/* Conversation */}
            <div className="flex-1 overflow-y-auto overscroll-contain bg-[#efeae2] px-4 py-5">
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.12, ease }}
                style={{ transformOrigin: "top left" }}
                className="relative max-w-[88%] rounded-md rounded-tl-none bg-white px-3.5 py-3 text-[0.9375rem] leading-relaxed text-navy-deep shadow-[0_1px_1px_rgb(0_0_0/0.12)]"
              >
                <span aria-hidden className="absolute top-0 -left-1.5 size-0 border-t-[0.5rem] border-r-[0.5rem] border-t-white border-r-transparent" />
                {welcome.map((line) => (
                  <p key={line} className="[&:not(:first-child)]:mt-2">
                    {line}
                  </p>
                ))}
              </motion.div>

              <p className="mt-5 mb-2.5 text-xs font-semibold text-slate">Choose a topic</p>
              <ul className="flex flex-col items-start gap-2">
                {replies.map(({ label, message }, index) => (
                  <motion.li
                    key={label}
                    initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.25 + index * 0.06, ease }}
                  >
                    <button
                      type="button"
                      onClick={() => openWhatsApp(phone, message)}
                      className="min-h-11 rounded-full bg-white px-4 py-2 text-left text-sm font-semibold text-navy ring-1 ring-black/10 transition-[background-color,box-shadow,transform,color] duration-200 hover:bg-[#dcf8c6] hover:text-navy-deep hover:ring-[#25D366] active:scale-[0.98]"
                    >
                      {label}
                    </button>
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Message input */}
            <form onSubmit={send} className="flex items-center gap-2 border-t border-black/10 bg-[#f0f2f5] p-2.5">
              <label htmlFor="whatsapp-message" className="sr-only">
                Your message
              </label>
              <input
                id="whatsapp-message"
                type="text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={placeholder}
                autoComplete="off"
                enterKeyHint="send"
                className="min-h-11 min-w-0 flex-1 rounded-full border-0 bg-white px-4 text-base text-navy-deep placeholder:text-slate/70"
              />
              <button
                type="submit"
                disabled={!text.trim()}
                aria-label="Send message on WhatsApp"
                className="grid size-11 shrink-0 place-items-center rounded-full text-white transition-[background-color,opacity,transform] duration-200 hover:brightness-95 active:scale-95 disabled:opacity-45"
                style={{ backgroundColor: GREEN_DEEP }}
              >
                <Send aria-hidden className="size-5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <motion.div
        className="pointer-events-auto relative"
        initial={reducedMotion ? false : { opacity: 0, scale: 0.4, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 1.2 }}
      >
        <motion.div
          animate={reducedMotion || open ? { y: 0 } : { y: [0, -5, 0] }}
          transition={reducedMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.button
            ref={button}
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="whatsapp-popup"
            aria-label={open ? "Close WhatsApp chat" : "Chat with SUPER SMART SPORTS on WhatsApp"}
            whileHover={reducedMotion ? undefined : { scale: 1.08 }}
            whileTap={reducedMotion ? undefined : { scale: 0.94 }}
            className="focus-light relative grid size-14 place-items-center rounded-full text-white shadow-[0_10px_28px_-6px_rgb(18_140_126/0.7),0_2px_6px_rgb(0_0_0/0.25)] transition-shadow duration-300 hover:shadow-[0_14px_34px_-6px_rgb(18_140_126/0.85),0_2px_8px_rgb(0_0_0/0.3)] sm:size-16"
            style={{ backgroundColor: GREEN }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {open ? (
                <motion.span
                  key="close"
                  initial={reducedMotion ? false : { rotate: -60, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={reducedMotion ? undefined : { rotate: 60, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <X aria-hidden className="size-7" />
                </motion.span>
              ) : (
                <motion.span
                  key="open"
                  initial={reducedMotion ? false : { rotate: 60, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={reducedMotion ? undefined : { rotate: -60, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <FaWhatsapp aria-hidden className="size-8 sm:size-9" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
          {/* Online indicator */}
          <span aria-hidden className="pointer-events-none absolute top-0 right-0 flex size-3.5 sm:size-4">
            {!reducedMotion && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70" />
            )}
            <span className="relative inline-flex size-full rounded-full bg-[#4ADE80] ring-2 ring-white" />
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
