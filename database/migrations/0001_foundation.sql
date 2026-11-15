-- 0001 Foundation: helpers, document numbering, settings, exchange rates, roles and profiles.
-- Written for Supabase (PostgreSQL 15+). Nothing here inserts business data.

create schema if not exists app;

-- Generic updated_at trigger ---------------------------------------------------
create or replace function app.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Ledger tables use this: rows can be added, never changed or removed.
create or replace function app.forbid_change() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only: rows cannot be changed or deleted', tg_table_name;
end $$;

-- Document numbering: QT-2026-0001, ORD-2026-0001 ... --------------------------
create table document_sequences (
  kind        text not null,
  year        int  not null,
  last_value  int  not null default 0,
  primary key (kind, year)
);

create or replace function app.next_document_number(p_kind text, p_prefix text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_year int := extract(year from now())::int;
  v_next int;
begin
  insert into document_sequences (kind, year, last_value) values (p_kind, v_year, 1)
  on conflict (kind, year) do update set last_value = document_sequences.last_value + 1
  returning last_value into v_next;
  return p_prefix || '-' || v_year || '-' || lpad(v_next::text, 4, '0');
end $$;

-- Business settings (one row) ---------------------------------------------------
create table business_settings (
  id                          boolean primary key default true check (id),
  company_name                text not null default 'SUPER SMART SPORTS',
  legal_name                  text,
  address                     text,
  email                       text,
  phone                       text,
  logo_path                   text,
  reporting_currency          text not null default 'USD' check (reporting_currency ~ '^[A-Z]{3}$'),
  default_tax_rate            numeric(5,2) not null default 0 check (default_tax_rate between 0 and 100),
  quotation_validity_days     int not null default 30 check (quotation_validity_days > 0),
  invoice_payment_terms_days  int not null default 30 check (invoice_payment_terms_days >= 0),
  payment_instructions        text,
  -- How shared operating expenses are spread over orders when computing net profit.
  overhead_allocation_method  text not null default 'revenue_share'
                              check (overhead_allocation_method in ('revenue_share', 'direct_cost_share')),
  updated_at                  timestamptz not null default now()
);
create trigger business_settings_updated before update on business_settings
  for each row execute function app.set_updated_at();

-- Exchange rates: explicit, dated, never implied ---------------------------------
create table exchange_rates (
  id             uuid primary key default gen_random_uuid(),
  from_currency  text not null check (from_currency ~ '^[A-Z]{3}$'),
  to_currency    text not null check (to_currency ~ '^[A-Z]{3}$'),
  rate           numeric(18,8) not null check (rate > 0),
  effective_date date not null,
  source         text,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  check (from_currency <> to_currency),
  unique (from_currency, to_currency, effective_date)
);

-- Roles, permissions, profiles ---------------------------------------------------
create table roles (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique check (key ~ '^[a-z_]+$'),
  name        text not null,
  description text,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table permissions (
  key         text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  module      text not null,
  description text not null
);

create table role_permissions (
  role_id        uuid not null references roles(id) on delete cascade,
  permission_key text not null references permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

-- One profile per Supabase auth user. The role lives here, never in client-editable metadata.
create table profiles (
  id           uuid primary key references auth.users(id) on delete restrict,
  full_name    text not null,
  email        text,
  phone        text,
  role_id      uuid not null references roles(id),
  is_active    boolean not null default true,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index profiles_role_idx on profiles (role_id);
create trigger profiles_updated before update on profiles for each row execute function app.set_updated_at();

-- Per-user exceptions: grant or revoke a single permission on top of the role.
create table profile_permissions (
  profile_id     uuid not null references profiles(id) on delete cascade,
  permission_key text not null references permissions(key) on delete cascade,
  granted        boolean not null,
  primary key (profile_id, permission_key)
);

-- The single place permissions are decided. RLS policies and RPC functions call this.
create or replace function app.has_permission(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles me where me.id = auth.uid() and me.is_active)
     and coalesce(
       (select pp.granted from profile_permissions pp where pp.profile_id = auth.uid() and pp.permission_key = p_key),
       exists (
         select 1
         from profiles me
         join roles r on r.id = me.role_id
         left join role_permissions rp on rp.role_id = r.id and rp.permission_key = p_key
         where me.id = auth.uid() and (r.key = 'super_admin' or rp.permission_key is not null)
       )
     )
$$;

-- Common column helper used by later migrations: who created a row.
create or replace function app.current_actor() returns uuid
language sql stable as $$ select auth.uid() $$;
