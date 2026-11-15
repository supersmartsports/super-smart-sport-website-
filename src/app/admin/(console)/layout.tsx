import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { visibleModules } from "@/features/auth/permissions";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s | SUPER SMART SPORTS Admin" },
  robots: { index: false, follow: false },
};

// Everything here depends on who is signed in, so nothing is pre-built or cached.
export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const modules = visibleModules(user).map(({ key, label, href, status }) => ({ key, label, href, status }));
  return (
    <AdminShell user={{ fullName: user.fullName, roleName: user.roleName }} modules={modules}>
      {children}
    </AdminShell>
  );
}
