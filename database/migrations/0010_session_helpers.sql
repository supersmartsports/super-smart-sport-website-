-- 0010 Helpers the application calls for the signed-in user.

-- Everything the app needs to know about the current user, decided by the database.
-- Returns no row for someone without an active profile.
create or replace function public.my_access()
returns table (user_id uuid, full_name text, role_key text, role_name text, permissions text[])
language sql stable security definer set search_path = public as $$
  select me.id, me.full_name, r.key, r.name,
         coalesce((select array_agg(p.key order by p.key) from permissions p where app.has_permission(p.key)), '{}')
  from profiles me
  join roles r on r.id = me.role_id
  where me.id = auth.uid() and me.is_active
$$;
revoke all on function public.my_access() from public;
grant execute on function public.my_access() to authenticated;

-- Headline numbers for the overview. Each block is included only if the caller holds the
-- permission for it, and every figure is computed from stored records. Money is grouped by
-- currency: amounts in different currencies are never added together.
create or replace function public.dashboard_summary() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb := '{}'::jsonb;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_active) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if app.has_permission('customers.read') then
    v := v || jsonb_build_object('customers', (select count(*) from customers where archived_at is null));
  end if;
  if app.has_permission('inquiries.read') then
    v := v || jsonb_build_object('new_inquiries', (select count(*) from inquiries where status = 'new'));
  end if;
  if app.has_permission('quotations.read') then
    v := v || jsonb_build_object('pending_quotations',
      (select count(*) from quotations where status in ('draft', 'sent', 'under_discussion')));
  end if;
  if app.has_permission('orders.read') then
    v := v || jsonb_build_object('orders', jsonb_build_object(
      'total',     (select count(*) from orders where status <> 'cancelled'),
      'pending',   (select count(*) from orders where status in ('new_inquiry', 'quotation_prepared', 'quotation_accepted', 'awaiting_deposit', 'design_approval')),
      'active',    (select count(*) from orders where status in ('order_confirmed', 'materials_preparation', 'production_started', 'quality_inspection', 'production_completed', 'ready_for_dispatch', 'shipped')),
      'completed', (select count(*) from orders where status in ('delivered', 'completed'))));
  end if;
  if app.has_permission('production.read') then
    v := v || jsonb_build_object('production', jsonb_build_object(
      'footballs_in_production', (select coalesce(sum(quantity), 0) from production_batches where status in ('materials_preparation', 'in_production', 'quality_check', 'rework_required')),
      'batches_open',            (select count(*) from production_batches where status <> 'completed')));
  end if;
  if app.has_permission('shipping.read') then
    v := v || jsonb_build_object('shipments_in_transit',
      (select count(*) from shipments where status in ('dispatched', 'in_transit', 'customs_clearance', 'out_for_delivery', 'delayed')));
  end if;
  if app.has_permission('payments.read') and app.has_permission('finance.read') then
    v := v || jsonb_build_object('money_by_currency', coalesce((
      select jsonb_agg(jsonb_build_object(
               'currency', currency, 'order_value', order_value, 'cash_received', cash_received, 'outstanding', outstanding)
             order by currency)
      from (select currency, sum(amount_due) as order_value, sum(cash_received) as cash_received, sum(outstanding_balance) as outstanding
            from v_order_financials group by currency) t), '[]'::jsonb));
  end if;
  if app.has_permission('expenses.read') then
    v := v || jsonb_build_object('expenses_base_total',
      (select coalesce(sum(amount_base), 0) from expenses where voided_at is null));
  end if;
  return v;
end $$;
revoke all on function public.dashboard_summary() from public;
grant execute on function public.dashboard_summary() to authenticated;
