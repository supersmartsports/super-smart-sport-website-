# Backend setup and deployment

Nothing here has been run against a real Supabase project: that needs your credentials. Do each step yourself,
on a **new, empty Supabase project first** (a staging project), and only then on production.

## 1. Create the project

1. Create a Supabase project (supabase.com). Choose the region closest to your customers and staff.
2. In *Project settings > API* copy the project URL, the `anon` key and the `service_role` key.
3. Under *Authentication > Providers*, keep Email enabled, **disable public sign-ups** (staff accounts are created by the owner), and require strong passwords.

## 2. Environment variables

| Variable | Where it is used | Secret? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser and server. Limited by row level security | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only (creating employee logins). Bypasses row level security | **Yes. Never commit, never expose** |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs and sitemap, once the domain is confirmed | No |

Put them in `.env.local` for development and in your host's environment settings for production. `.env*` files are git-ignored.
The service key is only imported by `src/lib/database/admin.ts`, which uses `server-only`, so the build fails if it is ever pulled into browser code.

## 3. Apply the database migrations

Run the files in `database/migrations` **in order** (0001 to 0011) in the Supabase SQL editor, or with the Supabase CLI
(`supabase db push`). They create tables, constraints, row level security policies and the standard roles and permissions.
They contain no business data. Run them on the empty staging project first and confirm there are no errors.

## 4. Create the first owner

1. *Authentication > Users > Add user*: create the owner's login (email and a strong password).
2. Copy the new user's id and run `database/seed/create-first-owner.sql` in the SQL editor with that id filled in.
3. Sign in at `/admin/login`. The owner can then create every other employee from *Employees > New employee*.

## 5. Storage

Migration 0008 creates a private `business-files` bucket and its policies when Supabase Storage exists. File upload screens are a
later stage; until then no files are stored.

## 6. Checks before going live

- [ ] Staging project: migrations apply with no errors; first owner can sign in.
- [ ] Create one user of each role and confirm each sees only their own modules (the database enforces this, the menu only reflects it).
- [ ] Enter a test order, payment and invoice on staging and compare the Profit & Loss page with a hand calculation.
- [ ] Turn on Supabase point-in-time recovery or scheduled backups (paid plans) and test a restore.
- [ ] Add a production domain to *Authentication > URL configuration*.
- [ ] Put a rate limiter or firewall rule in front of `/admin/login` and the quote form (the in-app limiter is per server instance).
- [ ] Add a Content-Security-Policy header after testing it against the 3D viewer (not added yet because it needs live testing).

## 7. Backup and recovery plan

- Database: enable Supabase backups; for the highest assurance enable point-in-time recovery and run a restore test each quarter.
- Because ledger tables are append-only, a restore never needs to "fix" history: mistakes are corrected with new rows.
- Files: the `business-files` bucket is not covered by database backups. Export it periodically.
- Keep the migrations in git. They are the schema's source of truth.

## 8. Running the tests

```bash
npm test
```

The database tests run the real migrations in an in-memory Postgres (PGlite) with Supabase's `auth` schema stubbed.
They need no credentials and touch no real data.
