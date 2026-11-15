import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

/**
 * A throwaway Postgres (PGlite) with just enough of Supabase stubbed to run the real migrations:
 * the `auth` schema, `auth.uid()` and the three API roles. All data created here is test data in memory.
 */
const SUPABASE_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  grant usage on schema auth to anon, authenticated;
`;

export async function createDatabase() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = join(process.cwd(), "database", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(join(dir, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
  return db;
}

export type Db = Awaited<ReturnType<typeof createDatabase>>;

/** Creates a signed-in test user holding the given standard role and returns their id. */
export async function createUser(db: Db, roleKey: string, name = roleKey): Promise<string> {
  const user = await db.query<{ id: string }>("insert into auth.users (email) values ($1) returning id", [`${name}-${Math.random().toString(36).slice(2)}@test.local`]);
  const id = user.rows[0].id;
  await db.query(
    "insert into profiles (id, full_name, role_id) values ($1, $2, (select id from roles where key = $3))",
    [id, name, roleKey],
  );
  return id;
}

/** Runs the callback exactly as the database would see a request from this user (RLS applies). */
export async function asUser<T>(db: Db, userId: string, run: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec("set role authenticated");
  try {
    return await run();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

/** Runs the callback as the public website visitor (anonymous). */
export async function asAnon<T>(db: Db, run: () => Promise<T>): Promise<T> {
  await db.exec("set role anon");
  try {
    return await run();
  } finally {
    await db.exec("reset role");
  }
}

export async function rejects(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected the statement to be rejected, but it succeeded");
}
