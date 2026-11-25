-- ================================================================
-- Custom plans for the snail mail payment CRM
--
-- Run this ONCE in the Supabase SQL Editor, AFTER migration_snail_mail.sql and
-- migration_payments.sql. It is safe to run again.
--
-- What it does
--   * Plans become a list you control: each has a name, a length in months (1 to 120), an optional
--     price, an "offered" switch, and a "no payment needed" switch (for Friends & family and so on).
--     Your existing 3, 6 and 12 month plans and their prices are kept.
--   * Adds a "Friends & family" plan (no payment needed) the first time it runs. Rename or delete it
--     in the admin if you like.
--   * Subscribers and payments can point at a plan (plan_id). Existing ones are matched to the
--     3, 6 or 12 month plan they already had.
--   * A payment can also be a one-off "Custom" length with no plan.
--
-- Nothing here changes or removes your data, and the website that is already live keeps working
-- while you run it. The old plan_months column on subscribers is left in place, no longer used.
-- ================================================================

-- Stop early with a clear message if the earlier files have not been run.
do $$
begin
  if to_regclass('public.mail_plans') is null or to_regclass('public.mail_payments') is null then
    raise exception 'Run supabase/migration_payments.sql first (after migration_snail_mail.sql), then run this file again.';
  end if;
end $$;

-- ── Plans get an id, a name and a "no payment needed" switch ──────
alter table public.mail_plans add column if not exists id uuid default gen_random_uuid();
update public.mail_plans set id = gen_random_uuid() where id is null;
alter table public.mail_plans alter column id set not null;

alter table public.mail_plans add column if not exists name text;
update public.mail_plans set name = months::text || ' months' where name is null;
alter table public.mail_plans alter column name set not null;

alter table public.mail_plans add column if not exists is_complimentary boolean not null default false;

-- The key used to be `months`. Now it is `id`, so several plans can share a length.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.mail_plans'::regclass and contype = 'p'
      and conname = 'mail_plans_pkey' and pg_get_constraintdef(oid) like '%(months)%'
  ) then
    alter table public.mail_plans drop constraint mail_plans_pkey;
    alter table public.mail_plans add constraint mail_plans_pkey primary key (id);
  end if;
end $$;

-- Any whole number of months from 1 to 120 (the old checks only allowed 3, 6 and 12).
alter table public.mail_plans drop constraint if exists mail_plans_months_check;
alter table public.mail_plans add  constraint mail_plans_months_check check (months between 1 and 120);
alter table public.mail_plans drop constraint if exists mail_plans_name_check;
alter table public.mail_plans add  constraint mail_plans_name_check check (char_length(btrim(name)) between 1 and 60);
create unique index if not exists mail_plans_name_key on public.mail_plans (lower(btrim(name)));

alter table public.mail_payments drop constraint if exists mail_payments_plan_months_check;
alter table public.mail_payments add  constraint mail_payments_plan_months_check check (plan_months between 1 and 120);

-- ── Subscribers and payments can point at a plan ──────────────────
-- The first time only: add the links, match existing rows to the plan they already had, and
-- add the Friends & family plan. (Done once so a later re-run never undoes a change you made.)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'mail_subscribers' and column_name = 'plan_id'
  ) then
    alter table public.mail_subscribers
      add column plan_id uuid references public.mail_plans (id) on delete restrict;
    alter table public.mail_payments
      add column plan_id uuid references public.mail_plans (id) on delete restrict;

    update public.mail_subscribers s set plan_id = p.id
      from public.mail_plans p
      where s.plan_months is not null and p.months = s.plan_months and not p.is_complimentary
        and p.name = p.months::text || ' months';
    update public.mail_payments m set plan_id = p.id
      from public.mail_plans p
      where p.months = m.plan_months and not p.is_complimentary
        and p.name = p.months::text || ' months';

    insert into public.mail_plans (name, months, price, is_active, is_complimentary)
      values ('Friends & family', 12, null, true, true)
      on conflict do nothing;
  end if;
end $$;

create index if not exists mail_subscribers_plan_idx on public.mail_subscribers (plan_id);
create index if not exists mail_payments_plan_idx    on public.mail_payments (plan_id);

-- ── Lock-down (unchanged: only the server touches these) ──────────
alter table public.mail_plans enable row level security;
revoke all on public.mail_plans from anon, authenticated;
