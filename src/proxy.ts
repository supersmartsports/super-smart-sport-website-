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
  // Pages a signed-out person must be able to reach: sign-in, the reset request, and the emailed link.
  const open = onLogin || pathname === "/admin/forgot-password" || pathname === "/admin/auth/callback";
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url));

  if (!isSupabaseConfigured()) return open ? NextResponse.next() : redirectTo("/admin/login");

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

  // getClaims checks the signed login token here, without a call to the auth server on every page
  // (getUser calls it each time and is rate limited, which signed staff out under normal use).
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  if (!signedIn && !open) return redirectTo("/admin/login");
  if (signedIn && onLogin) return redirectTo("/admin/dashboard");
  return response;
}

export const config = { matcher: ["/admin/:path*"] };
