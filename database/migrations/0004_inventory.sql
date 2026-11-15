-- 0004 Raw materials and suppliers. This is manufacturing input only: the company holds no
-- finished football stock, so nothing here tracks ready-made inventory.

create table suppliers (
  id             uuid primary key default gen_random_uuid(),
  supplier_code  text not null unique default app.next_document_number('supplier', 'SUP'),
  name           text not null check (length(trim(name)) > 0),
  company        text,
  contact_person text,
  email          text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone          text,
  country        text,
  notes          text,
  archived_at    timestamptz,
  created_by     uuid references profiles(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger suppliers_updated before update on suppliers for each row execute function app.set_updated_at();

create table materials (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  category         text not null check (category in (
                     'pu_leather', 'tpu', 'fabric', 'lining', 'bladder', 'ink', 'thread', 'adhesive', 'packaging', 'other')),
  supplier_id      uuid references suppliers(id),
  unit             text not null check (length(unit) between 1 and 20),
  purchase_price   numeric(14,4) check (purchase_price is null or purchase_price >= 0),
  currency         text check (currency is null or currency ~ '^[A-Z]{3}$'),
  reorder_level    numeric(14,3) not null default 0 check (reorder_level >= 0),
  storage_location text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (name, supplier_id)
);
create trigger materials_updated before update on materials for each row execute function app.set_updated_at();

create table product_materials (
  product_id  uuid not null references products(id) on delete cascade,
  material_id uuid not null references materials(id) on delete restrict,
  notes       text,
  primary key (product_id, material_id)
);

create table purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  po_number     text not null unique default app.next_document_number('purchase_order', 'PO'),
  supplier_id   uuid not null references suppliers(id),
  status        text not null default 'draft' check (status in ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
  currency      text not null check (currency ~ '^[A-Z]{3}$'),
  order_date    date not null default current_date,
  expected_date date,
  total         numeric(14,2) not null default 0,
  notes         text,
  created_by    uuid references profiles(id) default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create table purchase_order_items (
  id                uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  material_id       uuid not null references materials(id),
  quantity          numeric(14,3) not null check (quantity > 0),
  unit_price        numeric(14,4) not null check (unit_price >= 0),
  received_quantity numeric(14,3) not null default 0 check (received_quantity >= 0 and received_quantity <= quantity),
  line_total        numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored
);
create index purchase_order_items_po_idx on purchase_order_items (purchase_order_id);

create or replace function app.recalc_purchase_order() returns trigger
language plpgsql as $$
begin
  new.total := coalesce((select sum(line_total) from purchase_order_items where purchase_order_id = new.id), 0);
  new.updated_at := now();
  return new;
end $$;
create trigger purchase_orders_total before insert or update on purchase_orders
  for each row execute function app.recalc_purchase_order();
create trigger purchase_order_items_touch after insert or update or delete on purchase_order_items
  for each row execute function app.touch_parent('purchase_orders', 'purchase_order_id');

-- Stock is never edited: every change is a movement, and quantity on hand is their sum.
create table material_movements (
  id                uuid primary key default gen_random_uuid(),
  material_id       uuid not null references materials(id),
  kind              text not null check (kind in ('purchase', 'consumption', 'adjustment', 'return_to_supplier', 'return_from_production')),
  quantity_delta    numeric(14,3) not null check (quantity_delta <> 0),
  unit_cost         numeric(14,4) check (unit_cost is null or unit_cost >= 0),
  currency          text check (currency is null or currency ~ '^[A-Z]{3}$'),
  batch_id          uuid,
  purchase_order_id uuid references purchase_orders(id),
  reason            text,
  created_by        uuid references profiles(id) default auth.uid(),
  created_at        timestamptz not null default now(),
  check (
    (kind in ('purchase', 'return_from_production') and quantity_delta > 0) or
    (kind in ('consumption', 'return_to_supplier') and quantity_delta < 0) or
    (kind = 'adjustment' and reason is not null)
  )
);
create index material_movements_material_idx on material_movements (material_id, created_at);

create trigger material_movements_append_only before update or delete on material_movements
  for each row execute function app.forbid_change();

create or replace function app.guard_material_movement() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_on_hand numeric;
begin
  -- Serialise movements per material so two consumptions cannot both pass the check.
  perform 1 from materials where id = new.material_id for update;
  select coalesce(sum(quantity_delta), 0) into v_on_hand from material_movements where material_id = new.material_id;
  if v_on_hand + new.quantity_delta < 0 then
    raise exception 'stock cannot go negative (on hand %, change %)', v_on_hand, new.quantity_delta;
  end if;
  return new;
end $$;
create trigger material_movements_guard before insert on material_movements
  for each row execute function app.guard_material_movement();

create view v_material_stock with (security_invoker = true) as
select m.id as material_id, m.name, m.category, m.unit, m.reorder_level, m.supplier_id,
       coalesce(sum(mm.quantity_delta), 0)::numeric(14,3) as quantity_on_hand,
       coalesce(sum(mm.quantity_delta), 0) <= m.reorder_level as is_low
from materials m
left join material_movements mm on mm.material_id = m.id
where m.is_active
group by m.id;
