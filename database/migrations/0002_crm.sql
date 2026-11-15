-- 0002 CRM: customers, notes, inquiries, attachments, products.

create table customers (
  id                  uuid primary key default gen_random_uuid(),
  customer_code       text not null unique default app.next_document_number('customer', 'CU'),
  name                text not null check (length(trim(name)) > 0),
  company             text,
  email               text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  whatsapp            text,
  -- Digits only, so "+44 7700 900123" and "447700900123" are recognised as the same number.
  whatsapp_digits     text generated always as (nullif(regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g'), '')) stored,
  country             text,
  address             text,
  customer_type       text not null default 'other'
                      check (customer_type in ('brand', 'club', 'academy', 'distributor', 'individual', 'other')),
  source              text not null default 'other'
                      check (source in ('website', 'whatsapp', 'instagram', 'facebook', 'threads', 'linkedin', 'tiktok', 'referral', 'other')),
  notes               text,
  archived_at         timestamptz,
  archived_by         uuid references profiles(id),
  created_by          uuid references profiles(id) default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
-- Duplicate prevention among active customers.
create unique index customers_email_unique on customers (lower(email)) where email is not null and archived_at is null;
create unique index customers_whatsapp_unique on customers (whatsapp_digits) where whatsapp_digits is not null and archived_at is null;
create index customers_country_idx on customers (country);
create index customers_name_idx on customers (lower(name));
create trigger customers_updated before update on customers for each row execute function app.set_updated_at();

create table customer_notes (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete restrict,
  body        text not null check (length(trim(body)) > 0),
  created_by  uuid references profiles(id) default auth.uid(),
  created_at  timestamptz not null default now()
);
create index customer_notes_customer_idx on customer_notes (customer_id, created_at desc);

create table inquiries (
  id             uuid primary key default gen_random_uuid(),
  inquiry_number text not null unique default app.next_document_number('inquiry', 'INQ'),
  customer_id    uuid references customers(id),
  name           text not null check (length(trim(name)) between 1 and 200),
  company        text check (company is null or length(company) <= 200),
  email          text check (email is null or length(email) <= 254),
  whatsapp       text check (whatsapp is null or length(whatsapp) <= 40),
  country        text check (country is null or length(country) <= 100),
  football_type  text check (football_type is null or length(football_type) <= 100),
  quantity       int check (quantity is null or quantity > 0),
  requirements   jsonb not null default '{}'::jsonb,
  message        text check (message is null or length(message) <= 5000),
  source         text not null default 'website',
  status         text not null default 'new'
                 check (status in ('new', 'contacted', 'negotiating', 'quotation_sent', 'converted', 'lost')),
  assigned_to    uuid references profiles(id),
  follow_up_date date,
  lost_reason    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index inquiries_status_idx on inquiries (status, created_at desc);
create index inquiries_assigned_idx on inquiries (assigned_to) where assigned_to is not null;
create trigger inquiries_updated before update on inquiries for each row execute function app.set_updated_at();

create table inquiry_activities (
  id          uuid primary key default gen_random_uuid(),
  inquiry_id  uuid not null references inquiries(id) on delete restrict,
  kind        text not null check (kind in ('note', 'call', 'email', 'whatsapp', 'status_change')),
  body        text not null check (length(trim(body)) > 0),
  created_by  uuid references profiles(id) default auth.uid(),
  created_at  timestamptz not null default now()
);
create index inquiry_activities_inquiry_idx on inquiry_activities (inquiry_id, created_at desc);

-- Public website form -> one narrow, validated entry point. The anonymous role can call this
-- function and nothing else; it cannot read or change any table.
create or replace function public.submit_inquiry(
  p_name text, p_email text, p_whatsapp text, p_country text, p_company text,
  p_football_type text, p_quantity int, p_message text, p_requirements jsonb, p_source text default 'website'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'name is required'; end if;
  if coalesce(trim(p_email), '') = '' and coalesce(trim(p_whatsapp), '') = '' then
    raise exception 'an email or a WhatsApp number is required';
  end if;
  if p_email is not null and p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'email is invalid'; end if;
  if p_requirements is not null and pg_column_size(p_requirements) > 20000 then raise exception 'requirements too large'; end if;

  insert into inquiries (name, email, whatsapp, country, company, football_type, quantity, message, requirements, source)
  values (trim(p_name), nullif(trim(p_email), ''), nullif(trim(p_whatsapp), ''), nullif(trim(p_country), ''),
          nullif(trim(p_company), ''), nullif(trim(p_football_type), ''), p_quantity, p_message,
          coalesce(p_requirements, '{}'::jsonb), left(coalesce(p_source, 'website'), 40))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.submit_inquiry(text, text, text, text, text, text, int, text, jsonb, text) from public;
grant execute on function public.submit_inquiry(text, text, text, text, text, text, int, text, jsonb, text) to anon, authenticated;

-- Files: metadata only. The file itself lives in Supabase Storage (private buckets).
create table attachments (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null check (entity_type in (
                 'customer', 'inquiry', 'quotation', 'order', 'batch', 'inspection',
                 'payment', 'invoice', 'expense', 'shipment', 'supplier', 'purchase_order')),
  entity_id    uuid not null,
  kind         text not null default 'document'
               check (kind in ('artwork', 'logo', 'proof', 'receipt', 'document', 'photo', 'other')),
  bucket       text not null default 'business-files',
  storage_path text not null unique,
  file_name    text not null check (length(file_name) between 1 and 255),
  mime_type    text not null check (mime_type in (
                 'image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'image/svg+xml',
                 'application/postscript', 'application/zip')),
  size_bytes   int not null check (size_bytes > 0 and size_bytes <= 26214400),
  uploaded_by  uuid references profiles(id) default auth.uid(),
  created_at   timestamptz not null default now()
);
create index attachments_entity_idx on attachments (entity_type, entity_id);

create table products (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]+$'),
  sku          text not null unique,
  name         text not null,
  panel_count  int check (panel_count is null or panel_count > 0),
  construction text,
  material     text,
  description  text,
  model_path   text,
  poster_path  text,
  is_active    boolean not null default true,
  created_by   uuid references profiles(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger products_updated before update on products for each row execute function app.set_updated_at();
