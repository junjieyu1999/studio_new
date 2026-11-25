-- =============================================
-- Migration: Payment plans and payment tracking for the snail mail CRM
-- Run this ONCE in the Supabase SQL Editor, AFTER migration_snail_mail.sql.
-- Safe to re-run: every statement is idempotent.
--
-- What it adds
--   mail_subscribers  + payment_ref       a short code (PC0001…) the subscriber writes on their
--                                         PayNow / Revolut transfer so you can match it to them
--                     + plan_months       the plan they chose: 3, 6 or 12 months
--                     + preferred_method  how they said they would pay
--   mail_plans        the four plans and your price for each (price is blank until you set it)
--   mail_payments     one row per payment you receive. Each covers a block of months starting at
--                     period_start, so "paid through" is worked out from the payments themselves.
--
-- SECURITY: same model as the other mail tables. Row Level Security is ON with NO
-- policies and table privileges are revoked from the public roles, so only the server
-- (service role, after the admin login) can read or write payment data.
-- =============================================

-- ── Subscribers: payment reference, chosen plan, preferred method ─
create sequence if not exists public.mail_payment_ref_seq;

alter table public.mail_subscribers add column if not exists payment_ref      text;
alter table public.mail_subscribers add column if not exists plan_months      smallint
  check (plan_months in (3, 6, 12));
alter table public.mail_subscribers add column if not exists preferred_method text
  check (preferred_method in ('paynow', 'revolut', 'bank', 'other'));

-- One place that builds the next reference: PC0001, PC0002 … (grows past 4 digits if ever needed).
create or replace function public.next_mail_payment_ref()
returns text
language sql
security definer
set search_path = public
as $$
  select 'PC' || repeat('0', greatest(0, 4 - length(n::text))) || n::text
    from (select nextval('public.mail_payment_ref_seq') as n) q
$$;
revoke all on function public.next_mail_payment_ref() from public, anon, authenticated;
grant execute on function public.next_mail_payment_ref() to service_role;

-- Give every existing subscriber a reference, oldest first. Only fills blanks, so re-running is harmless.
do $$
declare r record;
begin
  for r in
    select id from public.mail_subscribers where payment_ref is null order by created_at, id
  loop
    update public.mail_subscribers set payment_ref = public.next_mail_payment_ref() where id = r.id;
  end loop;
end $$;

-- New subscribers get the next reference automatically.
alter table public.mail_subscribers alter column payment_ref set default public.next_mail_payment_ref();
alter table public.mail_subscribers alter column payment_ref set not null;
create unique index if not exists mail_subscribers_payment_ref_key
  on public.mail_subscribers (payment_ref);

-- ── Plans: 3, 6 and 12 months (there is no 1-month plan) ─────────
create table if not exists public.mail_plans (
  months      smallint      primary key check (months in (3, 6, 12)),
  price       numeric(10,2) check (price >= 0),        -- S$ for the whole plan; NULL = not set yet
  is_active   boolean       not null default true,     -- untick to stop offering a plan
  updated_at  timestamptz   not null default now()
);
-- (Skipped once migration_custom_plans.sql has been run: plans are then managed in the admin.)
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'mail_plans' and column_name = 'id') then
    insert into public.mail_plans (months) values (3), (6), (12)
      on conflict (months) do nothing;
  end if;
end $$;

-- ── Payments ─────────────────────────────────────────────────────
create table if not exists public.mail_payments (
  id             uuid          primary key default gen_random_uuid(),
  subscriber_id  uuid          not null references public.mail_subscribers (id) on delete restrict,
  paid_on        date          not null default current_date,
  method         text          not null
                 check (method in ('paynow', 'revolut', 'bank', 'other')),
  plan_months    smallint      not null check (plan_months in (3, 6, 12)),
  period_start   date          not null
                 check (extract(day from period_start) = 1),   -- first month covered (always the 1st)
  amount         numeric(10,2) not null check (amount >= 0),   -- what the customer sent
  currency       text          not null default 'SGD' check (currency ~ '^[A-Z]{3}$'),
  amount_sgd     numeric(10,2) not null check (amount_sgd >= 0),  -- what it is worth to you in S$
  reference      text,                                          -- bank / Revolut transaction reference
  status         text          not null default 'received'
                 check (status in ('received', 'refunded')),
  notes          text,
  created_at     timestamptz   not null default now()
);

-- ── Upgrade from the first version of this file (which also had a 1-month plan) ──
-- Safe on a fresh install and when re-run. Removes the 1-month plan, clears any subscriber's
-- chosen 1-month plan, and tightens the checks. If a 1-month PAYMENT was already recorded it stops
-- with a message instead of changing your payment history.
-- (Skipped once migration_custom_plans.sql has been run, which allows any length from 1 to 120 months.)
do $$
declare legacy int;
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'mail_plans' and column_name = 'id') then
    return;
  end if;

  select count(*) into legacy from public.mail_payments where plan_months = 1;
  if legacy > 0 then
    raise exception 'There are % recorded payment(s) on the old 1-month plan. Delete them or re-record them as a 3, 6 or 12 month plan, then run this file again.', legacy;
  end if;

  update public.mail_subscribers set plan_months = null where plan_months = 1;
  delete from public.mail_plans where months = 1;

  alter table public.mail_subscribers drop constraint if exists mail_subscribers_plan_months_check;
  alter table public.mail_subscribers add  constraint mail_subscribers_plan_months_check check (plan_months in (3, 6, 12));
  alter table public.mail_plans       drop constraint if exists mail_plans_months_check;
  alter table public.mail_plans       add  constraint mail_plans_months_check check (months in (3, 6, 12));
  alter table public.mail_payments    drop constraint if exists mail_payments_plan_months_check;
  alter table public.mail_payments    add  constraint mail_payments_plan_months_check check (plan_months in (3, 6, 12));
end $$;

create index if not exists mail_payments_subscriber_idx on public.mail_payments (subscriber_id);
create index if not exists mail_payments_paid_on_idx    on public.mail_payments (paid_on);

-- ── LOCK EVERYTHING DOWN ─────────────────────────────────────────
alter table public.mail_plans    enable row level security;
alter table public.mail_payments enable row level security;

revoke all on public.mail_plans    from anon, authenticated;
revoke all on public.mail_payments from anon, authenticated;
revoke all on sequence public.mail_payment_ref_seq from anon, authenticated;
