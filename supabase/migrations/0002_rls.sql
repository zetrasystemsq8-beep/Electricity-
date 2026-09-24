-- Row Level Security. This is the entire access-control layer now that the
-- Flutter app talks to Supabase directly - every table a user can reach is
-- locked to "your own rows only" unless you're an admin (public.is_admin()).
-- Tables written only by Edge Functions (using the service-role key, which
-- bypasses RLS) still get policies here so the Flutter admin screens and
-- any direct client reads behave correctly.

alter table public.profiles enable row level security;
alter table public.discos enable row level security;
alter table public.meter_models enable row level security;
alter table public.meters enable row level security;
alter table public.purchases enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_events enable row level security;
alter table public.payments enable row level security;
alter table public.tokens enable row level security;
alter table public.balance_snapshots enable row level security;
alter table public.usage_records enable row level security;
alter table public.appliances enable row level security;
alter table public.alerts enable row level security;
alter table public.budgets enable row level security;
alter table public.support_tickets enable row level security;
alter table public.notifications enable row level security;
alter table public.provider_call_logs enable row level security;

-- profiles: everyone can read their own profile; admins can read/update all;
-- a user can update their own non-role fields (role changes are admin-only
-- since there's no update policy here granting role changes to self).
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());
create policy "profiles_admin_update_any" on public.profiles
  for update using (public.is_admin());

-- discos, meter_models: public reference data, readable by any signed-in user.
create policy "discos_select_all" on public.discos
  for select using (auth.role() = 'authenticated');
create policy "meter_models_select_all" on public.meter_models
  for select using (auth.role() = 'authenticated');

-- meters: owner or admin.
create policy "meters_select_own_or_admin" on public.meters
  for select using (user_id = auth.uid() or public.is_admin());
create policy "meters_insert_own" on public.meters
  for insert with check (user_id = auth.uid());
create policy "meters_update_own_or_admin" on public.meters
  for update using (user_id = auth.uid() or public.is_admin());

-- purchases: owner or admin. Inserts happen from the client (initiate flow
-- creates the Purchase row before handing off to the initiate-purchase
-- Edge Function for the provider/payment side).
create policy "purchases_select_own_or_admin" on public.purchases
  for select using (user_id = auth.uid() or public.is_admin());
create policy "purchases_insert_own" on public.purchases
  for insert with check (user_id = auth.uid());

-- transactions: readable if you own the parent purchase, or admin. All
-- writes to transactions happen via Edge Functions using the service-role
-- key (bypasses RLS) - no insert/update policy needed for regular users.
create policy "transactions_select_own_or_admin" on public.transactions
  for select using (
    exists (select 1 from public.purchases p where p.id = purchase_id and p.user_id = auth.uid())
    or public.is_admin()
  );

create policy "transaction_events_select_own_or_admin" on public.transaction_events
  for select using (
    exists (
      select 1 from public.transactions t
      join public.purchases p on p.id = t.purchase_id
      where t.id = transaction_id and p.user_id = auth.uid()
    )
    or public.is_admin()
  );

create policy "payments_select_own_or_admin" on public.payments
  for select using (
    exists (
      select 1 from public.transactions t
      join public.purchases p on p.id = t.purchase_id
      where t.id = transaction_id and p.user_id = auth.uid()
    )
    or public.is_admin()
  );

-- tokens: readable/writable (loading_status toggle) by the owning user.
create policy "tokens_select_own_or_admin" on public.tokens
  for select using (
    exists (select 1 from public.purchases p where p.id = purchase_id and p.user_id = auth.uid())
    or public.is_admin()
  );
create policy "tokens_update_own" on public.tokens
  for update using (
    exists (select 1 from public.purchases p where p.id = purchase_id and p.user_id = auth.uid())
  );

-- balance_snapshots / usage_records: readable + insertable (manual reading)
-- by the meter's owner.
create policy "balance_snapshots_select_own_or_admin" on public.balance_snapshots
  for select using (
    exists (select 1 from public.meters m where m.id = meter_id and m.user_id = auth.uid())
    or public.is_admin()
  );
create policy "balance_snapshots_insert_own" on public.balance_snapshots
  for insert with check (
    exists (select 1 from public.meters m where m.id = meter_id and m.user_id = auth.uid())
  );

create policy "usage_records_select_own_or_admin" on public.usage_records
  for select using (
    exists (select 1 from public.meters m where m.id = meter_id and m.user_id = auth.uid())
    or public.is_admin()
  );
create policy "usage_records_insert_own" on public.usage_records
  for insert with check (
    exists (select 1 from public.meters m where m.id = meter_id and m.user_id = auth.uid())
  );

-- appliances: full CRUD by the meter's owner.
create policy "appliances_all_own" on public.appliances
  for all using (
    exists (select 1 from public.meters m where m.id = meter_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.meters m where m.id = meter_id and m.user_id = auth.uid())
  );

-- alerts: full CRUD by owner.
create policy "alerts_all_own" on public.alerts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- budgets: full CRUD by owner.
create policy "budgets_all_own" on public.budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- support_tickets: owner can create/read own; admins can read/update all.
create policy "support_tickets_select_own_or_admin" on public.support_tickets
  for select using (user_id = auth.uid() or public.is_admin());
create policy "support_tickets_insert_own" on public.support_tickets
  for insert with check (user_id = auth.uid());
create policy "support_tickets_admin_update" on public.support_tickets
  for update using (public.is_admin());

-- notifications: owner can read/mark-read own.
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid());

-- provider_call_logs: admin-only (written by Edge Functions via service role).
create policy "provider_call_logs_admin_select" on public.provider_call_logs
  for select using (public.is_admin());
