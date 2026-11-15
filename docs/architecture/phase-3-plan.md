# Phase 3: business management platform. Development plan

## Starting point (inspected)

- Next.js 16.4 (App Router, Turbopack), React 19, TypeScript, Tailwind 4. Public website complete.
- No backend existed: `src/app/admin` and `src/app/api` were empty folders, no auth, no database, no tests.
- No Postgres, Docker or Supabase CLI on this machine. No Supabase project credentials exist yet.
- No backend, database or ERP skills are installed (only design and motion skills), so this phase follows the engineering
  guidance in the Next.js docs bundled with the project (`node_modules/next/dist/docs`, authentication and proxy guides)
  and standard Postgres/Supabase practice.

## Architecture decisions

| Area | Decision | Why |
| --- | --- | --- |
| Database | PostgreSQL via Supabase | Requested; row level security (RLS) is enforced by the database itself |
| Auth | Supabase Auth, email + password | No passwords handled by our code |
| Authorization | Permission keys (`orders.read`, `payments.confirm` ...) granted to roles, with per-user overrides | Roles must be configurable |
| Where rules live | In the database (RLS, triggers, functions) first, then server code | A bug or a stolen browser session cannot bypass them |
| Server access | A data access layer (`src/server`) that re-checks permissions; the service-role key exists only in server-only modules | Hiding buttons is not security |
| Money | `numeric(14,2)`, each amount stored with its own currency and an explicit rate to the reporting currency | No silent mixing of EUR, USD and PKR |
| Ledger | Payments, invoices, status history, stock movements and audit logs are append-only or frozen once final; corrections are new rows | Traceable financial history |
| Tests | Vitest. Migrations run for real against an in-process Postgres (PGlite) with Supabase's `auth` stubbed | Verifies constraints, RLS and triggers without a cloud database |

## Financial methodology

- **Revenue** = order total after discount, excluding pass-through tax. **Cash received** = confirmed payments only, minus confirmed refunds.
  A deposit never counts as revenue received beyond what was paid.
- **Outstanding balance** = amount due (order total plus invoice debit notes minus credit notes) minus cash received.
- **Gross profit** = net sales revenue minus direct manufacturing costs. **Contribution margin** = net sales revenue minus variable costs.
- **Net profit** = gross profit minus allocated operating expenses. Shared operating expenses are allocated to orders by revenue share
  (documented, configurable in `business_settings`). Each expense can be allocated at most once in total (enforced by a trigger).
- **Estimated vs actual**: estimated uses quoted values, actual uses recorded costs and confirmed cash. They are always reported separately.
- All conversions use the explicit rate stored on each transaction; reports show the reporting currency and the original amounts.

## Stages

| Stage | Scope | Status in this delivery |
| --- | --- | --- |
| 3A | Database foundation: schema, constraints, ledger rules, RLS, reference data, migration tests | Built and tested |
| 3B | Auth, route protection, roles and permissions, admin shell | Built and tested; needs Supabase credentials to log in |
| 3C to 3J | Screens and server actions for each module | Not started: waits for approval and credentials |
| 3K | Full integration and security test pass | Not started |

Pure business logic needed by every later stage (finance calculations, order workflow, permissions) is built and tested now, so
the screens in later stages only wire it up.
