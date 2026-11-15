"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { site } from "@/config/site";
import { signOut } from "@/features/auth/actions";

export type ShellModule = { key: string; label: string; href: string; status: "ready" | "planned" };

type Props = {
  user: { fullName: string; roleName: string };
  modules: ShellModule[];
  children: ReactNode;
};

/** The dashboard frame: collapsible sidebar on large screens, a drawer on phones. Navigation shows only permitted modules. */
export function AdminShell({ user, modules, children }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  const nav = (compact: boolean) => (
    <nav aria-label="Dashboard" className="flex-1 overflow-y-auto px-2 py-3">
      <ul className="grid gap-0.5">
        {modules.map((module) => {
          const active = pathname === module.href || pathname.startsWith(`${module.href}/`);
          return (
            <li key={module.key}>
              <Link
                href={module.href}
                aria-current={active ? "page" : undefined}
                title={compact ? module.label : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xs px-3 text-sm font-semibold transition-colors ${
                  active ? "bg-white text-navy-deep" : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span aria-hidden className={`grid size-6 shrink-0 place-items-center rounded-xs text-xs ${active ? "bg-navy text-white" : "bg-white/10"}`}>
                  {module.label.charAt(0)}
                </span>
                {!compact && (
                  <>
                    <span className="truncate">{module.label}</span>
                    {module.status === "planned" && <span className="ml-auto text-[0.625rem] font-medium tracking-wide text-white/45 uppercase">Soon</span>}
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <div className="flex min-h-svh bg-paper text-navy-deep">
      {/* Large screens */}
      <aside className={`sticky top-0 hidden h-svh shrink-0 flex-col bg-navy-deep transition-[width] duration-200 lg:flex ${collapsed ? "w-[4.5rem]" : "w-64"}`}>
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
          <Image src={site.logo.round} alt="" width={36} height={36} className="rounded-full bg-white" />
          {!collapsed && <span className="truncate text-sm font-extrabold tracking-wide text-white uppercase [font-stretch:80%]">{site.name}</span>}
        </div>
        {nav(collapsed)}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex min-h-12 items-center gap-3 border-t border-white/10 px-5 text-sm text-white/70 hover:text-white"
        >
          {collapsed ? <PanelLeftOpen aria-hidden className="size-5" /> : <PanelLeftClose aria-hidden className="size-5" />}
          {!collapsed && "Collapse"}
        </button>
      </aside>

      {/* Phones */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setDrawer(false)} className="absolute inset-0 bg-black/60" />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-navy-deep">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
              <span className="text-sm font-extrabold tracking-wide text-white uppercase [font-stretch:80%]">{site.name}</span>
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="grid size-10 place-items-center text-white">
                <X aria-hidden className="size-5" />
              </button>
            </div>
            {nav(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white px-4 sm:px-6">
          <button type="button" onClick={() => setDrawer(true)} aria-label="Open menu" className="grid size-11 place-items-center rounded-xs border border-line lg:hidden">
            <Menu aria-hidden className="size-5" />
          </button>
          <div className="ml-auto flex items-center gap-4">
            <p className="text-right text-sm leading-tight">
              <span className="block font-bold">{user.fullName}</span>
              <span className="text-slate">{user.roleName}</span>
            </p>
            <form action={signOut}>
              <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-xs border border-line px-3 text-sm font-semibold hover:border-navy">
                <LogOut aria-hidden className="size-4" />
                <span className="hidden sm:inline">Sign out</span>
                <span className="sr-only sm:hidden">Sign out</span>
              </button>
            </form>
          </div>
        </header>
        <main id="admin-main" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
