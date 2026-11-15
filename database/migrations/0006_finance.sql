-- 0006 Finance: expenses, order costs, payments, invoices and the ledger rules that protect them.
-- Principle: confirmed money is never edited or deleted. Mistakes are fixed with new, traceable rows.

create table expense_categories (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique check (key ~ '^[a-z_]+$'),
  name        text not null,
  -- direct: part of making a football (counts towards gross profit). operating: overhead (counts towards net profit).
  kind        text not null check (kind in ('direct', 'operating')),
  is_variable boolean not null default false
);

create table expenses (
  id               uuid primary key default gen_random_uuid(),
  expense_number   text not null unique default app.next_document_number('expense', 'EXP'),
  category_id      uuid not null references expense_categories(id),
  supplier_id      uuid references suppliers(id),
  expense_date     date not null,
  amount           numeric(14,2) not null check (amount > 0),
  currency         text not null check (currency ~ '^[A-Z]{3}$'),
  -- Explicit rate to the reporting currency, fixed when the expense is recorded.
  fx_rate_to_base  numeric(18,8) not null default 1 check (fx_rate_to_base > 0),
  amount_base      numeric(14,2) generated always as (round(amount * fx_rate_to_base, 2)) stored,
  payment_method   text check (payment_method is null or payment_method in ('cash', 'bank_transfer', 'cheque', 'card', 'other')),
  reference_number text,
  description      text,
  voided_at        timestamptz,
  voided_by        uuid references profiles(id),
  void_reason      text,
  created_by       uuid references profiles(id) default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check ((voided_at is null) = (void_reason is null))
);
create index expenses_date_idx on expenses (expense_date);
create index expenses_category_idx on expenses (category_id);
create trigger expenses_updated before update on expenses for each row execute function app.set_updated_at();

-- Money amounts and currency cannot be edited after an expense is recorded; void it and enter a new one.
create or replace function app.guard_expense() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'expenses are never deleted: void the expense instead'; end if;
  if old.voided_at is not null then raise exception 'a voided expense cannot be changed'; end if;
  if new.amount is distinct from old.amount or new.currency is distinct from old.currency
     or new.fx_rate_to_base is distinct from old.fx_rate_to_base or new.expense_date is distinct from old.expense_date
     or new.category_id is distinct from old.category_id then
    raise exception 'amount, currency, rate, date and category are fixed once recorded: void and re-enter';
  end if;
  return new;
end $$;
create trigger expenses_guard before update or delete on expenses for each row execute function app.guard_expense();

-- What an order cost us. An expense may be split across orders, but never allocated more than once in total.
create table order_costs (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id),
  cost_class      text not null check (cost_class in ('direct', 'additional')),
  category        text not null check (category in ('materials', 'labor', 'printing', 'stitching_bonding', 'packaging',
                                                    'shipping', 'payment_fees', 'other')),
  description     text,
  amount          numeric(14,2) not null check (amount > 0),
  currency        text not null check (currency ~ '^[A-Z]{3}$'),
  fx_rate_to_base numeric(18,8) not null default 1 check (fx_rate_to_base > 0),
  amount_base     numeric(14,2) generated always as (round(amount * fx_rate_to_base, 2)) stored,
  expense_id      uuid references expenses(id),
  voided_at       timestamptz,
  created_by      uuid references profiles(id) default auth.uid(),
  created_at      timestamptz not null default now()
);
create index order_costs_order_idx on order_costs (order_id);
create index order_costs_expense_idx on order_costs (expense_id) where expense_id is not null;

create or replace function app.guard_order_cost() returns trigger
language plpgsql as $$
declare v_expense numeric; v_allocated numeric;
begin
  if tg_op = 'DELETE' then raise exception 'order costs are never deleted: void the cost instead'; end if;
  if tg_op = 'UPDATE' and (new.amount is distinct from old.amount or new.currency is distinct from old.currency
     or new.fx_rate_to_base is distinct from old.fx_rate_to_base or new.expense_id is distinct from old.expense_id
     or new.order_id is distinct from old.order_id) then
    raise exception 'order cost amounts are fixed once recorded: void and re-enter';
  end if;
  if new.expense_id is not null and new.voided_at is null then
    select amount_base into v_expense from expenses where id = new.expense_id for update;
    select coalesce(sum(amount_base), 0) into v_allocated from order_costs
      where expense_id = new.expense_id and voided_at is null and id <> new.id;
    -- Generated columns are not computed yet inside a BEFORE trigger, so work the figure out here.
    if v_allocated + round(new.amount * new.fx_rate_to_base, 2) > v_expense then
      raise exception 'expense is already allocated %, this cost would make % of %', v_allocated, v_allocated + round(new.amount * new.fx_rate_to_base, 2), v_expense;
    end if;
  end if;
  return new;
end $$;
create trigger order_costs_guard before insert or update or delete on order_costs for each row execute function app.guard_order_cost();

-- Invoices -------------------------------------------------------------------------------
create table invoices (
  id                   uuid primary key default gen_random_uuid(),
  invoice_number       text not null unique default app.next_document_number('invoice', 'INV'),
  order_id             uuid not null references orders(id),
  customer_id          uuid not null references customers(id),
  status               text not null default 'draft' check (status in ('draft', 'finalized', 'void')),
  currency             text not null check (currency ~ '^[A-Z]{3}$'),
  issue_date           date not null default current_date,
  due_date             date,
  subtotal             numeric(14,2) not null default 0,
  discount_amount      numeric(14,2) not null default 0 check (discount_amount >= 0),
  shipping_charge      numeric(14,2) not null default 0 check (shipping_charge >= 0),
  tax_rate             numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
  tax_amount           numeric(14,2) not null default 0,
  total                numeric(14,2) not null default 0 check (total >= 0),
  notes                text,
  payment_instructions text,
  finalized_at         timestamptz,
  finalized_by         uuid references profiles(id),
  voided_at            timestamptz,
  void_reason          text,
  created_by           uuid references profiles(id) default auth.uid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (due_date is null or due_date >= issue_date),
  check ((status = 'finalized') = (finalized_at is not null) or status = 'void')
);
create index invoices_order_idx on invoices (order_id);
create index invoices_customer_idx on invoices (customer_id);

create table invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  sort_order  int not null default 0,
  description text not null check (length(trim(description)) > 0),
  quantity    int not null check (quantity > 0),
  unit_price  numeric(14,2) not null check (unit_price >= 0),
  line_total  numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored
);
create index invoice_items_invoice_idx on invoice_items (invoice_id);

create trigger invoices_totals before insert or update on invoices
  for each row execute function app.recalc_document_totals('invoice_items', 'invoice_id');
create trigger invoice_items_touch after insert or update or delete on invoice_items
  for each row execute function app.touch_parent('invoices', 'invoice_id');

-- After finalising, the financial content is frozen. The only change allowed is voiding.
create or replace function app.guard_invoice() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'only a draft invoice can be deleted'; end if;
    return old;
  end if;
  if old.status = 'void' then raise exception 'a void invoice cannot be changed'; end if;
  if old.status = 'finalized' then
    if new.status = 'void' and new.void_reason is not null then
      new.voided_at := coalesce(new.voided_at, now());
      return new;
    end if;
    raise exception 'a finalized invoice cannot be edited: use an adjustment (credit or debit note)';
  end if;
  return new;
end $$;
create trigger invoices_guard before update or delete on invoices for each row execute function app.guard_invoice();

create or replace function app.guard_invoice_items() returns trigger
language plpgsql as $$
declare v_status text; v_id uuid;
begin
  v_id := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  select status into v_status from invoices where id = v_id;
  if v_status is not null and v_status <> 'draft' then
    raise exception 'invoice items are frozen once the invoice is %', v_status;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger invoice_items_guard before insert or update or delete on invoice_items
  for each row execute function app.guard_invoice_items();

create or replace function public.finalize_invoice(p_invoice uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v invoices%rowtype;
begin
  if not app.has_permission('invoices.finalize') then raise exception 'permission denied' using errcode = '42501'; end if;
  select * into v from invoices where id = p_invoice for update;
  if v.id is null then raise exception 'invoice not found'; end if;
  if v.status <> 'draft' then raise exception 'invoice is already %', v.status; end if;
  if not exists (select 1 from invoice_items where invoice_id = p_invoice) then raise exception 'an invoice needs at least one item'; end if;
  perform set_config('app.finalize_invoice', 'on', true);
  update invoices set status = 'finalized', finalized_at = now(), finalized_by = auth.uid() where id = p_invoice;
  perform set_config('app.finalize_invoice', 'off', true);
end $$;
revoke all on function public.finalize_invoice(uuid) from public;
grant execute on function public.finalize_invoice(uuid) to authenticated;

-- Draft -> finalized is only legal through finalize_invoice().
create or replace function app.guard_invoice_finalize() returns trigger
language plpgsql as $$
begin
  if new.status = 'finalized' and old.status = 'draft' and coalesce(current_setting('app.finalize_invoice', true), 'off') <> 'on' then
    raise exception 'an invoice is finalized only through finalize_invoice()';
  end if;
  return new;
end $$;
create trigger invoices_finalize_guard before update of status on invoices for each row execute function app.guard_invoice_finalize();

-- Corrections to a finalized invoice: append-only credit and debit notes.
create table invoice_adjustments (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id),
  kind        text not null check (kind in ('credit', 'debit')),
  amount      numeric(14,2) not null check (amount > 0),
  reason      text not null check (length(trim(reason)) > 0),
  created_by  uuid references profiles(id) default auth.uid(),
  created_at  timestamptz not null default now()
);
create index invoice_adjustments_invoice_idx on invoice_adjustments (invoice_id);

create or replace function app.guard_invoice_adjustment() returns trigger
language plpgsql as $$
declare v_status text;
begin
  if tg_op <> 'INSERT' then raise exception 'adjustments are append-only'; end if;
  select status into v_status from invoices where id = new.invoice_id;
  if v_status <> 'finalized' then raise exception 'adjustments apply to finalized invoices only (it is %)', v_status; end if;
  return new;
end $$;
create trigger invoice_adjustments_guard before insert or update or delete on invoice_adjustments
  for each row execute function app.guard_invoice_adjustment();

-- Payments --------------------------------------------------------------------------------
create table payments (
  id                    uuid primary key default gen_random_uuid(),
  payment_number        text not null unique default app.next_document_number('payment', 'PAY'),
  customer_id           uuid not null references customers(id),
  order_id              uuid not null references orders(id),
  invoice_id            uuid references invoices(id),
  kind                  text not null default 'payment' check (kind in ('payment', 'refund')),
  method                text not null check (method in ('bank_transfer', 'western_union', 'moneygram', 'other')),
  reference             text,
  amount                numeric(14,2) not null check (amount > 0),
  currency              text not null check (currency ~ '^[A-Z]{3}$'),
  -- How much of this payment is credited to the order, in the order's currency.
  order_currency_amount numeric(14,2) not null check (order_currency_amount > 0),
  fx_rate_to_base       numeric(18,8) not null default 1 check (fx_rate_to_base > 0),
  amount_base           numeric(14,2) generated always as (round(amount * fx_rate_to_base, 2)) stored,
  payment_date          date not null,
  status                text not null default 'pending'
                        check (status in ('pending', 'received', 'partially_received', 'failed', 'refunded')),
  -- Filled in only when finance confirms the money has arrived. Pending and failed payments count as zero.
  received_order_amount numeric(14,2) not null default 0 check (received_order_amount >= 0),
  notes                 text,
  confirmed_by          uuid references profiles(id),
  confirmed_at          timestamptz,
  created_by            uuid references profiles(id) default auth.uid(),
  created_at            timestamptz not null default now(),
  check (received_order_amount <= order_currency_amount),
  check ((status in ('received', 'partially_received')) = (confirmed_at is not null)),
  check (status <> 'received' or received_order_amount = order_currency_amount),
  check (status <> 'partially_received' or (received_order_amount > 0 and received_order_amount < order_currency_amount))
);
create index payments_order_idx on payments (order_id);
create index payments_customer_idx on payments (customer_id);
create index payments_status_idx on payments (status);

-- Once confirmed a payment is frozen. It can never be deleted.
create or replace function app.guard_payment() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'payments are never deleted: record a refund or mark the entry failed while pending'; end if;
  if old.confirmed_at is not null then raise exception 'a confirmed payment is frozen: record a refund or an adjustment instead'; end if;
  if old.status in ('failed', 'refunded') then raise exception 'a % payment cannot be changed', old.status; end if;
  if new.confirmed_at is not null and coalesce(current_setting('app.confirm_payment', true), 'off') <> 'on' then
    raise exception 'a payment is confirmed only through confirm_payment()';
  end if;
  return new;
end $$;
create trigger payments_guard before update or delete on payments for each row execute function app.guard_payment();

-- Only a person with payments.confirm can say money has arrived, and it is never automatic.
create or replace function public.confirm_payment(p_payment uuid, p_received_order_amount numeric default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v payments%rowtype; v_amount numeric(14,2); v_status text;
begin
  if not app.has_permission('payments.confirm') then raise exception 'permission denied' using errcode = '42501'; end if;
  select * into v from payments where id = p_payment for update;
  if v.id is null then raise exception 'payment not found'; end if;
  if v.status <> 'pending' then raise exception 'only a pending payment can be confirmed (it is %)', v.status; end if;
  v_amount := coalesce(p_received_order_amount, v.order_currency_amount);
  if v_amount <= 0 or v_amount > v.order_currency_amount then raise exception 'received amount must be between 0 and %', v.order_currency_amount; end if;
  v_status := case when v_amount = v.order_currency_amount then 'received' else 'partially_received' end;
  perform set_config('app.confirm_payment', 'on', true);
  update payments set status = v_status, received_order_amount = v_amount, confirmed_by = auth.uid(), confirmed_at = now()
  where id = p_payment;
  perform set_config('app.confirm_payment', 'off', true);
end $$;
revoke all on function public.confirm_payment(uuid, numeric) from public;
grant execute on function public.confirm_payment(uuid, numeric) to authenticated;

-- Financial position of every order, from the ledger rows only ----------------------------------
create view v_order_financials with (security_invoker = true) as
select
  o.id as order_id, o.order_number, o.customer_id, o.currency, o.order_date, o.status,
  o.subtotal, o.discount_amount, o.tax_amount, o.shipping_charge, o.total as order_total,
  coalesce(adj.debit, 0) - coalesce(adj.credit, 0) as adjustments,
  o.total + coalesce(adj.debit, 0) - coalesce(adj.credit, 0) as amount_due,
  coalesce(pay.received, 0) - coalesce(pay.refunded, 0) as cash_received,
  o.total + coalesce(adj.debit, 0) - coalesce(adj.credit, 0) - (coalesce(pay.received, 0) - coalesce(pay.refunded, 0)) as outstanding_balance
from orders o
left join lateral (
  select sum(a.amount) filter (where a.kind = 'debit') as debit, sum(a.amount) filter (where a.kind = 'credit') as credit
  from invoice_adjustments a join invoices i on i.id = a.invoice_id where i.order_id = o.id and i.status <> 'void'
) adj on true
left join lateral (
  select sum(p.received_order_amount) filter (where p.kind = 'payment' and p.status in ('received', 'partially_received')) as received,
         sum(p.received_order_amount) filter (where p.kind = 'refund' and p.status in ('received', 'partially_received')) as refunded
  from payments p where p.order_id = o.id
) pay on true
where o.status <> 'cancelled';

create or replace function app.refresh_order_payment_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_due numeric; v_cash numeric; v_status text;
begin
  v_id := coalesce(new.order_id, old.order_id);
  select amount_due, cash_received into v_due, v_cash from v_order_financials where order_id = v_id;
  if v_due is null then return null; end if;
  v_status := case when v_cash <= 0 then 'unpaid' when v_cash < v_due then 'partial' when v_cash = v_due then 'paid' else 'overpaid' end;
  update orders set payment_status = v_status where id = v_id and payment_status is distinct from v_status;
  return null;
end $$;
create trigger payments_refresh_order after insert or update on payments for each row execute function app.refresh_order_payment_status();
create or replace function app.refresh_order_payment_status_from_adjustment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_due numeric; v_cash numeric; v_status text;
begin
  select order_id into v_id from invoices where id = new.invoice_id;
  select amount_due, cash_received into v_due, v_cash from v_order_financials where order_id = v_id;
  if v_due is null then return null; end if;
  v_status := case when v_cash <= 0 then 'unpaid' when v_cash < v_due then 'partial' when v_cash = v_due then 'paid' else 'overpaid' end;
  update orders set payment_status = v_status where id = v_id and payment_status is distinct from v_status;
  return null;
end $$;
create trigger adjustments_refresh_order after insert on invoice_adjustments
  for each row execute function app.refresh_order_payment_status_from_adjustment();

-- Orders profit view: revenue, direct costs, gross profit (actual, from recorded costs) ----------------
create view v_order_profit with (security_invoker = true) as
select
  f.order_id, f.order_number, f.customer_id, f.currency, f.order_date,
  f.order_total - f.tax_amount as net_sales_revenue,
  coalesce(c.direct_cost_base, 0) as direct_costs_base,
  coalesce(c.additional_cost_base, 0) as additional_costs_base
from v_order_financials f
left join lateral (
  select sum(oc.amount_base) filter (where oc.cost_class = 'direct') as direct_cost_base,
         sum(oc.amount_base) filter (where oc.cost_class = 'additional') as additional_cost_base
  from order_costs oc where oc.order_id = f.order_id and oc.voided_at is null
) c on true;
