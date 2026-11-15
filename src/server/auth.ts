import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/database/env";
import { createUserClient } from "@/lib/database/server";
import { hasPermission, type PermissionKey, type SessionUser } from "@/features/auth/permissions";

/**
 * The data access layer's gatekeeper. Every admin page and every server action starts here.
 * The user's identity is verified with the auth server, and their role and permissions come from
 * the database (my_access), never from anything the browser sends.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase.rpc("my_access");
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return null; // signed in, but no active staff profile

  return {
    id: row.user_id,
    email: auth.user.email ?? "",
    fullName: row.full_name,
    roleKey: row.role_key,
    roleName: row.role_name,
    permissions: row.permissions ?? [],
  };
});

/** For pages: sends anyone who is not active staff to the sign-in page. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** For pages and actions that need a specific permission. The database enforces it again. */
export async function requirePermission(permission: PermissionKey): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user, permission)) redirect("/admin/dashboard?denied=1");
  return user;
}
