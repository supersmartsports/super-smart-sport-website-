-- 0003 Sales: quotations, orders, the order workflow and quotation -> order conversion.
-- Totals are always computed by the database from the line items, never typed in.
-- Because of that, a discount can only be set once items exist (a subtotal of zero cannot be discounted).

create table quotations (
  id                 uuid primary key default gen_random_uuid(),
  quotation_number   text not null unique default app.next_document_number('quotation', 'QT'),
  customer_id        uuid not null references customers(id),
  inquiry_id         uuid references inquiries(id),
  status             text not null default 'draft'
                     check (status in ('draft', 'sent', 'under_discussion', 'accepted', 'rejected', 'expired', 'converted')),
  currency           text not null check (currency ~ '^[A-Z]{3}$'),
  valid_until        date,
  subtotal           numeric(14,2) not null default 0,
  discount_amount    numeric(14,2) not null default 0 check (discount_amount >= 0),
  shipping_charge    numeric(14,2) not null default 0 check (shipping_charge >= 0),
  tax_rate           numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
  tax_amount         numeric(14,2) not null default 0,
  total              numeric(14,2) not null default 0 check (total >= 0),
  terms              text,
  internal_notes     text,
  sent_at            timestamptz,
  accepted_at        timestamptz,
  converted_order_id uuid,
  assigned_to        uuid references profiles(id),
  created_by         uuid references profiles(id) default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index quotations_customer_idx on quotations (customer_id);
create index quotations_status_idx on quotations (status, created_at desc);

create table quotation_items (
  id                    uuid primary key default gen_random_uuid(),
  quotation_id          uuid not null references quotations(id) on delete cascade,
  product_id            uuid references products(id),
  sort_order            int not null default 0,
  description           text not null check (length(trim(description)) > 0),
  football_type         text check (football_type is null or football_type in ('match', 'training', 'futsal', 'other')),
  quantity              int not null check (quantity > 0),
  size                  text,
  material              text,
  construction          text check (construction is null or construction in ('stitched', 'thermo_bonded', 'hybrid', 'other')),
  panel_count           int check (panel_count is null or panel_count > 0),
  logo_requirements     text,
  colors                text,
  printing_requirements text,
  unit_price            numeric(14,2) not null check (unit_price >= 0),
  line_total            numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored
);
create index quotation_items_quotation_idx on quotation_items (quotation_id);

-- Orders --------------------------------------------------------------------------
create table orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text not null unique default app.next_document_number('order', 'ORD'),
  customer_id      uuid not null references customers(id),
  quotation_id     uuid unique references quotations(id),
  status           text not null default 'new_inquiry' check (status in (
                     'new_inquiry', 'quotation_prepared', 'quotation_accepted', 'awaiting_deposit', 'design_approval',
                     'order_confirmed', 'materials_preparation', 'production_started', 'quality_inspection',
                     'production_completed', 'ready_for_dispatch', 'shipped', 'delivered', 'completed', 'cancelled')),
  currency         text not null check (currency ~ '^[A-Z]{3}$'),
  order_date       date not null default current_date,
  expected_delivery date,
  subtotal         numeric(14,2) not null default 0,
  discount_amount  numeric(14,2) not null default 0 check (discount_amount >= 0),
  shipping_charge  numeric(14,2) not null default 0 check (shipping_charge >= 0),
  tax_rate         numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
  tax_amount       numeric(14,2) not null default 0,
  total            numeric(14,2) not null default 0 check (total >= 0),
  -- Derived from confirmed payments by a trigger in 0006. Never set by hand.
  payment_status   text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid', 'overpaid')),
  production_status text not null default 'waiting'
                   check (production_status in ('waiting', 'materials_preparation', 'in_production', 'quality_check',
                                                'rework_required', 'approved', 'completed')),
  shipping_status  text not null default 'not_shipped'
                   check (shipping_status in ('not_shipped', 'preparing', 'dispatched', 'in_transit', 'customs_clearance',
                                              'out_for_delivery', 'delivered', 'delayed')),
  internal_notes   text,
  assigned_sales   uuid references profiles(id),
  created_by       uuid references profiles(id) default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (expected_delivery is null or expected_delivery >= order_date)
);
create index orders_customer_idx on orders (customer_id);
create index orders_status_idx on orders (status);
create index orders_date_idx on orders (order_date);

alter table quotations add constraint quotations_converted_order_fk
  foreign key (converted_order_id) references orders(id);

create table order_items (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references orders(id) on delete cascade,
  quotation_item_id     uuid references quotation_items(id),
  product_id            uuid references products(id),
  sort_order            int not null default 0,
  description           text not null check (length(trim(description)) > 0),
  football_type         text check (football_type is null or football_type in ('match', 'training', 'futsal', 'other')),
  quantity              int not null check (quantity > 0),
  size                  text,
  material              text,
  construction          text check (construction is null or construction in ('stitched', 'thermo_bonded', 'hybrid', 'other')),
  panel_count           int check (panel_count is null or panel_count > 0),
  logo_requirements     text,
  colors                text,
  printing_requirements text,
  unit_price            numeric(14,2) not null check (unit_price >= 0),
  line_total            numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored
);
create index order_items_order_idx on order_items (order_id);

-- Append-only history of every status change.
create table order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete restrict,
  from_status text,
  to_status   text not null,
  note        text,
  changed_by  uuid references profiles(id),
  changed_at  timestamptz not null default now()
);
create index order_status_history_order_idx on order_status_history (order_id, changed_at);

create trigger order_status_history_append_only before update or delete on order_status_history
  for each row execute function app.forbid_change();

create table order_status_transitions (
  from_status text not null,
  to_status   text not null,
  primary key (from_status, to_status)
);

-- Totals: computed from the items on every insert/update ----------------------------
create or replace function app.recalc_document_totals() returns trigger
language plpgsql as $$
declare
  v_items text := tg_argv[0];   -- items table
  v_fk    text := tg_argv[1];   -- foreign key column in the items table
  v_sub   numeric(14,2);
begin
  execute format('select coalesce(sum(line_total), 0) from %I where %I = $1', v_items, v_fk) into v_sub using new.id;
  new.subtotal := v_sub;
  if new.discount_amount > new.subtotal then
    raise exception 'discount (%) cannot exceed the subtotal (%)', new.discount_amount, new.subtotal;
  end if;
  new.tax_amount := round((new.subtotal - new.discount_amount) * new.tax_rate / 100, 2);
  new.total := new.subtotal - new.discount_amount + new.shipping_charge + new.tax_amount;
  return new;
end $$;

create trigger quotations_totals before insert or update on quotations
  for each row execute function app.recalc_document_totals('quotation_items', 'quotation_id');
create trigger orders_totals before insert or update on orders
  for each row execute function app.recalc_document_totals('order_items', 'order_id');

-- Touch the parent when items change, so its totals are recomputed.
create or replace function app.touch_parent() returns trigger
language plpgsql as $$
declare
  v_parent text := tg_argv[0];
  v_fk     text := tg_argv[1];
  v_id     uuid;
begin
  v_id := case when tg_op = 'DELETE' then (to_jsonb(old) ->> v_fk)::uuid else (to_jsonb(new) ->> v_fk)::uuid end;
  execute format('update %I set updated_at = now() where id = $1', v_parent) using v_id;
  return null;
end $$;

create trigger quotation_items_touch after insert or update or delete on quotation_items
  for each row execute function app.touch_parent('quotations', 'quotation_id');
create trigger order_items_touch after insert or update or delete on order_items
  for each row execute function app.touch_parent('orders', 'order_id');

-- Line items are frozen once the document has moved past the editable stage.
create or replace function app.guard_quotation_items() returns trigger
language plpgsql as $$
declare v_status text; v_id uuid;
begin
  v_id := case when tg_op = 'DELETE' then old.quotation_id else new.quotation_id end;
  select status into v_status from quotations where id = v_id;
  if v_status is not null and v_status not in ('draft', 'sent', 'under_discussion') then
    raise exception 'quotation items cannot be changed while the quotation is %', v_status;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger quotation_items_guard before insert or update or delete on quotation_items
  for each row execute function app.guard_quotation_items();

create or replace function app.guard_order_items() returns trigger
language plpgsql as $$
declare v_status text; v_id uuid;
begin
  v_id := case when tg_op = 'DELETE' then old.order_id else new.order_id end;
  select status into v_status from orders where id = v_id;
  if v_status is not null and v_status not in ('new_inquiry', 'quotation_prepared', 'quotation_accepted', 'awaiting_deposit', 'design_approval') then
    raise exception 'order items cannot be changed once the order is %', v_status;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger order_items_guard before insert or update or delete on order_items
  for each row execute function app.guard_order_items();

-- Quotation status rules ---------------------------------------------------------------
create or replace function app.guard_quotation_status() returns trigger
language plpgsql as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if not (
       (old.status = 'draft'            and new.status in ('sent'))
    or (old.status = 'sent'             and new.status in ('under_discussion', 'accepted', 'rejected', 'expired'))
    or (old.status = 'under_discussion' and new.status in ('accepted', 'rejected', 'expired'))
    or (old.status = 'accepted'         and new.status in ('converted'))
  ) then
    raise exception 'quotation cannot go from % to %', old.status, new.status;
  end if;
  if new.status = 'converted' and coalesce(current_setting('app.quote_convert', true), 'off') <> 'on' then
    raise exception 'a quotation is converted only by convert_quotation_to_order()';
  end if;
  if new.status = 'sent' then new.sent_at := coalesce(new.sent_at, now()); end if;
  if new.status = 'accepted' then new.accepted_at := coalesce(new.accepted_at, now()); end if;
  return new;
end $$;
create trigger quotations_status_guard before update of status on quotations
  for each row execute function app.guard_quotation_status();

-- Order status rules: only change_order_status() may move an order ------------------------
create or replace function app.guard_order_status() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('new_inquiry', 'quotation_accepted') then
      raise exception 'a new order starts as new_inquiry or quotation_accepted, not %', new.status;
    end if;
    return new;
  end if;
  if new.status is distinct from old.status and coalesce(current_setting('app.status_change', true), 'off') <> 'on' then
    raise exception 'order status can only be changed with change_order_status()';
  end if;
  return new;
end $$;
create trigger orders_status_guard before insert or update of status on orders
  for each row execute function app.guard_order_status();

create or replace function app.log_initial_order_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into order_status_history (order_id, from_status, to_status, note, changed_by)
  values (new.id, null, new.status, 'Order created', auth.uid());
  return null;
end $$;
create trigger orders_initial_history after insert on orders
  for each row execute function app.log_initial_order_status();

create or replace function public.change_order_status(p_order uuid, p_to text, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_from text;
begin
  if not app.has_permission('orders.update_status') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select status into v_from from orders where id = p_order for update;
  if v_from is null then raise exception 'order not found'; end if;
  if not exists (select 1 from order_status_transitions where from_status = v_from and to_status = p_to) then
    raise exception 'order cannot go from % to %', v_from, p_to;
  end if;
  perform set_config('app.status_change', 'on', true);
  update orders set status = p_to where id = p_order;
  perform set_config('app.status_change', 'off', true);
  insert into order_status_history (order_id, from_status, to_status, note, changed_by)
  values (p_order, v_from, p_to, p_note, auth.uid());
end $$;
revoke all on function public.change_order_status(uuid, text, text) from public;
grant execute on function public.change_order_status(uuid, text, text) to authenticated;

-- Convert an accepted quotation into an order without re-typing anything --------------------
create or replace function public.convert_quotation_to_order(p_quotation uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  q quotations%rowtype;
  v_order uuid;
begin
  if not app.has_permission('quotations.convert') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select * into q from quotations where id = p_quotation for update;
  if q.id is null then raise exception 'quotation not found'; end if;
  if q.status <> 'accepted' then raise exception 'only an accepted quotation can be converted (it is %)', q.status; end if;
  if exists (select 1 from orders where quotation_id = q.id) then raise exception 'this quotation already has an order'; end if;

  -- The discount is applied after the items exist: a discount cannot exceed a subtotal of zero.
  insert into orders (customer_id, quotation_id, status, currency, discount_amount, shipping_charge, tax_rate, assigned_sales, created_by)
  values (q.customer_id, q.id, 'quotation_accepted', q.currency, 0, q.shipping_charge, q.tax_rate,
          coalesce(q.assigned_to, auth.uid()), auth.uid())
  returning id into v_order;

  insert into order_items (order_id, quotation_item_id, product_id, sort_order, description, football_type, quantity, size, material,
                           construction, panel_count, logo_requirements, colors, printing_requirements, unit_price)
  select v_order, qi.id, qi.product_id, qi.sort_order, qi.description, qi.football_type, qi.quantity, qi.size, qi.material,
         qi.construction, qi.panel_count, qi.logo_requirements, qi.colors, qi.printing_requirements, qi.unit_price
  from quotation_items qi where qi.quotation_id = q.id;
  update orders set discount_amount = q.discount_amount where id = v_order;

  perform set_config('app.quote_convert', 'on', true);
  update quotations set status = 'converted', converted_order_id = v_order where id = q.id;
  perform set_config('app.quote_convert', 'off', true);
  return v_order;
end $$;
revoke all on function public.convert_quotation_to_order(uuid) from public;
grant execute on function public.convert_quotation_to_order(uuid) to authenticated;
