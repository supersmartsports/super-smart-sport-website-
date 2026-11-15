-- 0011 Reporting. Every figure is computed from stored rows, in the reporting currency, using the
-- explicit exchange rate recorded on each order, payment and expense. Nothing is estimated.
--
-- Rules (also documented in docs/architecture/financial-methodology.md):
--   revenue            = order total minus pass-through tax, for orders dated in the period, excluding cancelled orders
--   direct costs       = order_costs of class 'direct' for those orders (voided costs excluded)
--   additional costs   = order_costs of class 'additional' for those orders
--   unallocated direct = direct-category expenses not (or not fully) assigned to orders, so nothing is hidden
--   operating expenses = operating-category expenses recorded in the period
--   An expense is counted once: the part assigned to orders sits in order_costs, only the remainder is counted as an expense.

alter table orders add column fx_rate_to_base numeric(18,8) not null default 1 check (fx_rate_to_base > 0);

-- An order in a foreign currency must carry an explicit rate before it is confirmed.
create or replace function app.guard_order_fx() returns trigger
language plpgsql as $$
declare v_base text;
begin
  if new.status = 'order_confirmed' and old.status is distinct from new.status then
    select reporting_currency into v_base from business_settings limit 1;
    if v_base is not null and new.currency <> v_base and new.fx_rate_to_base = 1 then
      raise exception 'set an explicit exchange rate to % before confirming a % order', v_base, new.currency;
    end if;
  end if;
  return new;
end $$;
create trigger orders_fx_guard before update of status on orders for each row execute function app.guard_order_fx();

create or replace function public.report_profit_loss(p_from date, p_to date) returns jsonb
language plpgsql stable set search_path = public as $$
declare r jsonb;
begin
  if not app.has_permission('finance.read') then raise exception 'permission denied' using errcode = '42501'; end if;
  with o as (
    select id, total, tax_amount, fx_rate_to_base from orders
    where status <> 'cancelled' and order_date between p_from and p_to
  ), rev as (
    select coalesce(sum(round((total - tax_amount) * fx_rate_to_base, 2)), 0) as v, count(*) as n from o
  ), cst as (
    select coalesce(sum(oc.amount_base) filter (where oc.cost_class = 'direct'), 0) as direct,
           coalesce(sum(oc.amount_base) filter (where oc.cost_class = 'additional'), 0) as additional
    from order_costs oc join o on o.id = oc.order_id where oc.voided_at is null
  ), alloc as (
    select expense_id, sum(amount_base) as a from order_costs where expense_id is not null and voided_at is null group by expense_id
  ), exp as (
    select c.kind, sum(e.amount_base - coalesce(a.a, 0)) as rem
    from expenses e
    join expense_categories c on c.id = e.category_id
    left join alloc a on a.expense_id = e.id
    where e.voided_at is null and e.expense_date between p_from and p_to
    group by c.kind
  ), cash as (
    select coalesce(sum(round(p.amount_base * p.received_order_amount / p.order_currency_amount, 2)
                        * case when p.kind = 'refund' then -1 else 1 end), 0) as v
    from payments p where p.status in ('received', 'partially_received') and p.payment_date between p_from and p_to
  ), out as (
    select coalesce(sum(round(f.outstanding_balance * o2.fx_rate_to_base, 2)), 0) as v
    from v_order_financials f join orders o2 on o2.id = f.order_id
    where o2.order_date between p_from and p_to
  ), open_orders as (
    select coalesce(sum(round((total - tax_amount) * fx_rate_to_base, 2)), 0) as v from orders
    where order_date between p_from and p_to and status not in ('delivered', 'completed', 'cancelled')
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'currency', (select reporting_currency from business_settings limit 1),
    'orders', (select n from rev),
    'revenue', (select v from rev),
    'direct_costs', (select direct from cst),
    'additional_costs', (select additional from cst),
    'gross_profit', (select v from rev) - (select direct from cst),
    'contribution_margin', (select v from rev) - (select direct from cst) - (select additional from cst),
    'unallocated_direct_expenses', coalesce((select rem from exp where kind = 'direct'), 0),
    'operating_expenses', coalesce((select rem from exp where kind = 'operating'), 0),
    'net_profit', (select v from rev) - (select direct from cst) - (select additional from cst)
                  - coalesce((select rem from exp where kind = 'direct'), 0) - coalesce((select rem from exp where kind = 'operating'), 0),
    'cash_received', (select v from cash),
    'outstanding_receivables', (select v from out),
    'open_order_revenue', (select v from open_orders)
  ) into r;
  return r;
end $$;

create or replace function public.report_monthly(p_from date, p_to date)
returns table (month date, orders bigint, revenue numeric, direct_costs numeric, expenses numeric, cash_received numeric)
language plpgsql stable set search_path = public as $$
begin
  if not app.has_permission('finance.read') then raise exception 'permission denied' using errcode = '42501'; end if;
  return query
  with months as (select generate_series(date_trunc('month', p_from)::date, date_trunc('month', p_to)::date, interval '1 month')::date as m),
  alloc as (select expense_id, sum(amount_base) as a from order_costs where expense_id is not null and voided_at is null group by expense_id)
  select m.m,
    (select count(*) from orders o where o.status <> 'cancelled' and date_trunc('month', o.order_date)::date = m.m),
    coalesce((select sum(round((o.total - o.tax_amount) * o.fx_rate_to_base, 2)) from orders o
              where o.status <> 'cancelled' and date_trunc('month', o.order_date)::date = m.m), 0),
    coalesce((select sum(oc.amount_base) from order_costs oc join orders o on o.id = oc.order_id
              where oc.cost_class = 'direct' and oc.voided_at is null and o.status <> 'cancelled'
                and date_trunc('month', o.order_date)::date = m.m), 0),
    coalesce((select sum(e.amount_base - coalesce(a.a, 0)) from expenses e left join alloc a on a.expense_id = e.id
              where e.voided_at is null and date_trunc('month', e.expense_date)::date = m.m), 0),
    coalesce((select sum(round(p.amount_base * p.received_order_amount / p.order_currency_amount, 2)
                         * case when p.kind = 'refund' then -1 else 1 end) from payments p
              where p.status in ('received', 'partially_received') and date_trunc('month', p.payment_date)::date = m.m), 0)
  from months m order by m.m;
end $$;

create or replace function public.report_order_profitability(p_from date, p_to date)
returns table (order_id uuid, order_number text, customer_id uuid, customer_name text, revenue numeric, direct_costs numeric, additional_costs numeric)
language plpgsql stable set search_path = public as $$
begin
  if not app.has_permission('finance.read') then raise exception 'permission denied' using errcode = '42501'; end if;
  return query
  select o.id, o.order_number, o.customer_id, c.name,
         round((o.total - o.tax_amount) * o.fx_rate_to_base, 2),
         coalesce((select sum(oc.amount_base) from order_costs oc where oc.order_id = o.id and oc.cost_class = 'direct' and oc.voided_at is null), 0),
         coalesce((select sum(oc.amount_base) from order_costs oc where oc.order_id = o.id and oc.cost_class = 'additional' and oc.voided_at is null), 0)
  from orders o join customers c on c.id = o.customer_id
  where o.status <> 'cancelled' and o.order_date between p_from and p_to
  order by o.order_date, o.order_number;
end $$;

create or replace function public.report_sales_by_country(p_from date, p_to date)
returns table (country text, orders bigint, revenue numeric)
language plpgsql stable set search_path = public as $$
begin
  if not app.has_permission('reports.read') then raise exception 'permission denied' using errcode = '42501'; end if;
  return query
  select coalesce(c.country, 'Unknown'), count(*), sum(round((o.total - o.tax_amount) * o.fx_rate_to_base, 2))
  from orders o join customers c on c.id = o.customer_id
  where o.status <> 'cancelled' and o.order_date between p_from and p_to
  group by 1 order by 3 desc;
end $$;

create or replace function public.report_expense_breakdown(p_from date, p_to date)
returns table (category text, kind text, amount numeric)
language plpgsql stable set search_path = public as $$
begin
  if not app.has_permission('finance.read') then raise exception 'permission denied' using errcode = '42501'; end if;
  return query
  select c.name, c.kind, sum(e.amount_base)
  from expenses e join expense_categories c on c.id = e.category_id
  where e.voided_at is null and e.expense_date between p_from and p_to
  group by c.name, c.kind order by 3 desc;
end $$;

create or replace function public.report_production_summary()
returns table (status text, batches bigint, footballs bigint)
language plpgsql stable set search_path = public as $$
begin
  if not app.has_permission('reports.read') then raise exception 'permission denied' using errcode = '42501'; end if;
  return query select b.status, count(*), coalesce(sum(b.quantity), 0)::bigint from production_batches b group by b.status order by 1;
end $$;

grant execute on function
  public.report_profit_loss(date, date), public.report_monthly(date, date), public.report_order_profitability(date, date),
  public.report_sales_by_country(date, date), public.report_expense_breakdown(date, date), public.report_production_summary()
to authenticated;
revoke execute on function
  public.report_profit_loss(date, date), public.report_monthly(date, date), public.report_order_profitability(date, date),
  public.report_sales_by_country(date, date), public.report_expense_breakdown(date, date), public.report_production_summary()
from anon, public;
