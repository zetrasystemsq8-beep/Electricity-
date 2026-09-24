-- PowerPal - Supabase schema
-- Auth: uses Supabase's built-in auth.users. We sign people up with a
-- synthetic email (phone@powerpal.local) so the app keeps its phone+password
-- UX, and store the real profile (name, phone, role) in public.profiles,
-- linked 1:1 to auth.users via id.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
create type user_role as enum ('CUSTOMER', 'ADMIN', 'SUPPORT_AGENT');
create type user_status as enum ('ACTIVE', 'SUSPENDED');
create type meter_type as enum ('SINGLE_PHASE', 'THREE_PHASE', 'UNKNOWN');
create type verification_status as enum ('UNVERIFIED', 'VERIFIED', 'FAILED');
create type transaction_status as enum ('PENDING', 'PROCESSING', 'SUCCESSFUL', 'FAILED', 'REVERSED', 'REFUNDED');
create type reconciliation_status as enum ('UNRECONCILED', 'MATCHED', 'MISMATCHED');
create type payment_status as enum ('INITIATED', 'SUCCESSFUL', 'FAILED');
create type token_loading_status as enum ('UNKNOWN', 'NOT_LOADED', 'LOADED');
create type balance_source as enum ('LIVE_METER', 'ESTIMATED', 'USER_ENTERED_READING');
create type support_category as enum ('PAYMENT_PROBLEM', 'TOKEN_PROBLEM', 'METER_PROBLEM', 'BALANCE_PROBLEM', 'WRONG_CUSTOMER_DETAILS', 'REFUND', 'OTHER');
create type support_status as enum ('OPEN', 'PROCESSING', 'RESOLVED');
create type notification_category as enum ('TRANSACTION', 'LOW_BALANCE', 'TOKEN', 'USAGE', 'BUDGET', 'SYSTEM');

-- ---------------------------------------------------------------------------
-- PROFILES (extends auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone_number text unique not null,
  full_name text not null,
  role user_role not null default 'CUSTOMER',
  status user_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row whenever someone signs up via Supabase Auth.
-- full_name/phone_number are passed in as user metadata at signUp time.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, phone_number, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'phone_number', new.email),
    coalesce(new.raw_user_meta_data->>'full_name', 'PowerPal user')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper used throughout RLS policies below.
create function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'ADMIN'
  );
$$ language sql security definer stable;

-- ---------------------------------------------------------------------------
-- DISCOS & METER MODELS (reference data, public read)
-- ---------------------------------------------------------------------------
create table public.discos (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  short_code text unique not null,
  region text,
  is_active boolean not null default true
);

create table public.meter_models (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null,
  model_name text not null,
  meter_type meter_type not null default 'UNKNOWN',
  balance_check_steps jsonb not null,
  token_load_steps jsonb not null,
  verified_source text,
  created_at timestamptz not null default now(),
  unique (manufacturer, model_name)
);

-- ---------------------------------------------------------------------------
-- METERS
-- ---------------------------------------------------------------------------
create table public.meters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  meter_number text not null,
  disco_id uuid not null references public.discos(id),
  meter_model_id uuid references public.meter_models(id),
  customer_name text,
  address text,
  meter_type meter_type not null default 'UNKNOWN',
  minimum_purchase numeric,
  phone_number text,
  verification_status verification_status not null default 'UNVERIFIED',
  verified_at timestamptz,
  verification_raw jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meter_number, disco_id)
);
create index on public.meters (user_id);

-- ---------------------------------------------------------------------------
-- PURCHASES / TRANSACTIONS / PAYMENTS
-- ---------------------------------------------------------------------------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meter_id uuid not null references public.meters(id),
  amount_requested numeric not null,
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid unique not null references public.purchases(id) on delete cascade,
  internal_ref text unique not null,
  provider_transaction_id text,
  provider_name text not null,
  amount_paid numeric,
  electricity_credit_raw numeric,
  other_charges_raw numeric,
  units_kwh numeric,
  currency text not null default 'NGN',
  status transaction_status not null default 'PENDING',
  failure_reason text,
  payment_reference text,
  reconciliation_status reconciliation_status not null default 'UNRECONCILED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transaction_events (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  from_status transaction_status,
  to_status transaction_status not null,
  note text,
  raw jsonb,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid unique not null references public.transactions(id) on delete cascade,
  processor text not null,
  processor_ref text unique not null,
  amount numeric not null,
  status payment_status not null default 'INITIATED',
  webhook_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- TOKENS
-- ---------------------------------------------------------------------------
create table public.tokens (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid unique not null references public.purchases(id) on delete cascade,
  meter_id uuid not null references public.meters(id),
  token_value text not null,
  units numeric,
  amount numeric not null,
  loading_status token_loading_status not null default 'UNKNOWN',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- USAGE / ESTIMATION
-- ---------------------------------------------------------------------------
create table public.balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  meter_id uuid not null references public.meters(id) on delete cascade,
  balance_kwh numeric not null,
  source balance_source not null,
  note text,
  created_at timestamptz not null default now()
);
create index on public.balance_snapshots (meter_id, created_at);

create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  meter_id uuid not null references public.meters(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  kwh_consumed numeric not null,
  source balance_source not null,
  created_at timestamptz not null default now()
);
create index on public.usage_records (meter_id, period_start);

create table public.appliances (
  id uuid primary key default gen_random_uuid(),
  meter_id uuid not null references public.meters(id) on delete cascade,
  name text not null,
  wattage numeric,
  hours_per_day numeric,
  quantity integer not null default 1,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ALERTS / BUDGETS / SUPPORT / NOTIFICATIONS
-- ---------------------------------------------------------------------------
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meter_id uuid not null references public.meters(id) on delete cascade,
  threshold_kwh numeric,
  threshold_days numeric,
  is_active boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meter_id uuid references public.meters(id) on delete cascade,
  monthly_limit numeric not null,
  period_month integer not null,
  period_year integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, meter_id, period_month, period_year)
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category support_category not null,
  description text not null,
  status support_status not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category notification_category not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.provider_call_logs (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null,
  operation text not null,
  success boolean not null,
  latency_ms integer not null,
  error_message text,
  created_at timestamptz not null default now()
);
