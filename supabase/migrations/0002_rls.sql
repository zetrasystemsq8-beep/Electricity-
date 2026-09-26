-- Row Level Security, for the powerpal schema tables.

alter table powerpal.profiles enable row level security;
alter table powerpal.discos enable row level security;
alter table powerpal.meter_models enable row level security;
alter table powerpal.meters enable row level security;
alter table powerpal.purchases enable row level security;
alter table powerpal.transactions enable row level security;
alter table powerpal.transaction_events enable row level security;
alter table powerpal.payments enable row level security;
alter table powerpal.tokens enable row level security;
alter table powerpal.balance_snapshots enable row level security;
alter table powerpal.usage_records enable row level security;
alter table powerpal.appliances enable row level security;
alter table powerpal.alerts enable row level security;
alter table powerpal.budgets enable row level security;
alter table powerpal.support_tickets enable row level security;
alter table powerpal.notifications enable row level security;
alter table powerpal.provider_call_logs enable row level security;

create policy "profiles_select_own_or_admin" on powerpal.profiles
  for select using (id = auth.uid() or powerpal.is_admin());
create policy "profiles_update_own" on powerpal.profiles
  for update using (id = auth.uid());
create policy "profiles_admin_update_any" on powerpal.profiles
  for update using (powerpal.is_admin());

create policy "discos_select_all" on powerpal.discos
  for select using (auth.role() = 'authenticated');
create policy "meter_models_select_all" on powerpal.meter_models
  for select using (auth.role() = 'authenticated');

create policy "meters_select_own_or_admin" on powerpal.meters
  for select using (user_id = auth.uid() or powerpal.is_admin());
create policy "meters_insert_own" on powerpal.meters
  for insert with check (user_id = auth.uid());
create policy "meters_update_own_or_admin" on powerpal.meters
  for update using (user_id = auth.uid() or powerpal.is_admin());

create policy "purchases_select_own_or_admin" on powerpal.purchases
  for select using (user_id = auth.uid() or powerpal.is_admin());
create policy "purchases_insert_own" on powerpal.purchases
  for insert with check (user_id = auth.uid());

create policy "transactions_select_own_or_admin" on powerpal.transactions
  for select using (
    exists (select 1 from powerpal.purchases p where p.id = purchase_id and p.user_id = auth.uid())
    or powerpal.is_admin()
  );

create policy "transaction_events_select_own_or_admin" on powerpal.transaction_events
  for select using (
    exists (
      select 1 from powerpal.transactions t
      join powerpal.purchases p on p.id = t.purchase_id
      where t.id = transaction_id and p.user_id = auth.uid()
    )
    or powerpal.is_admin()
  );

create policy "payments_select_own_or_admin" on powerpal.payments
  for select using (
    exists (
      select 1 from powerpal.transactions t
      join powerpal.purchases p on p.id = t.purchase_id
      where t.id = transaction_id and p.user_id = auth.uid()
    )
    or powerpal.is_admin()
  );

create policy "tokens_select_own_or_admin" on powerpal.tokens
  for select using (
    exists (select 1 from powerpal.purchases p where p.id = purchase_id and p.user_id = auth.uid())
    or powerpal.is_admin()
  );
create policy "tokens_update_own" on powerpal.tokens
  for update using (
    exists (select 1 from powerpal.purchases p where p.id = purchase_id and p.user_id = auth.uid())
  );

create policy "balance_snapshots_select_own_or_admin" on powerpal.balance_snapshots
  for select using (
    exists (select 1 from powerpal.meters m where m.id = meter_id and m.user_id = auth.uid())
    or powerpal.is_admin()
  );
create policy "balance_snapshots_insert_own" on powerpal.balance_snapshots
  for insert with check (
    exists (select 1 from powerpal.meters m where m.id = meter_id and m.user_id = auth.uid())
  );

create policy "usage_records_select_own_or_admin" on powerpal.usage_records
  for select using (
    exists (select 1 from powerpal.meters m where m.id = meter_id and m.user_id = auth.uid())
    or powerpal.is_admin()
  );
create policy "usage_records_insert_own" on powerpal.usage_records
  for insert with check (
    exists (select 1 from powerpal.meters m where m.id = meter_id and m.user_id = auth.uid())
  );

create policy "appliances_all_own" on powerpal.appliances
  for all using (
    exists (select 1 from powerpal.meters m where m.id = meter_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from powerpal.meters m where m.id = meter_id and m.user_id = auth.uid())
  );

create policy "alerts_all_own" on powerpal.alerts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "budgets_all_own" on powerpal.budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "support_tickets_select_own_or_admin" on powerpal.support_tickets
  for select using (user_id = auth.uid() or powerpal.is_admin());
create policy "support_tickets_insert_own" on powerpal.support_tickets
  for insert with check (user_id = auth.uid());
create policy "support_tickets_admin_update" on powerpal.support_tickets
  for update using (powerpal.is_admin());

create policy "notifications_select_own" on powerpal.notifications
  for select using (user_id = auth.uid());
create policy "notifications_update_own" on powerpal.notifications
  for update using (user_id = auth.uid());

create policy "provider_call_logs_admin_select" on powerpal.provider_call_logs
  for select using (powerpal.is_admin());
