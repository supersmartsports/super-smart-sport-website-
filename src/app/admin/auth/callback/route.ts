import { NextResponse, type NextRequest } from "next/server";
import { createUserClient } from "@/lib/database/server";

/** Where the password-reset email link lands: exchanges the one-time code for a session, then moves on. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/admin/dashboard";
  const target = next.startsWith("/admin/") ? next : "/admin/dashboard"; // never redirect off the site
  if (code) {
    const supabase = await createUserClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(target, request.url));
  }
  return NextResponse.redirect(new URL("/admin/forgot-password?expired=1", request.url));
}
