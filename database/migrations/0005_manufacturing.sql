-- 0005 Manufacturing: production batches, tasks and quality inspections.
-- Every batch belongs to a confirmed customer order. Nothing is built for stock.

create table production_batches (
  id            uuid primary key default gen_random_uuid(),
  batch_number  text not null unique default app.next_document_number('batch', 'BT'),
  order_id      uuid not null references orders(id),
  order_item_id uuid references order_items(id),
  quantity      int not null check (quantity > 0),
  status        text not null default 'waiting'
                check (status in ('waiting', 'materials_preparation', 'in_production', 'quality_check',
                                  'rework_required', 'approved', 'completed')),
  current_stage text not null default 'panel_preparation'
                check (current_stage in ('panel_preparation', 'printing', 'stitching_or_bonding', 'assembly',
                                         'quality_inspection', 'final_approval')),
  planned_start date,
  planned_end   date,
  completed_at  timestamptz,
  assigned_to   uuid references profiles(id),
  notes         text,
  created_by    uuid references profiles(id) default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (planned_end is null or planned_start is null or planned_end >= planned_start),
  check ((status = 'completed') = (completed_at is not null))
);
create index production_batches_order_idx on production_batches (order_id);
create index production_batches_status_idx on production_batches (status);
create trigger production_batches_updated before update on production_batches for each row execute function app.set_updated_at();

-- A batch cannot ask for more footballs than the order contains.
create or replace function app.guard_batch_quantity() returns trigger
language plpgsql as $$
declare v_ordered int; v_planned int;
begin
  select coalesce(sum(quantity), 0) into v_ordered from order_items where order_id = new.order_id;
  select coalesce(sum(quantity), 0) into v_planned from production_batches
    where order_id = new.order_id and id <> new.id;
  if v_planned + new.quantity > v_ordered then
    raise exception 'batches (% + %) would exceed the ordered quantity (%)', v_planned, new.quantity, v_ordered;
  end if;
  return new;
end $$;
create trigger production_batches_quantity before insert or update of quantity, order_id on production_batches
  for each row execute function app.guard_batch_quantity();

alter table material_movements add constraint material_movements_batch_fk
  foreign key (batch_id) references production_batches(id);

create table production_tasks (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid not null references production_batches(id) on delete restrict,
  stage        text not null check (stage in ('panel_preparation', 'printing', 'stitching_or_bonding', 'assembly',
                                              'quality_inspection', 'final_approval')),
  title        text not null,
  assigned_to  uuid references profiles(id),
  status       text not null default 'pending' check (status in ('pending', 'in_progress', 'done', 'blocked')),
  due_date     date,
  completed_at timestamptz,
  completed_by uuid references profiles(id),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check ((status = 'done') = (completed_at is not null))
);
create index production_tasks_batch_idx on production_tasks (batch_id);
create index production_tasks_assignee_idx on production_tasks (assigned_to) where assigned_to is not null;
create trigger production_tasks_updated before update on production_tasks for each row execute function app.set_updated_at();

create table quality_inspections (
  id                  uuid primary key default gen_random_uuid(),
  inspection_number   text not null unique default app.next_document_number('inspection', 'QC'),
  order_id            uuid not null references orders(id),
  batch_id            uuid references production_batches(id),
  inspected_on        date not null default current_date,
  inspector_id        uuid references profiles(id) default auth.uid(),
  quantity_inspected  int not null check (quantity_inspected > 0),
  quantity_approved   int not null check (quantity_approved >= 0),
  quantity_rejected   int not null check (quantity_rejected >= 0),
  defect_description  text,
  notes               text,
  result              text not null check (result in ('pass', 'fail', 'rework')),
  created_at          timestamptz not null default now(),
  check (quantity_approved + quantity_rejected = quantity_inspected),
  check (result = 'pass' or defect_description is not null),
  check (result <> 'pass' or quantity_rejected = 0)
);
create index quality_inspections_order_idx on quality_inspections (order_id);
