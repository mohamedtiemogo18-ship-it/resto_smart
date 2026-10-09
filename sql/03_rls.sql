-- =====================================================================
-- 03 - ROW LEVEL SECURITY
-- Principe : RLS ACTIVÉ sur toutes les tables. Le backend FastAPI utilise
-- le rôle service_role (BYPASSRLS) et applique ses propres permissions ;
-- la RLS protège l'accès direct à la base (console Supabase, clé anon).
-- =====================================================================

alter table public.profiles          enable row level security;
alter table public.meal_types        enable row level security;
alter table public.meal_prices       enable row level security;
alter table public.reservations      enable row level security;
alter table public.reservation_items enable row level security;
alter table public.tickets           enable row level security;
alter table public.audit_logs        enable row level security;
alter table public.app_settings      enable row level security;

-- ---------------------------------------------------------------------
-- Droits de base
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select                         on public.profiles          to authenticated;
grant update                         on public.profiles          to authenticated;
grant select                         on public.meal_types        to authenticated;
grant select                         on public.meal_prices       to authenticated;
grant select, insert                 on public.reservations      to authenticated;
grant update                         on public.reservations      to authenticated;
grant select, insert, update, delete on public.reservation_items to authenticated;
grant select                         on public.tickets           to authenticated;
grant select                         on public.audit_logs        to authenticated;
grant insert                         on public.audit_logs        to authenticated;
grant select                         on public.app_settings      to authenticated;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Aucune écriture directe sur les tickets : ils ne naissent que d'un
-- paiement confirmé (fn_confirm_payment, appelé par le service_role).
revoke insert, update, delete on public.tickets from authenticated;
revoke update, delete on public.audit_logs from authenticated;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- meal_types / meal_prices / app_settings : lecture ouverte au personnel
-- connecté, écriture réservée à l'admin
-- ---------------------------------------------------------------------
drop policy if exists meal_types_select on public.meal_types;
create policy meal_types_select on public.meal_types
  for select to authenticated using (true);

drop policy if exists meal_types_write_admin on public.meal_types;
create policy meal_types_write_admin on public.meal_types
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists meal_prices_select on public.meal_prices;
create policy meal_prices_select on public.meal_prices
  for select to authenticated using (true);

drop policy if exists meal_prices_write_admin on public.meal_prices;
create policy meal_prices_write_admin on public.meal_prices
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
  for select to authenticated using (true);

drop policy if exists app_settings_write_admin on public.app_settings;
create policy app_settings_write_admin on public.app_settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- reservations : l'étudiant voit et gère les siennes, le personnel voit tout
-- ---------------------------------------------------------------------
drop policy if exists reservations_select on public.reservations;
create policy reservations_select on public.reservations
  for select to authenticated
  using (student_id = auth.uid() or public.is_staff());

drop policy if exists reservations_insert_student on public.reservations;
create policy reservations_insert_student on public.reservations
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and status = 'PENDING_PAYMENT'
    and paid_at is null and paid_by is null
  );

drop policy if exists reservations_insert_staff on public.reservations;
create policy reservations_insert_staff on public.reservations
  for insert to authenticated
  with check (public.is_staff() and status = 'PENDING_PAYMENT');

-- Le trigger fn_guard_reservation_update limite déjà ce qui est possible
-- (annulation seule pour l'étudiant, jamais de passage à PAID).
drop policy if exists reservations_update on public.reservations;
create policy reservations_update on public.reservations
  for update to authenticated
  using (student_id = auth.uid() or public.is_staff())
  with check (student_id = auth.uid() or public.is_staff());

-- Aucune suppression : on annule, on n'efface pas.
-- (Pas de policy DELETE.)

-- ---------------------------------------------------------------------
-- reservation_items : visibilité et écriture dérivées de la réservation
-- ---------------------------------------------------------------------
drop policy if exists reservation_items_select on public.reservation_items;
create policy reservation_items_select on public.reservation_items
  for select to authenticated
  using (
    exists (
      select 1 from public.reservations r
       where r.id = reservation_items.reservation_id
         and (r.student_id = auth.uid() or public.is_staff())
    )
  );

drop policy if exists reservation_items_write on public.reservation_items;
create policy reservation_items_write on public.reservation_items
  for all to authenticated
  using (
    exists (
      select 1 from public.reservations r
       where r.id = reservation_items.reservation_id
         and (r.student_id = auth.uid() or public.is_staff())
    )
  )
  with check (
    exists (
      select 1 from public.reservations r
       where r.id = reservation_items.reservation_id
         and (r.student_id = auth.uid() or public.is_staff())
    )
  );

-- ---------------------------------------------------------------------
-- tickets : lecture seule pour l'étudiant (les siens) et le personnel.
-- Toute mutation passe par fn_confirm_payment / fn_consume_ticket.
-- ---------------------------------------------------------------------
drop policy if exists tickets_select on public.tickets;
create policy tickets_select on public.tickets
  for select to authenticated
  using (student_id = auth.uid() or public.is_staff());

-- ---------------------------------------------------------------------
-- audit_logs : l'admin lit, chacun écrit ses propres traces, jamais
-- de modification ni de suppression (règle 10)
-- ---------------------------------------------------------------------
drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using (public.is_admin());

drop policy if exists audit_logs_insert_actor on public.audit_logs;
create policy audit_logs_insert_actor on public.audit_logs
  for insert to authenticated
  with check (actor_id = auth.uid() or actor_id is null);
