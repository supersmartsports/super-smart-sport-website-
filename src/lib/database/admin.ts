import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * Service-role client. It bypasses row level security, so it is used only for the few jobs that
 * need it (creating an employee's login, for example) and only after the caller's own permission
 * has been checked with requirePermission(). The "server-only" import makes the build fail if
 * this file is ever pulled into browser code.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set on the server");
  return createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
