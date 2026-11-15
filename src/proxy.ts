import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/database/env";

/**
 * First line of defence for /admin: keeps the sign-in session fresh and sends visitors without
 * one to the sign-in page. This is only a quick check. Every page and action verifies the user
 * again (src/server/auth.ts) and the database enforces permissions on every query.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const onLogin = pathname === "/admin/login";
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url));

  if (!isSupabaseConfigured()) return onLogin ? NextResponse.next() : redirectTo("/admin/login");

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        for (const { name, value } of items) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of items) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (!data.user && !onLogin) return redirectTo("/admin/login");
  if (data.user && onLogin) return redirectTo("/admin/dashboard");
  return response;
}

export const config = { matcher: ["/admin/:path*"] };
