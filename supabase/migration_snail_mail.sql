-- =============================================
-- Migration: Snail mail (monthly postcard subscription)
-- Run this ONCE in the Supabase SQL Editor (after schema.sql).
-- Safe to re-run: every statement is idempotent.
--
-- SECURITY MODEL: these tables hold customers' home addresses, so they are
-- locked down completely. Row Level Security is ON and there are NO policies,
-- which means the public (anon) key and any logged-in user can read/write
-- nothing. Only the server (SUPABASE_SERVICE_ROLE_KEY, used by the
-- /api/admin/mail/* routes after checking the admin login) can touch them.
-- =============================================

-- ── SUBSCRIBERS: who receives the postcards ──────────────────────
create table if not exists public.mail_subscribers (
  id               uuid          primary key default gen_random_uuid(),
  name             text          not null,
  email            text,
  phone            text,
  address_line1    text          not null,
  address_line2    text,
  city             text,
  state_region     text,
  postal_code      text,
  country          text          not null default 'Singapore',
  status           text          not null default 'active'
                   check (status in ('active', 'paused', 'cancelled')),
  price_per_issue  numeric(10,2) not null default 0 check (price_per_issue >= 0),  -- 0 = free
  source           text,                          -- how they found you
  notes            text,
  joined_on        date          not null default current_date,
  created_at       timestamptz   not null default now()
);

create index if not exists mail_subscribers_status_idx on public.mail_subscribers (status);

-- ── ISSUES: one postcard design per month ────────────────────────
create table if not exists public.mail_issues (
  id              uuid          primary key default gen_random_uuid(),
  issue_month     date          not null unique
                  check (extract(day from issue_month) = 1),   -- always the 1st of the month
  city            text          not null,
  country         text,
  title           text,                           -- optional name for the design
  artwork_id      text          references public.artworks (id) on delete set null,
  highlights      text,                           -- travel highlights printed on the card (private)
  story           text,                           -- personal story printed on the card (private)
  status          text          not null default 'planning'
                  check (status in ('planning', 'printing', 'ready', 'shipped')),
  is_published    boolean       not null default false,  -- show on the public /postcards page
  print_cost      numeric(10,2) not null default 0 check (print_cost >= 0),      -- per card
  postage_local   numeric(10,2) not null default 0 check (postage_local >= 0),   -- per card, Singapore
  postage_intl    numeric(10,2) not null default 0 check (postage_intl >= 0),    -- per card, overseas
  packaging_cost  numeric(10,2) not null default 0 check (packaging_cost >= 0),  -- per card
  notes           text,
  created_at      timestamptz   not null default now()
);

-- ── SHIPMENTS: one row per postcard sent to one subscriber ───────
-- Costs/price are copied onto each row when it is created, so changing an
-- issue's costs later never rewrites history for cards already sent.
create table if not exists public.mail_shipments (
  id              uuid          primary key default gen_random_uuid(),
  issue_id        uuid          not null references public.mail_issues (id)      on delete restrict,
  subscriber_id   uuid          not null references public.mail_subscribers (id) on delete restrict,
  status          text          not null default 'pending'
                  check (status in ('pending', 'printed', 'mailed', 'delivered', 'returned')),
  mailed_on       date,
  tracking_ref    text,
  price_charged   numeric(10,2) not null default 0 check (price_charged >= 0),
  print_cost      numeric(10,2) not null default 0 check (print_cost >= 0),
  postage_cost    numeric(10,2) not null default 0 check (postage_cost >= 0),
  packaging_cost  numeric(10,2) not null default 0 check (packaging_cost >= 0),
  notes           text,
  created_at      timestamptz   not null default now(),
  unique (issue_id, subscriber_id)                -- a subscriber gets one card per issue
);

create index if not exists mail_shipments_issue_idx      on public.mail_shipments (issue_id);
create index if not exists mail_shipments_subscriber_idx on public.mail_shipments (subscriber_id);

-- ── LOCK EVERYTHING DOWN ─────────────────────────────────────────
alter table public.mail_subscribers enable row level security;
alter table public.mail_issues      enable row level security;
alter table public.mail_shipments   enable row level security;

-- No policies on purpose (default deny). Belt and braces: also remove table
-- privileges from the public-facing roles. service_role is unaffected.
revoke all on public.mail_subscribers from anon, authenticated;
revoke all on public.mail_issues      from anon, authenticated;
revoke all on public.mail_shipments   from anon, authenticated;
