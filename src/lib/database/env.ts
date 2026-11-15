/**
 * Supabase connection settings. The URL and the anon key are public by design: the anon key
 * can only do what row level security allows. The service-role key is read elsewhere, in a
 * server-only module, and never reaches the browser.
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** False until the project has been given its Supabase credentials. */
export function isSupabaseConfigured() {
  return /^https?:\/\//.test(supabaseUrl) && supabaseAnonKey.length > 20;
}
