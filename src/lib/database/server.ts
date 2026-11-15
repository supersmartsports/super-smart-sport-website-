import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * A Supabase client that acts as the signed-in user. Every query it runs is checked by the
 * database's row level security, so server code cannot read or write more than that user may.
 */
export async function createUserClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          for (const { name, value, options } of items) cookieStore.set(name, value, options);
        } catch {
          // Called while rendering a page, where cookies are read-only. The proxy refreshes the session instead.
        }
      },
    },
  });
}
