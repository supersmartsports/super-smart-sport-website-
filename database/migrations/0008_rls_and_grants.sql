-- 0008 Row level security. The database refuses anything the signed-in user is not permitted to do,
-- whatever the application code or the browser sends. Every table starts closed (RLS on, no policy).

-- Privileges -----------------------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant usage on schema public to anon, authenticated;
grant usage on schema app to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function app.has_permission(text) to authenticated;
grant execute on function app.next_document_number(text, text) to authenticated;

-- Which module permission governs a file attached to a given kind of record.
create or replace function app.can_access_attachment(p_type text, p_write boolean) returns boolean
language sql stable as $$
  select app.has_permission(
    case p_type
      when 'customer' then 'customers' when 'inquiry' then 'inquiries' when 'quotation' then 'quotations'
      when 'order' then 'orders' when 'batch' then 'production' when 'inspection' then 'quality'
      when 'payment' then 'payments' when 'invoice' then 'invoices' when 'expense' then 'expenses'
      when 'shipment' then 'shipping' when 'supplier' then 'suppliers' when 'purchase_order' then 'suppliers'
      else 'attachments' end
    || case when p_write then '.write' else '.read' end)
$$;
grant execute on function app.can_access_attachment(text, boolean) to authenticated;

-- Standard tables: read needs one permission, write needs another. ------------------------------------
-- (table, read permission, write permission, may rows be deleted?)
do $$
declare r record;
begin
  for r in select * from (values
    ('customers',             'customers.read',   'customers.write',  false),
    ('customer_notes',        'customers.read',   'customers.write',  false),
    ('inquiries',             'inquiries.read',   'inquiries.write',  false),
    ('inquiry_activities',    'inquiries.read',   'inquiries.write',  false),
    ('products',              'products.read',    'products.write',   false),
    ('product_materials',     'products.read',    'products.write',   true),
    ('quotations',            'quotations.read',  'quotations.write', false),
    ('quotation_items',       'quotations.read',  'quotations.write', true),
    ('orders',                'orders.read',      'orders.write',     false),
    ('order_items',           'orders.read',      'orders.write',     true),
    ('production_batches',    'production.read',  'production.write', false),
    ('quality_inspections',   'quality.read',     'quality.write',    false),
    ('suppliers',             'suppliers.read',   'suppliers.write',  false),
    ('materials',             'materials.read',   'materials.write',  false),
    ('purchase_orders',       'suppliers.read',   'suppliers.write',  false),
    ('purchase_order_items',  'suppliers.read',   'suppliers.write',  true),
    ('expense_categories',    'expenses.read',    'finance.write',    false),
    ('expenses',              'expenses.read',    'expenses.write',   false),
    ('order_costs',           'finance.read',     'finance.write',    false),
    ('invoices',              'invoices.read',    'invoices.write',   true),
    ('invoice_items',         'invoices.read',    'invoices.write',   true),
    ('exchange_rates',        'finance.read',     'finance.write',    false),
    ('shipments',             'shipping.read',    'shipping.write',   false),
    ('shipment_events',       'shipping.read',    'shipping.write',   false)
  ) as v(tbl, read_perm, write_perm, can_delete)
  loop
    execute format('alter table %I enable row level security', r.tbl);
    execute format('create policy %I on %I for select to authenticated using (app.has_permission(%L))',
                   r.tbl || '_select', r.tbl, r.read_perm);
    execute format('create policy %I on %I for insert to authenticated with check (app.has_permission(%L))',
                   r.tbl || '_insert', r.tbl, r.write_perm);
    execute format('create policy %I on %I for update to authenticated using (app.has_permission(%L)) with check (app.has_permission(%L))',
                   r.tbl || '_update', r.tbl, r.write_perm, r.write_perm);
    if r.can_delete then
      execute format('create policy %I on %I for delete to authenticated using (app.has_permission(%L))',
                     r.tbl || '_delete', r.tbl, r.write_perm);
    end if;
  end loop;
end $$;

-- Read-only history: written only by trusted database functions ------------------------------------------
alter table order_status_history enable row level security;
create policy order_status_history_select on order_status_history for select to authenticated
  using (app.has_permission('orders.read'));

alter table order_status_transitions enable row level security;
create policy order_status_transitions_select on order_status_transitions for select to authenticated using (true);

alter table audit_logs enable row level security;
create policy audit_logs_select on audit_logs for select to authenticated using (app.has_permission('audit.read'));

alter table document_sequences enable row level security;   -- no policy: nobody reads or writes directly

-- Stock movements are append-only: no update and no delete policy exists.
alter table material_movements enable row level security;
create policy material_movements_select on material_movements for select to authenticated using (app.has_permission('materials.read'));
create policy material_movements_insert on material_movements for insert to authenticated with check (app.has_permission('materials.write'));

-- Credit and debit notes are append-only too.
alter table invoice_adjustments enable row level security;
create policy invoice_adjustments_select on invoice_adjustments for select to authenticated using (app.has_permission('invoices.read'));
create policy invoice_adjustments_insert on invoice_adjustments for insert to authenticated with check (app.has_permission('invoices.write'));

-- Payments: staff can record a pending payment, but cannot mark money as received by editing the row.
-- Confirmation goes through confirm_payment(), which checks payments.confirm.
alter table payments enable row level security;
create policy payments_select on payments for select to authenticated using (app.has_permission('payments.read'));
create policy payments_insert on payments for insert to authenticated
  with check (app.has_permission('payments.write') and status = 'pending' and confirmed_at is null and received_order_amount = 0);
create policy payments_update on payments for update to authenticated
  using (app.has_permission('payments.write') and confirmed_at is null)
  with check (app.has_permission('payments.write') and confirmed_at is null and status in ('pending', 'failed') and received_order_amount = 0);

-- Production tasks: staff see their own assigned tasks even without wider production access. ---------------------
alter table production_tasks enable row level security;
create policy production_tasks_select on production_tasks for select to authenticated
  using (app.has_permission('production.read') or (assigned_to = auth.uid() and app.has_permission('tasks.read_assigned')));
create policy production_tasks_insert on production_tasks for insert to authenticated
  with check (app.has_permission('production.write'));
create policy production_tasks_update on production_tasks for update to authenticated
  using (app.has_permission('production.write') or (assigned_to = auth.uid() and app.has_permission('tasks.read_assigned')))
  with check (app.has_permission('production.write') or (assigned_to = auth.uid() and app.has_permission('tasks.read_assigned')));

-- A person who only holds an assigned task may report progress, nothing else.
create or replace function app.guard_task_update() returns trigger
language plpgsql as $$
begin
  if not app.has_permission('production.write') then
    if new.batch_id is distinct from old.batch_id or new.stage is distinct from old.stage or new.title is distinct from old.title
       or new.assigned_to is distinct from old.assigned_to or new.due_date is distinct from old.due_date then
      raise exception 'you can update the status and notes of your own task only' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger production_tasks_guard before update on production_tasks for each row execute function app.guard_task_update();

-- Notifications belong to one person. ---------------------------------------------------------------------------
alter table notifications enable row level security;
create policy notifications_select on notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Files ------------------------------------------------------------------------------------------------------------
alter table attachments enable row level security;
create policy attachments_select on attachments for select to authenticated using (app.can_access_attachment(entity_type, false));
create policy attachments_insert on attachments for insert to authenticated with check (app.can_access_attachment(entity_type, true));
create policy attachments_delete on attachments for delete to authenticated using (app.can_access_attachment(entity_type, true));

-- People, roles and settings -------------------------------------------------------------------------------------------
alter table profiles enable row level security;
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or app.has_permission('employees.read'));
create policy profiles_insert on profiles for insert to authenticated with check (app.has_permission('employees.manage'));
create policy profiles_update on profiles for update to authenticated
  using (app.has_permission('employees.manage')) with check (app.has_permission('employees.manage'));

alter table roles enable row level security;
create policy roles_select on roles for select to authenticated using (app.has_permission('employees.read') or exists (select 1 from profiles p where p.id = auth.uid() and p.role_id = roles.id));
create policy roles_write on roles for all to authenticated using (app.has_permission('employees.manage')) with check (app.has_permission('employees.manage'));

alter table permissions enable row level security;
create policy permissions_select on permissions for select to authenticated using (app.has_permission('employees.read'));

alter table role_permissions enable row level security;
create policy role_permissions_select on role_permissions for select to authenticated using (app.has_permission('employees.read'));
create policy role_permissions_write on role_permissions for all to authenticated
  using (app.has_permission('employees.manage')) with check (app.has_permission('employees.manage'));

alter table profile_permissions enable row level security;
create policy profile_permissions_select on profile_permissions for select to authenticated
  using (profile_id = auth.uid() or app.has_permission('employees.read'));
create policy profile_permissions_write on profile_permissions for all to authenticated
  using (app.has_permission('employees.manage')) with check (app.has_permission('employees.manage'));

alter table business_settings enable row level security;
create policy business_settings_select on business_settings for select to authenticated using (app.has_permission('settings.read'));
create policy business_settings_update on business_settings for update to authenticated
  using (app.has_permission('settings.manage')) with check (app.has_permission('settings.manage'));

-- Nobody may change their own role, even with employees.manage, unless they are the owner. ---------------------------------
create or replace function app.guard_profile_role() returns trigger
language plpgsql as $$
begin
  if new.role_id is distinct from old.role_id and new.id = auth.uid()
     and not exists (select 1 from roles r where r.id = old.role_id and r.key = 'super_admin') then
    raise exception 'you cannot change your own role' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_role_guard before update of role_id on profiles for each row execute function app.guard_profile_role();

-- Supabase Storage: one private bucket, access follows the same permissions. Skipped where Storage does not exist.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('business-files', 'business-files', false, 26214400,
            array['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'image/svg+xml', 'application/zip'])
    on conflict (id) do nothing;

    execute $p$create policy business_files_select on storage.objects for select to authenticated
      using (bucket_id = 'business-files' and exists (select 1 from public.attachments a where a.storage_path = name))$p$;
    execute $p$create policy business_files_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'business-files' and app.has_permission('attachments.write'))$p$;
    execute $p$create policy business_files_delete on storage.objects for delete to authenticated
      using (bucket_id = 'business-files' and app.has_permission('attachments.write'))$p$;
  end if;
end $$;
