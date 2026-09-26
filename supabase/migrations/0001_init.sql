-- PowerPal - Supabase schema
-- Everything lives in its own "powerpal" Postgres schema, not "public" -
-- this Supabase project already hosts a different app's tables in public
-- (a university/campus app with its own "profiles" table), so a dedicated
-- schema keeps PowerPal completely isolated from whatever else is here.
--
-- Auth: uses Supabase's built-in auth.users. We sign people up with a
-- synthetic email (phone@powerpal.local) so the app keeps its phone+password
-- UX, and store the real profile (name, phone, role) in powerpal.profiles,
-- linked 1:1 to auth.users via id.

create extension if not exists "pgcrypto";

create schema if not exists powerpal;

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
create type powerpal.user_role as enum ('CUSTOMER', 'ADMIN', 'SUPPORT_AGENT');
create type powerpal.user_status as enum ('ACTIVE', 'SUSPENDED');
create type powerpal.meter_type as enum ('SINGLE_PHASE', 'THREE_PHASE', 'UNKNOWN');
create type powerpal.verification_status as enum ('UNVERIFIED', 'VERIFIED', 'FAILED');
create type powerpal.transaction_status as enum ('PENDING', 'PROCESSING', 'SUCCESSFUL', 'FAILED', 'REVERSED', 'REFUNDED');
create type powerpal.reconciliation_status as enum ('UNRECONCILED', 'MATCHED', 'MISMATCHED');
create type powerpal.payment_status as enum ('INITIATED', 'SUCCESSFUL', 'FAILED');
create type powerpal.token_loading_status as enum ('UNKNOWN', 'NOT_LOADED', 'LOADED');
create type powerpal.balance_source as enum ('LIVE_METER', 'ESTIMATED', 'USER_ENTERED_READING');
create type powerpal.support_category as enum ('PAYMENT_PROBLEM', 'TOKEN_PROBLEM', 'METER_PROBLEM', 'BALANCE_PROBLEM', 'WRONG_CUSTOMER_DETAILS', 'REFUND', 'OTHER');
create type powerpal.support_status as enum ('OPEN', 'PROCESSING', 'RESOLVED');
create type powerpal.notification_category as enum ('TRANSACTION', 'LOW_BALANCE', 'TOKEN', 'USAGE', 'BUDGET', 'SYSTEM');

-- ---------------------------------------------------------------------------
-- PROFILES (extends auth.users)
-- ---------------------------------------------------------------------------
create table powerpal.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone_number text unique not null,
  full_name text not null,
  role powerpal.user_role not null default 'CUSTOMER',
  status powerpal.user_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row whenever someone signs up via Supabase Auth.
-- full_name/phone_number are passed in as user metadata at signUp time.
create function powerpal.handle_new_user()
returns trigger as $$
begin
  insert into powerpal.profiles (id, phone_number, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'phone_number', new.email),
    coalesce(new.raw_user_meta_data->>'full_name', 'PowerPal user')
  );
  return new;
end;
$$ language plpgsql security definer set search_path = powerpal, public;

create trigger powerpal_on_auth_user_created
  after insert on auth.users
  for each row execute procedure powerpal.handle_new_user();

-- Helper used throughout RLS policies below.
create function powerpal.is_admin()
returns boolean as $$
  select exists (
    select 1 from powerpal.profiles where id = auth.uid() and role = 'ADMIN'
  );
$$ language sql security definer stable set search_path = powerpal, public;

-- ---------------------------------------------------------------------------
-- DISCOS & METER MODELS (reference data, public read)
-- ---------------------------------------------------------------------------
create table powerpal.discos (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  short_code text unique not null,
  region text,
  is_active boolean not null default true
);

create table powerpal.meter_models (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null,
  model_name text not null,
  meter_type powerpal.meter_type not null default 'UNKNOWN',
  balance_check_steps jsonb not null,
  token_load_steps jsonb not null,
  verified_source text,
  created_at timestamptz not null default now(),
  unique (manufacturer, model_name)
);

-- ---------------------------------------------------------------------------
-- METERS
-- ---------------------------------------------------------------------------
create table powerpal.meters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references powerpal.profiles(id) on delete cascade,
  label text not null,
  meter_number text not null,
  disco_id uuid not null references powerpal.discos(id),
  meter_model_id uuid references powerpal.meter_models(id),
  customer_name text,
  address text,
  meter_type powerpal.meter_type not null default 'UNKNOWN',
  minimum_purchase numeric,
  phone_number text,
  verification_status powerpal.verification_status not null default 'UNVERIFIED',
  verified_at timestamptz,
  verification_raw jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meter_number, disco_id)
);
create index on powerpal.meters (user_id);

-- ---------------------------------------------------------------------------
-- PURCHASES / TRANSACTIONS / PAYMENTS
-- ---------------------------------------------------------------------------
create table powerpal.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references powerpal.profiles(id) on delete cascade,
  meter_id uuid not null references powerpal.meters(id),
  amount_requested numeric not null,
  created_at timestamptz not null default now()
);

create table powerpal.transactions (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid unique not null references powerpal.purchases(id) on delete cascade,
  internal_ref text unique not null,
  provider_transaction_id text,
  provider_name text not null,
  amount_paid numeric,
  electricity_credit_raw numeric,
  other_charges_raw numeric,
  units_kwh numeric,
  currency text not null default 'NGN',
  status powerpal.transaction_status not null default 'PENDING',
  failure_reason text,
  payment_reference text,
  reconciliation_status powerpal.reconciliation_status not null default 'UNRECONCILED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table powerpal.transaction_events (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references powerpal.transactions(id) on delete cascade,
  from_status powerpal.transaction_status,
  to_status powerpal.transaction_status not null,
  note text,
  raw jsonb,
  created_at timestamptz not null default now()
);

create table powerpal.payments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid unique not null references powerpal.transactions(id) on delete cascade,
  processor text not null,
  processor_ref text unique not null,
  amount numeric not null,
  status powerpal.payment_status not null default 'INITIATED',
  webhook_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- TOKENS
-- ---------------------------------------------------------------------------
create table powerpal.tokens (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid unique not null references powerpal.purchases(id) on delete cascade,
  meter_id uuid not null references powerpal.meters(id),
  token_value text not null,
  units numeric,
  amount numeric not null,
  loading_status powerpal.token_loading_status not null default 'UNKNOWN',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- USAGE / ESTIMATION
-- ---------------------------------------------------------------------------
create table powerpal.balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  meter_id uuid not null references powerpal.meters(id) on delete cascade,
  balance_kwh numeric not null,
  source powerpal.balance_source not null,
  note text,
  created_at timestamptz not null default now()
);
create index on powerpal.balance_snapshots (meter_id, created_at);

create table powerpal.usage_records (
  id uuid primary key default gen_random_uuid(),
  meter_id uuid not null references powerpal.meters(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  kwh_consumed numeric not null,
  source powerpal.balance_source not null,
  created_at timestamptz not null default now()
);
create index on powerpal.usage_records (meter_id, period_start);

create table powerpal.appliances (
  id uuid primary key default gen_random_uuid(),
  meter_id uuid not null references powerpal.meters(id) on delete cascade,
  name text not null,
  wattage numeric,
  hours_per_day numeric,
  quantity integer not null default 1,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ALERTS / BUDGETS / SUPPORT / NOTIFICATIONS
-- ---------------------------------------------------------------------------
create table powerpal.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references powerpal.profiles(id) on delete cascade,
  meter_id uuid not null references powerpal.meters(id) on delete cascade,
  threshold_kwh numeric,
  threshold_days numeric,
  is_active boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now()
);

create table powerpal.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references powerpal.profiles(id) on delete cascade,
  meter_id uuid references powerpal.meters(id) on delete cascade,
  monthly_limit numeric not null,
  period_month integer not null,
  period_year integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, meter_id, period_month, period_year)
);

create table powerpal.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references powerpal.profiles(id) on delete cascade,
  category powerpal.support_category not null,
  description text not null,
  status powerpal.support_status not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table powerpal.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references powerpal.profiles(id) on delete cascade,
  category powerpal.notification_category not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table powerpal.provider_call_logs (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null,
  operation text not null,
  success boolean not null,
  latency_ms integer not null,
  error_message text,
  created_at timestamptz not null default now()
);

-- Lets the API layer (PostgREST/Supabase client) see the powerpal schema at
-- all - without this grant, .schema('powerpal') calls from the app get a
-- permission error even though RLS policies (next migration) would allow it.
grant usage on schema powerpal to anon, authenticated;
grant all on all tables in schema powerpal to anon, authenticated;
grant all on all sequences in schema powerpal to anon, authenticated;
alter default privileges in schema powerpal grant all on tables to anon, authenticated;
alter default privileges in schema powerpal grant all on sequences to anon, authenticated;
