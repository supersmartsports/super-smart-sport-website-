-- 0007 Shipping, notifications and the audit trail.

create table shipments (
  id               uuid primary key default gen_random_uuid(),
  shipment_number  text not null unique default app.next_document_number('shipment', 'SHP'),
  order_id         uuid not null references orders(id),
  customer_id      uuid not null references customers(id),
  carrier          text not null check (carrier in ('dhl', 'fedex', 'ups', 'other')),
  carrier_name     text,
  tracking_number  text,
  tracking_url     text check (tracking_url is null or tracking_url ~* '^https?://'),
  destination_country text,
  dispatch_date    date,
  expected_delivery date,
  delivered_at     timestamptz,
  shipping_charge  numeric(14,2) check (shipping_charge is null or shipping_charge >= 0),
  currency         text check (currency is null or currency ~ '^[A-Z]{3}$'),
  status           text not null default 'preparing'
                   check (status in ('preparing', 'dispatched', 'in_transit', 'customs_clearance', 'out_for_delivery', 'delivered', 'delayed')),
  notes            text,
  created_by       uuid references profiles(id) default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (carrier <> 'other' or carrier_name is not null),
  check (status in ('preparing') or dispatch_date is not null),
  check ((status = 'delivered') = (delivered_at is not null))
);
create index shipments_order_idx on shipments (order_id);
create trigger shipments_updated before update on shipments for each row execute function app.set_updated_at();

-- Tracking events are entered by staff (or later by a real carrier integration). Nothing is invented.
create table shipment_events (
  id           uuid primary key default gen_random_uuid(),
  shipment_id  uuid not null references shipments(id) on delete restrict,
  status       text not null check (status in ('preparing', 'dispatched', 'in_transit', 'customs_clearance', 'out_for_delivery', 'delivered', 'delayed')),
  occurred_at  timestamptz not null,
  location     text,
  description  text,
  source       text not null default 'manual' check (source in ('manual', 'carrier_api')),
  created_by   uuid references profiles(id) default auth.uid(),
  created_at   timestamptz not null default now()
);
create index shipment_events_shipment_idx on shipment_events (shipment_id, occurred_at);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text,
  entity_type text,
  entity_id   uuid,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, read_at, created_at desc);

-- Tell everyone who holds a permission. In-dashboard only: no email or WhatsApp is sent from here.
create or replace function app.notify(p_permission text, p_kind text, p_title text, p_body text, p_entity_type text, p_entity_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, kind, title, body, entity_type, entity_id)
  select pr.id, p_kind, p_title, p_body, p_entity_type, p_entity_id
  from profiles pr
  where pr.is_active
    and coalesce(
      (select pp.granted from profile_permissions pp where pp.profile_id = pr.id and pp.permission_key = p_permission),
      exists (select 1 from roles r left join role_permissions rp on rp.role_id = r.id and rp.permission_key = p_permission
              where r.id = pr.role_id and (r.key = 'super_admin' or rp.permission_key is not null))
    );
end $$;

-- Each table is handled in its own block: a row's fields may only be referenced inside the
-- block for its table, because other tables' rows do not have those columns.
create or replace function app.notify_events() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'inquiries' then
    perform app.notify('inquiries.read', 'new_inquiry', 'New inquiry from ' || new.name, new.message, 'inquiry', new.id);
  elsif tg_table_name = 'quotations' then
    if new.status = 'accepted' and old.status <> 'accepted' then
      perform app.notify('quotations.read', 'quotation_accepted', 'Quotation ' || new.quotation_number || ' was accepted', null, 'quotation', new.id);
    end if;
  elsif tg_table_name = 'orders' then
    if tg_op = 'INSERT' then
      perform app.notify('orders.read', 'new_order', 'New order ' || new.order_number, null, 'order', new.id);
    elsif new.status is distinct from old.status
          and new.status in ('production_started', 'production_completed', 'shipped', 'delivered') then
      perform app.notify('orders.read', 'order_' || new.status, 'Order ' || new.order_number || ': ' || replace(new.status, '_', ' '), null, 'order', new.id);
    end if;
  elsif tg_table_name = 'payments' then
    if new.confirmed_at is not null and old.confirmed_at is null then
      perform app.notify('payments.read', 'payment_received', 'Payment ' || new.payment_number || ' confirmed', null, 'payment', new.id);
    end if;
  elsif tg_table_name = 'quality_inspections' then
    if new.result <> 'pass' then
      perform app.notify('quality.read', 'inspection_failed', 'Inspection ' || new.inspection_number || ' did not pass', new.defect_description, 'inspection', new.id);
    end if;
  elsif tg_table_name = 'shipments' then
    if new.status is distinct from old.status and new.status in ('dispatched', 'delivered') then
      perform app.notify('shipping.read', 'shipment_' || new.status, 'Shipment ' || new.shipment_number || ': ' || new.status, null, 'shipment', new.id);
    end if;
  end if;
  return null;
end $$;
create trigger notify_inquiries after insert on inquiries for each row execute function app.notify_events();
create trigger notify_quotations after update on quotations for each row execute function app.notify_events();
create trigger notify_orders after insert or update on orders for each row execute function app.notify_events();
create trigger notify_payments after update on payments for each row execute function app.notify_events();
create trigger notify_inspections after insert on quality_inspections for each row execute function app.notify_events();
create trigger notify_shipments after update on shipments for each row execute function app.notify_events();

create or replace function app.notify_low_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_on_hand numeric; v_level numeric; v_name text;
begin
  select m.reorder_level, m.name into v_level, v_name from materials m where m.id = new.material_id;
  select coalesce(sum(quantity_delta), 0) into v_on_hand from material_movements where material_id = new.material_id;
  if new.quantity_delta < 0 and v_on_hand <= v_level then
    perform app.notify('materials.read', 'low_stock', v_name || ' is running low', 'On hand: ' || v_on_hand, 'material', new.material_id);
  end if;
  return null;
end $$;
create trigger notify_low_stock after insert on material_movements for each row execute function app.notify_low_stock();

-- Audit trail: who changed what, and what it looked like before and after. Append-only. -------------------
create table audit_logs (
  id         bigint generated always as identity primary key,
  table_name text not null,
  record_id  text not null,
  action     text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data   jsonb,
  new_data   jsonb,
  actor      uuid,
  at         timestamptz not null default now()
);
create index audit_logs_record_idx on audit_logs (table_name, record_id);
create index audit_logs_actor_idx on audit_logs (actor, at desc);
create index audit_logs_at_idx on audit_logs (at desc);

create or replace function app.guard_audit() returns trigger
language plpgsql as $$
begin
  raise exception 'the audit log is append-only';
end $$;
create trigger audit_logs_immutable before update or delete on audit_logs for each row execute function app.guard_audit();

create or replace function app.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_row jsonb;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into audit_logs (table_name, record_id, action, old_data, new_data, actor)
  values (tg_table_name, coalesce(v_row ->> 'id', v_row ->> 'key'), tg_op,
          case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
          auth.uid());
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'customers', 'inquiries', 'quotations', 'quotation_items', 'orders', 'order_items',
    'production_batches', 'production_tasks', 'quality_inspections',
    'expenses', 'order_costs', 'payments', 'invoices', 'invoice_adjustments',
    'suppliers', 'materials', 'purchase_orders', 'material_movements',
    'shipments', 'profiles', 'roles', 'products', 'exchange_rates']
  loop
    execute format('create trigger audit_%1$s after insert or update or delete on %1$I for each row execute function app.audit_row()', t);
  end loop;
end $$;
