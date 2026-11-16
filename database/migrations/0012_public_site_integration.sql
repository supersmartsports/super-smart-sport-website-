-- 0012 Public website integration: published catalogue, approved reviews, safe inquiry intake,
-- and a date-filtered dashboard. The public site reads only through the two views below, which
-- expose published columns and nothing else.

-- Catalogue fields for the website ---------------------------------------------------------------
alter table products
  add column featured   boolean not null default false,
  add column sort_order int not null default 0,
  add column images     jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array');
comment on column products.is_active is 'Published: only active products appear on the public website.';

-- Reviews: shown publicly only once approved by staff ----------------------------------------------
create table reviews (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid references products(id),
  customer_name text not null check (length(trim(customer_name)) between 1 and 120),
  country       text check (country is null or length(country) <= 100),
  rating        int not null check (rating between 1 and 5),
  body          text not null check (length(trim(body)) between 1 and 2000),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  source        text not null default 'website' check (source in ('website', 'admin')),
  approved_by   uuid references profiles(id),
  approved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index reviews_product_idx on reviews (product_id, created_at desc) where status = 'approved';
create index reviews_status_idx on reviews (status, created_at desc);
create trigger reviews_updated before update on reviews for each row execute function app.set_updated_at();

create or replace function app.guard_review() returns trigger
language plpgsql as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.approved_by := auth.uid();
    new.approved_at := now();
  elsif new.status <> 'approved' then
    new.approved_by := null;
    new.approved_at := null;
  end if;
  return new;
end $$;
create trigger reviews_guard before update of status on reviews for each row execute function app.guard_review();
create trigger audit_reviews after insert or update or delete on reviews for each row execute function app.audit_row();

insert into permissions (key, module, description) values
  ('reviews.read',  'reviews', 'View customer reviews'),
  ('reviews.write', 'reviews', 'Add, approve and reject customer reviews')
on conflict (key) do nothing;
insert into role_permissions (role_id, permission_key)
select r.id, p.key from roles r join permissions p on p.key in ('reviews.read', 'reviews.write') where r.key in ('admin', 'sales_manager')
on conflict do nothing;

alter table reviews enable row level security;
create policy reviews_select on reviews for select to authenticated using (app.has_permission('reviews.read'));
create policy reviews_insert on reviews for insert to authenticated with check (app.has_permission('reviews.write'));
create policy reviews_update on reviews for update to authenticated using (app.has_permission('reviews.write')) with check (app.has_permission('reviews.write'));
grant select, insert, update on reviews to authenticated;

-- The only door the public site uses -------------------------------------------------------------------
create view public_products as
  select id, slug, sku, name, panel_count, construction, material, description, model_path, poster_path, images, featured, sort_order
  from products where is_active;

create view public_reviews as
  select r.id, r.product_id, p.slug as product_slug, r.customer_name, r.country, r.rating, r.body, r.created_at
  from reviews r left join products p on p.id = r.product_id
  where r.status = 'approved';

grant select on public_products, public_reviews to anon, authenticated;

-- A visitor can leave a review; it stays hidden until staff approve it.
create or replace function public.submit_review(p_product_slug text, p_name text, p_country text, p_rating int, p_body text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_product uuid; v_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 or length(p_name) > 120 then raise exception 'name is required'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'rating must be 1 to 5'; end if;
  if p_body is null or length(trim(p_body)) = 0 or length(p_body) > 2000 then raise exception 'review text is required'; end if;
  if p_product_slug is not null then
    select id into v_product from products where slug = p_product_slug and is_active;
  end if;
  insert into reviews (product_id, customer_name, country, rating, body, status, source)
  values (v_product, trim(p_name), nullif(trim(p_country), ''), p_rating, trim(p_body), 'pending', 'website')
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.submit_review(text, text, text, int, text) from public;
grant execute on function public.submit_review(text, text, text, int, text) to anon, authenticated;

-- Inquiry intake: idempotent, links or creates the customer ----------------------------------------------
alter table inquiries add column idempotency_key text unique check (idempotency_key is null or length(idempotency_key) between 8 and 80);

create or replace function public.submit_inquiry_v2(
  p_key text, p_name text, p_email text, p_whatsapp text, p_country text, p_company text,
  p_football_type text, p_quantity int, p_message text, p_requirements jsonb, p_source text default 'website'
) returns table (id uuid, inquiry_number text, duplicate boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid;
  v_digits   text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
  v_email    text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_row      inquiries%rowtype;
begin
  -- The same submission sent twice (double click, retry) returns the first record.
  if p_key is not null then
    select * into v_row from inquiries where idempotency_key = p_key;
    if found then return query select v_row.id, v_row.inquiry_number, true; return; end if;
  end if;

  if p_name is null or length(trim(p_name)) = 0 then raise exception 'name is required'; end if;
  if v_email is null and v_digits is null then raise exception 'an email or a WhatsApp number is required'; end if;
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'email is invalid'; end if;
  if p_requirements is not null and pg_column_size(p_requirements) > 20000 then raise exception 'requirements too large'; end if;

  -- Link to an existing active customer by email or WhatsApp number, otherwise create one.
  select c.id into v_customer from customers c
  where c.archived_at is null and ((v_email is not null and lower(c.email) = v_email) or (v_digits is not null and c.whatsapp_digits = v_digits))
  order by c.created_at limit 1;
  if v_customer is null then
    insert into customers (name, company, email, whatsapp, country, source)
    values (trim(p_name), nullif(trim(p_company), ''), v_email, nullif(trim(p_whatsapp), ''), nullif(trim(p_country), ''), 'website')
    returning customers.id into v_customer;
  end if;

  begin
    insert into inquiries (idempotency_key, customer_id, name, email, whatsapp, country, company, football_type, quantity, message, requirements, source)
    values (p_key, v_customer, trim(p_name), v_email, nullif(trim(p_whatsapp), ''), nullif(trim(p_country), ''), nullif(trim(p_company), ''),
            nullif(trim(p_football_type), ''), p_quantity, p_message, coalesce(p_requirements, '{}'::jsonb), left(coalesce(p_source, 'website'), 40))
    returning * into v_row;
  exception when unique_violation then
    select * into v_row from inquiries where idempotency_key = p_key;   -- lost a race with an identical request
    return query select v_row.id, v_row.inquiry_number, true;
    return;
  end;
  return query select v_row.id, v_row.inquiry_number, false;
end $$;
revoke all on function public.submit_inquiry_v2(text, text, text, text, text, text, text, int, text, jsonb, text) from public;
grant execute on function public.submit_inquiry_v2(text, text, text, text, text, text, text, int, text, jsonb, text) to anon, authenticated;

-- The old single-purpose function would bypass the duplicate protection, so close it to the public.
revoke execute on function public.submit_inquiry(text, text, text, text, text, text, int, text, jsonb, text) from anon;

-- Dashboard with a date range ---------------------------------------------------------------------------------
create or replace function public.dashboard_summary_range(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  v := public.dashboard_summary();   -- also checks the caller is active staff
  v := v || jsonb_build_object('range', jsonb_build_object('from', p_from, 'to', p_to));
  if app.has_permission('orders.read') then
    v := v || jsonb_build_object('orders_in_range', (select count(*) from orders where status <> 'cancelled' and order_date between p_from and p_to));
  end if;
  if app.has_permission('inquiries.read') then
    v := v || jsonb_build_object('inquiries_in_range', (select count(*) from inquiries where created_at::date between p_from and p_to));
  end if;
  if app.has_permission('finance.read') then
    -- security definer: report_profit_loss re-checks the permission for the real caller via auth.uid().
    v := v || jsonb_build_object('finance', public.report_profit_loss(p_from, p_to));
  end if;
  return v;
end $$;
revoke all on function public.dashboard_summary_range(date, date) from public;
grant execute on function public.dashboard_summary_range(date, date) to authenticated;
