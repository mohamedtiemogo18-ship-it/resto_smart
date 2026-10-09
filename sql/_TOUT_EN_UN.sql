-- ==========================================================================
-- Resto Smart - SCHEMA COMPLET EN UN SEUL FICHIER
-- Projet : https://bwpvinarhhjenlftjoxa.supabase.co
-- Cote d'Ivoire - fuseau Africa/Abidjan - devise XOF
--
-- Usage : copiez TOUT ce fichier dans Supabase -> SQL Editor -> Run
-- Syntaxe validee avec le parseur PostgreSQL de pglast.
-- ==========================================================================

-- ==========================================================================
-- SOURCE : sql/00_extensions_enums.sql
-- ==========================================================================
create schema if not exists extensions;

create extension if not exists "pgcrypto"     with schema extensions;
create extension if not exists "btree_gist"  with schema extensions;

-- =====================================================================
-- TYPES Ã‰NUMÃ‰RÃ‰S
-- =====================================================================

-- RÃ´les applicatifs (le rÃ´le vit dans profiles, PAS dans auth.users)
create type public.user_role as enum ('student', 'logistician', 'admin');

-- Machine Ã  Ã©tats rÃ©servation : PENDING_PAYMENT -> PAID | CANCELLED
-- Aucun retour arriÃ¨re possible depuis PAID (rÃ¨gle 5)
create type public.reservation_status as enum ('PENDING_PAYMENT', 'PAID', 'CANCELLED');

-- Machine Ã  Ã©tats ticket : GENERATED -> USED | EXPIRED
-- USED est dÃ©finitif (rÃ¨gle 6)
create type public.ticket_status as enum ('GENERATED', 'USED', 'EXPIRED');

-- CrÃ©neaux de repas
create type public.meal_slot as enum ('BREAKFAST', 'LUNCH', 'DINNER');

-- =====================================================================
-- SÃ‰QUENCES DE NUMÃ‰ROTATION
-- RES-YYYY-000001 / TKT-YYYY-000001 (rÃ¨gle 8)
-- nextval() est atomique et non transactionnel : aucun doublon possible,
-- mÃªme en cas de rollback (pas de Â« trou Â» rÃ©utilisÃ©, ce qui est voulu).
-- =====================================================================

create sequence public.reservation_number_seq as bigint start with 1 increment by 1 minvalue 1 no maxvalue cache 1;
create sequence public.ticket_number_seq      as bigint start with 1 increment by 1 minvalue 1 no maxvalue cache 1;

comment on sequence public.reservation_number_seq is 'Remise Ã  1 au 1er janvier via fn_reset_number_sequences()';
comment on sequence public.ticket_number_seq      is 'Remise Ã  1 au 1er janvier via fn_reset_number_sequences()';


-- ==========================================================================
-- SOURCE : sql/01_tables.sql
-- ==========================================================================
-- =====================================================================
-- 01 - TABLES
-- Ordre de crÃ©ation respectant les dÃ©pendances de clÃ©s Ã©trangÃ¨res.
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles : extension de auth.users, porte le rÃ´le applicatif
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  matricule   text unique,
  full_name   text        not null check (length(btrim(full_name)) >= 2),
  phone       text,
  room        text,
  role        public.user_role not null default 'student',
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Un Ã©tudiant doit avoir un matricule ET une chambre (rÃ¨gle mÃ©tier Ã©tape 1.6)
  constraint profiles_student_fields_chk
    check (role <> 'student' or (matricule is not null and room is not null)),

  -- Format du matricule, seulement s'il est renseignÃ©
  constraint profiles_matricule_format_chk
    check (matricule is null or matricule ~ '^[A-Z0-9][A-Z0-9/-]{3,19}$'),

  -- Le personnel n'a pas de matricule Ã©tudiant
  constraint profiles_staff_no_matricule_chk
    check (role = 'student' or matricule is null)
);

create index profiles_role_idx on public.profiles (role) where is_active;
create index profiles_matricule_idx on public.profiles (matricule) where matricule is not null;

-- ---------------------------------------------------------------------
-- meal_types : les repas vendables (petit-dÃ©jeuner, dÃ©jeuner, dÃ®ner)
-- ---------------------------------------------------------------------
create table public.meal_types (
  id             smallint generated always as identity primary key,
  code           public.meal_slot not null unique,
  name           text   not null,
  description    text,
  display_order  smallint not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- meal_prices : historique des prix (rÃ¨gle 2 : le prix vient de la base)
-- PÃ©riodes de validitÃ© non chevauchantes garanties par exclusion contrainte.
-- ---------------------------------------------------------------------
create table public.meal_prices (
  id              bigint generated always as identity primary key,
  meal_type_id    smallint not null references public.meal_types(id) on delete restrict,
  amount          numeric(10,2) not null check (amount > 0),
  currency        char(3) not null default 'XOF',
  effective_from  date not null default current_date,
  effective_to    date,                       -- NULL = prix courant
  created_by      uuid not null references public.profiles(id) on delete restrict,
  created_at      timestamptz not null default now(),

  constraint meal_prices_period_chk
    check (effective_to is null or effective_to > effective_from),

  -- Deux prix pour un mÃªme repas ne peuvent pas se chevaucher dans le temps
  constraint meal_prices_no_overlap_excl exclude using gist (
    meal_type_id with =,
    daterange(effective_from, effective_to, '[)') with &&
  )
);

-- Un seul prix courant par repas
create unique index meal_prices_single_current_idx
  on public.meal_prices (meal_type_id) where effective_to is null;

create index meal_prices_current_idx on public.meal_prices (meal_type_id, effective_from desc);

-- ---------------------------------------------------------------------
-- reservations
-- ---------------------------------------------------------------------
create table public.reservations (
  id                  uuid primary key default gen_random_uuid(),
  reservation_number  text not null unique,
  student_id          uuid not null references public.profiles(id) on delete restrict,
  status              public.reservation_status not null default 'PENDING_PAYMENT',
  items_count         int not null default 0 check (items_count >= 0),
  total_amount        numeric(12,2) not null default 0 check (total_amount >= 0),
  note                text,
  paid_at             timestamptz,
  paid_by             uuid references public.profiles(id) on delete set null,
  cancelled_at        timestamptz,
  cancelled_by        uuid references public.profiles(id) on delete set null,
  cancellation_reason text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint reservations_number_format_chk
    check (reservation_number ~ '^RES-[0-9]{4}-[0-9]{6}$'),

  -- CohÃ©rence statut / dates : impossible d'avoir paid_at ET cancelled_at
  constraint reservations_status_dates_chk check (
    (status = 'PAID'             and paid_at is not null and paid_by is not null
                                  and cancelled_at is null)
    or (status = 'CANCELLED'     and cancelled_at is not null
                                  and paid_at is null and cancellation_reason is not null)
    or (status = 'PENDING_PAYMENT' and paid_at is null and cancelled_at is null)
  )
);

-- File d'attente d'encaissement : index partiel trÃ¨s sÃ©lectif
create index reservations_pending_idx
  on public.reservations (created_at) where status = 'PENDING_PAYMENT';
create index reservations_student_idx
  on public.reservations (student_id, created_at desc);
create index reservations_paid_at_idx
  on public.reservations (paid_at desc) where status = 'PAID';

-- ClÃ© composite : permet Ã  tickets de rÃ©fÃ©rencer (rÃ©servation, Ã©tudiant)
-- et donc de garantir en base que le ticket appartient bien au bon Ã©tudiant.
alter table public.reservations
  add constraint reservations_id_student_uk unique (id, student_id);

-- ---------------------------------------------------------------------
-- reservation_items : lignes de la rÃ©servation
-- unit_price est figÃ© ici -> un changement de prix n'altÃ¨re pas
-- l'historique (rÃ¨gle 3)
-- ---------------------------------------------------------------------
create table public.reservation_items (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  meal_type_id   smallint not null references public.meal_types(id) on delete restrict,
  quantity       int not null check (quantity between 1 and 99),
  unit_price     numeric(10,2) not null check (unit_price > 0),
  line_total     numeric(12,2) generated always as (quantity * unit_price) stored,
  created_at     timestamptz not null default now(),

  -- Une seule ligne par repas et par rÃ©servation (on incrÃ©mente la quantitÃ©)
  constraint reservation_items_unique_meal_uk unique (reservation_id, meal_type_id)
);

create index reservation_items_reservation_idx on public.reservation_items (reservation_id);

-- ClÃ© composite : permet Ã  tickets de vÃ©rifier (item, repas) de faÃ§on cohÃ©rente
alter table public.reservation_items
  add constraint reservation_items_id_meal_uk unique (id, meal_type_id);

-- ---------------------------------------------------------------------
-- tickets : un ticket par unitÃ© commandÃ©e (rÃ¨gle 7)
-- ---------------------------------------------------------------------
create table public.tickets (
  id                 uuid primary key default gen_random_uuid(),
  ticket_number      text not null unique,
  reservation_id     uuid not null references public.reservations(id) on delete restrict,
  reservation_item_id uuid not null,
  student_id         uuid not null,
  meal_type_id       smallint not null,
  status             public.ticket_status not null default 'GENERATED',
  qr_payload         text unique,          -- renseignÃ© par le backend (signature HMAC)
  qr_image_path      text,                 -- PNG dans Storage (optionnel)
  pdf_path           text not null,        -- PDF dans Storage
  valid_until        date,
  used_at            timestamptz,
  used_by            uuid references public.profiles(id) on delete set null,
  expired_at         timestamptz,
  created_at         timestamptz not null default now(),

  constraint tickets_number_format_chk
    check (ticket_number ~ '^TKT-[0-9]{4}-[0-9]{6}$'),

  -- Le ticket appartient forcÃ©ment Ã  l'Ã©tudiant de sa rÃ©servation
  constraint tickets_student_fk foreign key (reservation_id, student_id)
    references public.reservations (id, student_id) on delete cascade,

  -- Le repas du ticket correspond forcÃ©ment Ã  celui de sa ligne de commande
  constraint tickets_meal_fk foreign key (reservation_item_id, meal_type_id)
    references public.reservation_items (id, meal_type_id) on delete cascade,

  -- CohÃ©rence statut / dates (rÃ¨gle 6 : USED est dÃ©finitif)
  constraint tickets_status_dates_chk check (
    (status = 'USED'      and used_at is not null and used_by is not null
                            and expired_at is null)
    or (status = 'EXPIRED' and expired_at is not null and used_at is null)
    or (status = 'GENERATED' and used_at is null and expired_at is null and used_by is null)
  )
);

create index tickets_student_status_idx on public.tickets (student_id, status);
create index tickets_reservation_idx    on public.tickets (reservation_id);
create index tickets_status_idx         on public.tickets (status) where status = 'GENERATED';
-- Index de la tÃ¢che d'expiration planifiÃ©e
create index tickets_expiry_idx         on public.tickets (valid_until) where status = 'GENERATED';

-- ---------------------------------------------------------------------
-- audit_logs : journal immuable des opÃ©rations sensibles (rÃ¨gle 10)
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.profiles(id) on delete set null,
  actor_label  text,                       -- ex. 'system:cron' quand actor_id est NULL
  action       text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity_type  text,
  entity_id    text,
  outcome      text not null default 'SUCCESS' check (outcome in ('SUCCESS', 'FAILURE')),
  metadata     jsonb not null default '{}'::jsonb,
  ip           inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index audit_logs_actor_idx    on public.audit_logs (actor_id, created_at desc);
create index audit_logs_entity_idx   on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_idx  on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------
-- app_settings : signature, cachet, paramÃ¨tres (Ã©tape 8)
-- ---------------------------------------------------------------------
create table public.app_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  description text,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);


-- ==========================================================================
-- SOURCE : sql/02_functions_triggers.sql
-- ==========================================================================
-- =====================================================================
-- 02 - FONCTIONS ET TRIGGERS
-- Toutes les fonctions sont SECURITY DEFINER : les rÃ¨gles mÃ©tier sont
-- appliquÃ©es par la base, pas seulement par le backend.
-- =====================================================================

set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- Helpers d'autorisation (SECURITY DEFINER pour Ã©viter la rÃ©cursion RLS
-- sur profiles : une policy sur profiles ne doit jamais lire profiles)
-- ---------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = public, extensions as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce(public.current_user_role() in ('admin', 'logistician'), false);
$$;

grant execute on function public.current_user_role() to authenticated, service_role;
grant execute on function public.is_admin()          to authenticated, service_role;
grant execute on function public.is_staff()          to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------
create or replace function public.fn_audit(
  p_actor_id     uuid,
  p_action       text,
  p_entity_type  text default null,
  p_entity_id    text default null,
  p_metadata     jsonb default '{}'::jsonb,
  p_outcome      text default 'SUCCESS',
  p_ip           inet default null,
  p_user_agent   text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, outcome, metadata, ip, user_agent)
  values (p_actor_id, p_action, p_entity_type, p_entity_id, p_outcome,
          coalesce(p_metadata, '{}'::jsonb), p_ip, p_user_agent)
  returning id into v_id;
  return v_id;
end $$;

-- Le journal n'est JAMAIS modifiable ni supprimable (rÃ¨gle 10)
create or replace function public.fn_audit_logs_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'AUDIT_LOG_IMMUTABLE: audit_logs ne peut Ãªtre ni modifiÃ© ni supprimÃ©'
    using errcode = '23514';
end $$;

create trigger audit_logs_no_update before update on public.audit_logs
  for each row execute function public.fn_audit_logs_immutable();
create trigger audit_logs_no_delete before delete on public.audit_logs
  for each row execute function public.fn_audit_logs_immutable();

-- ---------------------------------------------------------------------
-- updated_at gÃ©nÃ©rique
-- ---------------------------------------------------------------------
create or replace function public.fn_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch_updated_at   before update on public.profiles
  for each row execute function public.fn_touch_updated_at();
create trigger reservations_touch_updated_at before update on public.reservations
  for each row execute function public.fn_touch_updated_at();

-- ---------------------------------------------------------------------
-- NumÃ©rotation automatique RES-YYYY-000001 / TKT-YYYY-000001 (rÃ¨gle 8)
-- ---------------------------------------------------------------------
create or replace function public.fn_set_reservation_number() returns trigger
language plpgsql as $$
begin
  if new.reservation_number is null or btrim(new.reservation_number) = '' then
    new.reservation_number := 'RES-' || to_char(current_date, 'YYYY') || '-'
      || lpad(nextval('public.reservation_number_seq')::text, 6, '0');
  end if;
  return new;
end $$;

create trigger reservations_set_number before insert on public.reservations
  for each row execute function public.fn_set_reservation_number();

create or replace function public.fn_set_ticket_number() returns trigger
language plpgsql as $$
begin
  if new.ticket_number is null or btrim(new.ticket_number) = '' then
    new.ticket_number := 'TKT-' || to_char(current_date, 'YYYY') || '-'
      || lpad(nextval('public.ticket_number_seq')::text, 6, '0');
  end if;
  return new;
end $$;

create trigger tickets_set_number before insert on public.tickets
  for each row execute function public.fn_set_ticket_number();

-- Remise Ã  zÃ©ro annuelle des compteurs, Ã  dÃ©clencher par une tÃ¢che planifiÃ©e
-- (Supabase cron / pg_cron) le 1er janvier.
create or replace function public.fn_reset_number_sequences() returns void
language plpgsql security definer set search_path = public as $$
begin
  if to_char(current_date, 'MM-DD') <> '01-01' then
    raise exception 'SEQUENCE_RESET_DATE: remise Ã  zÃ©ro autorisÃ©e uniquement le 1er janvier';
  end if;
  alter sequence public.reservation_number_seq restart with 1;
  alter sequence public.ticket_number_seq      restart with 1;
  perform public.fn_audit(null, 'system.sequence_reset', 'sequence', null,
                          jsonb_build_object('year', to_char(current_date, 'YYYY')));
end $$;

-- ---------------------------------------------------------------------
-- Garde-fous sur les lignes de rÃ©servation
-- ---------------------------------------------------------------------
create or replace function public.fn_guard_reservation_items() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_status public.reservation_status;
  v_student uuid;
begin
  if tg_op = 'DELETE' then
    select status, student_id into v_status, v_student
      from public.reservations where id = old.reservation_id for update;
  else
    select status, student_id into v_status, v_student
      from public.reservations where id = new.reservation_id for update;
  end if;

  if v_status is null then
    raise exception 'RESERVATION_NOT_FOUND' using errcode = '02000';
  end if;

  -- On ne modifie une rÃ©servation que tant qu'elle est en attente de paiement
  if v_status <> 'PENDING_PAYMENT' then
    raise exception 'RESERVATION_LOCKED: rÃ©servation % non modifiable (statut %)', new.reservation_id, v_status
      using errcode = '23514';
  end if;

  if public.current_user_role() = 'student' and v_student <> auth.uid() then
    raise exception 'RESERVATION_FORBIDDEN' using errcode = '42501';
  end if;

  return coalesce(new, old);
end $$;

create trigger reservation_items_guard before insert or update or delete on public.reservation_items
  for each row execute function public.fn_guard_reservation_items();

-- ---------------------------------------------------------------------
-- Le total et le nombre d'articles sont TOUJOURS recalculÃ©s depuis les
-- lignes : le montant ne peut jamais Ãªtre falsifiÃ© cÃ´tÃ© client (rÃ¨gle 2)
-- ---------------------------------------------------------------------
create or replace function public.fn_sync_reservation_totals() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_reservation_id uuid := coalesce(new.reservation_id, old.reservation_id);
  v_total numeric(12,2);
  v_count int;
begin
  select coalesce(sum(line_total), 0), coalesce(sum(quantity), 0)
    into v_total, v_count
    from public.reservation_items
   where reservation_id = v_reservation_id;

  -- LÃ¨ve la protection Â« montant immuable Â» le temps de cette mise Ã  jour interne
  perform set_config('app.sync_totals', 'on', true);

  update public.reservations
     set total_amount = v_total,
         items_count  = v_count,
         updated_at   = now()
   where id = v_reservation_id;

  perform set_config('app.sync_totals', 'off', true);
  return null;
end $$;

create trigger reservation_items_sync_totals
  after insert or update or delete on public.reservation_items
  for each row execute function public.fn_sync_reservation_totals();

-- ---------------------------------------------------------------------
-- Garde-fous sur les statuts de rÃ©servation (rÃ¨gles 4 et 5)
-- ---------------------------------------------------------------------
create or replace function public.fn_guard_reservation_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.current_user_role() = 'student' then
    if new.student_id <> auth.uid() then
      raise exception 'RESERVATION_FORBIDDEN: un Ã©tudiant ne rÃ©serve que pour lui-mÃªme'
        using errcode = '42501';
    end if;
    if new.status <> 'PENDING_PAYMENT' then
      raise exception 'RESERVATION_STATUS_FORBIDDEN: une rÃ©servation naÃ®t en PENDING_PAYMENT'
        using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create trigger reservations_guard_insert before insert on public.reservations
  for each row execute function public.fn_guard_reservation_insert();

create or replace function public.fn_guard_reservation_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role := public.current_user_role();
begin
  -- RÃ¨gle 5 : aucun retour arriÃ¨re depuis PAID
  if old.status = 'PAID' and new.status <> 'PAID' then
    raise exception 'RESERVATION_PAID_FINAL: une rÃ©servation payÃ©e est dÃ©finitive'
      using errcode = '23514';
  end if;

  -- RÃ¨gle 4 : seul le logisticien/l'admin confirme un paiement, et seulement
  -- via fn_confirm_payment (drapeau transactionnel) ou un admin explicite.
  if new.status = 'PAID' and old.status <> 'PAID'
     and coalesce(current_setting('app.payment_confirm', true), 'off') <> 'on'
     and v_role is distinct from 'admin'
  then
    raise exception 'PAYMENT_CONFIRM_FORBIDDEN: seul le logisticien ou l''administrateur confirme un paiement'
      using errcode = '42501';
  end if;

  -- Le montant et le propriÃ©taire ne changent jamais aprÃ¨s coup
  if coalesce(current_setting('app.sync_totals', true), 'off') <> 'on'
     and (new.total_amount <> old.total_amount or new.student_id <> old.student_id)
  then
    raise exception 'RESERVATION_AMOUNT_IMMUTABLE: total et Ã©tudiant sont figÃ©s'
      using errcode = '23514';
  end if;

  -- Un Ã©tudiant ne peut qu'annuler sa propre rÃ©servation encore en attente
  if v_role = 'student' then
    if new.student_id <> auth.uid() then
      raise exception 'RESERVATION_FORBIDDEN' using errcode = '42501';
    end if;
    if old.status <> 'PENDING_PAYMENT' then
      raise exception 'RESERVATION_NOT_PENDING: annulation impossible' using errcode = '23514';
    end if;
    if new.status = 'PAID' then
      raise exception 'PAYMENT_CONFIRM_FORBIDDEN: l''Ã©tudiant ne confirme jamais un paiement'
        using errcode = '42501';
    end if;
  end if;

  return new;
end $$;

create trigger reservations_guard_update before update on public.reservations
  for each row execute function public.fn_guard_reservation_update();

-- ---------------------------------------------------------------------
-- Garde-fous sur les tickets (rÃ¨gle 6)
-- ---------------------------------------------------------------------
create or replace function public.fn_guard_ticket_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Un ticket USED est dÃ©finitif
  if old.status = 'USED' then
    raise exception 'TICKET_USED_FINAL: un ticket consommÃ© est dÃ©finitif'
      using errcode = '23514';
  end if;

  -- Impossible de Â« dÃ©-expirer Â» un ticket, ni de le consommer aprÃ¨s expiration
  if old.status = 'EXPIRED' and new.status <> 'EXPIRED' then
    raise exception 'TICKET_EXPIRED_FINAL: un ticket expirÃ© ne redevient pas valide'
      using errcode = '23514';
  end if;

  -- Interdiction de consommations manuelles hors fn_consume_ticket
  if new.status = 'USED' and old.status = 'GENERATED'
     and coalesce(current_setting('app.ticket_consume', true), 'off') <> 'on'
     and public.current_user_role() is distinct from 'admin'
  then
    raise exception 'TICKET_CONSUME_FORBIDDEN: consommation uniquement via fn_consume_ticket'
      using errcode = '42501';
  end if;

  return new;
end $$;

create trigger tickets_guard_update before update on public.tickets
  for each row execute function public.fn_guard_ticket_update();

-- ---------------------------------------------------------------------
-- Protection du rÃ´le et de l'activation des comptes
-- ---------------------------------------------------------------------
create or replace function public.fn_guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
     and not public.is_admin()
  then
    raise exception 'ROLE_CHANGE_FORBIDDEN: seul un administrateur change un rÃ´le ou dÃ©sactive un compte'
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger profiles_guard_update before update on public.profiles
  for each row execute function public.fn_guard_profile_update();

-- =====================================================================
-- OPÃ‰RATIONS MÃ‰TIER ATOMIQUES
-- =====================================================================

-- ---------------------------------------------------------------------
-- fn_confirm_payment : encaissement atomique et IDEMPOTENT (rÃ¨gle 9)
-- CrÃ©e les tickets (un par unitÃ© commandÃ©e, rÃ¨gle 7) dans la mÃªme
-- transaction. Le backend complÃ¨te ensuite qr_payload / pdf_path dans
-- la mÃªme transaction : soit tout est commitÃ©, soit rien ne l'est.
-- ---------------------------------------------------------------------
create or replace function public.fn_confirm_payment(
  p_reservation_id uuid,
  p_actor_id       uuid,
  p_validity_days  int  default 30,
  p_ip             inet default null,
  p_user_agent     text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_res   public.reservations;
  v_count int;
  v_json  jsonb;
begin
  -- VÃ©rou de ligne : deux clics simultanÃ©s sont sÃ©rialisÃ©s ici
  select * into v_res from public.reservations
   where id = p_reservation_id
   for update;

  if not found then
    raise exception 'RESERVATION_NOT_FOUND' using errcode = '02000';
  end if;

  -- IDEMPOTENCE : second clic -> on renvoie l'Ã©tat existant, sans rien recrÃ©er
  if v_res.status = 'PAID' then
    select count(*) into v_count from public.tickets where reservation_id = p_reservation_id;
    return jsonb_build_object(
      'reservation_id', p_reservation_id,
      'reservation_number', v_res.reservation_number,
      'status', 'PAID',
      'already_confirmed', true,
      'ticket_count', v_count,
      'total_amount', v_res.total_amount,
      'paid_at', v_res.paid_at
    );
  end if;

  if v_res.status = 'CANCELLED' then
    raise exception 'RESERVATION_CANCELLED: une rÃ©servation annulÃ©e ne peut pas Ãªtre encaissÃ©e'
      using errcode = '23514';
  end if;

  -- Autorise la transition de statut pour CETTE transaction uniquement
  perform set_config('app.payment_confirm', 'on', true);

  update public.reservations
     set status    = 'PAID',
         paid_at   = now(),
         paid_by   = p_actor_id,
         updated_at = now()
   where id = p_reservation_id;

  -- GÃ©nÃ©ration des tickets : un par unitÃ© commandÃ©e
  insert into public.tickets (
    ticket_number, reservation_id, reservation_item_id,
    student_id, meal_type_id, status, valid_until, pdf_path
  )
  select
    'TKT-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.ticket_number_seq')::text, 6, '0'),
    r.id, ri.id, r.student_id, ri.meal_type_id, 'GENERATED',
    (current_date + make_interval(days => greatest(coalesce(p_validity_days, 30), 1))),
    ''                                   -- pdf_path renseignÃ© par le backend avant le commit
  from public.reservations r
  join public.reservation_items ri on ri.reservation_id = r.id
  cross join lateral generate_series(1, ri.quantity) g
  where r.id = p_reservation_id;

  perform set_config('app.payment_confirm', 'off', true);

  select jsonb_build_object(
           'reservation_id', p_reservation_id,
           'reservation_number', v_res.reservation_number,
           'status', 'PAID',
           'already_confirmed', false,
           'total_amount', v_res.total_amount,
           'paid_at', now(),
           'ticket_count', count(*),
           'tickets', jsonb_agg(jsonb_build_object(
             'ticket_number', t.ticket_number,
             'meal_type_id', t.meal_type_id,
             'valid_until', t.valid_until
           ) order by t.ticket_number)
         )
    into v_json
    from public.tickets t
   where t.reservation_id = p_reservation_id;

  perform public.fn_audit(p_actor_id, 'payment.confirm', 'reservation', v_res.reservation_number,
    jsonb_build_object('reservation_id', p_reservation_id,
                       'student_id', v_res.student_id,
                       'total_amount', v_res.total_amount,
                       'ticket_count', (v_json->>'ticket_count')::int),
    'SUCCESS', p_ip, p_user_agent);

  return v_json;
end $$;

-- ---------------------------------------------------------------------
-- fn_consume_ticket : scan au restaurant, atomique (rÃ¨gle 6)
-- Le backend vÃ©rifie la signature HMAC AVANT d'appeler cette fonction ;
-- la base reste le dernier verrou anti-rÃ©utilisation.
-- ---------------------------------------------------------------------
create or replace function public.fn_consume_ticket(
  p_ticket_number text,
  p_actor_id      uuid,
  p_ip            inet default null,
  p_user_agent    text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ticket public.tickets;
  v_json   jsonb;
begin
  perform set_config('app.ticket_consume', 'on', true);

  select * into v_ticket from public.tickets
   where ticket_number = p_ticket_number
   for update;

  if not found then
    perform public.fn_audit(p_actor_id, 'ticket.consume', 'ticket', p_ticket_number,
      '{}'::jsonb, 'FAILURE', p_ip, p_user_agent);
    raise exception 'TICKET_NOT_FOUND: %', p_ticket_number using errcode = '02000';
  end if;

  if v_ticket.status = 'USED' then
    perform public.fn_audit(p_actor_id, 'ticket.consume', 'ticket', p_ticket_number,
      jsonb_build_object('reason', 'already_used', 'used_at', v_ticket.used_at),
      'FAILURE', p_ip, p_user_agent);
    raise exception 'TICKET_ALREADY_USED: % dÃ©jÃ  consommÃ© le %', p_ticket_number, v_ticket.used_at
      using errcode = '23514';
  end if;

  if v_ticket.status = 'EXPIRED'
     or (v_ticket.valid_until is not null and v_ticket.valid_until < current_date)
  then
    update public.tickets
       set status = 'EXPIRED', expired_at = coalesce(expired_at, now())
     where id = v_ticket.id;
    perform public.fn_audit(p_actor_id, 'ticket.consume', 'ticket', p_ticket_number,
      jsonb_build_object('reason', 'expired', 'valid_until', v_ticket.valid_until),
      'FAILURE', p_ip, p_user_agent);
    raise exception 'TICKET_EXPIRED: %', p_ticket_number using errcode = '23514';
  end if;

  update public.tickets
     set status = 'USED', used_at = now(), used_by = p_actor_id
   where id = v_ticket.id
   returning * into v_ticket;

  perform set_config('app.ticket_consume', 'off', true);

  select jsonb_build_object(
           'ticket_number', v_ticket.ticket_number,
           'status', v_ticket.status,
           'used_at', v_ticket.used_at,
           'meal_type_id', v_ticket.meal_type_id,
           'meal_name', m.name,
           'student_id', v_ticket.student_id,
           'student_name', p.full_name,
           'student_matricule', p.matricule
         )
    into v_json
    from public.meal_types m
    join public.profiles p on p.id = v_ticket.student_id
   where m.id = v_ticket.meal_type_id;

  perform public.fn_audit(p_actor_id, 'ticket.consume', 'ticket', v_ticket.ticket_number,
    jsonb_build_object('student_id', v_ticket.student_id, 'meal_type_id', v_ticket.meal_type_id),
    'SUCCESS', p_ip, p_user_agent);

  return v_json;
end $$;

-- ---------------------------------------------------------------------
-- fn_cancel_reservation : uniquement depuis PENDING_PAYMENT
-- (hypothÃ¨se Ã©tape 1.6 : pas de remboursement aprÃ¨s PAID)
-- ---------------------------------------------------------------------
create or replace function public.fn_cancel_reservation(
  p_reservation_id uuid,
  p_actor_id       uuid,
  p_reason         text,
  p_ip             inet default null,
  p_user_agent     text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_res public.reservations;
begin
  select * into v_res from public.reservations
   where id = p_reservation_id
   for update;

  if not found then
    raise exception 'RESERVATION_NOT_FOUND' using errcode = '02000';
  end if;

  if v_res.status = 'PAID' then
    raise exception 'RESERVATION_PAID_FINAL: annulation aprÃ¨s paiement hors pÃ©rimÃ¨tre (gestion manuelle)'
      using errcode = '23514';
  end if;

  if v_res.status = 'CANCELLED' then
    return jsonb_build_object('reservation_id', p_reservation_id,
                              'status', 'CANCELLED', 'already_cancelled', true);
  end if;

  update public.reservations
     set status = 'CANCELLED',
         cancelled_at = now(),
         cancelled_by = p_actor_id,
         cancellation_reason = left(btrim(coalesce(p_reason, '')), 500),
         updated_at = now()
   where id = p_reservation_id;

  perform public.fn_audit(p_actor_id, 'reservation.cancel', 'reservation', v_res.reservation_number,
    jsonb_build_object('reservation_id', p_reservation_id, 'reason', p_reason),
    'SUCCESS', p_ip, p_user_agent);

  return jsonb_build_object('reservation_id', p_reservation_id,
                            'reservation_number', v_res.reservation_number,
                            'status', 'CANCELLED', 'already_cancelled', false);
end $$;

-- ---------------------------------------------------------------------
-- fn_expire_tickets : tÃ¢che planifiÃ©e GENERATED -> EXPIRED
-- ---------------------------------------------------------------------
create or replace function public.fn_expire_tickets(
  p_actor_label text default 'system:cron'
) returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with expired as (
    update public.tickets t
       set status = 'EXPIRED', expired_at = now()
     where t.status = 'GENERATED'
       and t.valid_until is not null
       and t.valid_until < current_date
    returning t.id, t.ticket_number, t.student_id, t.valid_until
  ), logged as (
    insert into public.audit_logs (actor_id, actor_label, action, entity_type, entity_id, metadata)
    select null, p_actor_label, 'ticket.expire', 'ticket', e.ticket_number,
           jsonb_build_object('student_id', e.student_id, 'valid_until', e.valid_until,
                              'reason', 'validity_exceeded')
      from expired e
    returning id
  )
  select count(*) into v_count from logged;

  return v_count;
end $$;

-- ---------------------------------------------------------------------
-- Droits d'exÃ©cution
-- ---------------------------------------------------------------------
grant execute on function public.fn_confirm_payment(uuid, uuid, int, inet, text) to service_role, authenticated;
grant execute on function public.fn_consume_ticket(text, uuid, inet, text)        to service_role, authenticated;
grant execute on function public.fn_cancel_reservation(uuid, uuid, text, inet, text) to service_role, authenticated;
grant execute on function public.fn_expire_tickets(text)                          to service_role;
grant execute on function public.fn_reset_number_sequences()                      to service_role;
grant execute on function public.fn_audit(uuid, text, text, text, jsonb, text, inet, text) to service_role, authenticated;

revoke execute on function public.fn_audit_logs_immutable() from public;
revoke execute on function public.fn_guard_reservation_update() from public;
revoke execute on function public.fn_guard_ticket_update() from public;


-- ==========================================================================
-- SOURCE : sql/03_rls.sql
-- ==========================================================================
-- =====================================================================
-- 03 - ROW LEVEL SECURITY
-- Principe : RLS ACTIVÃ‰ sur toutes les tables. Le backend FastAPI utilise
-- le rÃ´le service_role (BYPASSRLS) et applique ses propres permissions ;
-- la RLS protÃ¨ge l'accÃ¨s direct Ã  la base (console Supabase, clÃ© anon).
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

-- Aucune Ã©criture directe sur les tickets : ils ne naissent que d'un
-- paiement confirmÃ© (fn_confirm_payment, appelÃ© par le service_role).
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
-- connectÃ©, Ã©criture rÃ©servÃ©e Ã  l'admin
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
-- reservations : l'Ã©tudiant voit et gÃ¨re les siennes, le personnel voit tout
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

-- Le trigger fn_guard_reservation_update limite dÃ©jÃ  ce qui est possible
-- (annulation seule pour l'Ã©tudiant, jamais de passage Ã  PAID).
drop policy if exists reservations_update on public.reservations;
create policy reservations_update on public.reservations
  for update to authenticated
  using (student_id = auth.uid() or public.is_staff())
  with check (student_id = auth.uid() or public.is_staff());

-- Aucune suppression : on annule, on n'efface pas.
-- (Pas de policy DELETE.)

-- ---------------------------------------------------------------------
-- reservation_items : visibilitÃ© et Ã©criture dÃ©rivÃ©es de la rÃ©servation
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
-- tickets : lecture seule pour l'Ã©tudiant (les siens) et le personnel.
-- Toute mutation passe par fn_confirm_payment / fn_consume_ticket.
-- ---------------------------------------------------------------------
drop policy if exists tickets_select on public.tickets;
create policy tickets_select on public.tickets
  for select to authenticated
  using (student_id = auth.uid() or public.is_staff());

-- ---------------------------------------------------------------------
-- audit_logs : l'admin lit, chacun Ã©crit ses propres traces, jamais
-- de modification ni de suppression (rÃ¨gle 10)
-- ---------------------------------------------------------------------
drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using (public.is_admin());

drop policy if exists audit_logs_insert_actor on public.audit_logs;
create policy audit_logs_insert_actor on public.audit_logs
  for insert to authenticated
  with check (actor_id = auth.uid() or actor_id is null);


-- ==========================================================================
-- SOURCE : sql/04_views.sql
-- ==========================================================================
-- =====================================================================
-- 04 - VUES
-- security_invoker = true : la RLS de l'utilisateur qui interroge
-- s'applique Ã  travers la vue (un Ã©tudiant ne voit que ses lignes).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Prix en vigueur par repas
-- ---------------------------------------------------------------------
create or replace view public.v_current_prices
with (security_invoker = true) as
select
  m.id            as meal_type_id,
  m.code,
  m.name,
  m.description,
  m.display_order,
  m.is_active,
  p.id            as price_id,
  p.amount,
  p.currency,
  p.effective_from,
  p.effective_to
from public.meal_types m
left join public.meal_prices p
       on p.meal_type_id = m.id
      and p.effective_to is null
      and p.effective_from <= current_date;

comment on view public.v_current_prices is 'Prix courant de chaque repas, prÃªt Ã  Ãªtre renvoyÃ© au client';

-- ---------------------------------------------------------------------
-- File d'attente d'encaissement (Ã©cran du logisticien)
-- ---------------------------------------------------------------------
create or replace view public.v_pending_payments
with (security_invoker = true) as
select
  r.id,
  r.reservation_number,
  r.student_id,
  p.matricule,
  p.full_name       as student_name,
  p.room,
  r.items_count,
  r.total_amount,
  r.note,
  r.created_at,
  extract(epoch from (now() - r.created_at)) / 60 as waiting_minutes,
  coalesce(jsonb_agg(
      jsonb_build_object(
        'meal', mt.name,
        'quantity', ri.quantity,
        'unit_price', ri.unit_price,
        'line_total', ri.line_total
      ) order by mt.display_order
    ) filter (where ri.id is not null), '[]'::jsonb) as items
from public.reservations r
join public.profiles p     on p.id = r.student_id
left join public.reservation_items ri on ri.reservation_id = r.id
left join public.meal_types mt       on mt.id = ri.meal_type_id
where r.status = 'PENDING_PAYMENT'
group by r.id, p.matricule, p.full_name, p.room;

-- ---------------------------------------------------------------------
-- Chiffre d'affaires par jour (encaissements)
-- ---------------------------------------------------------------------
create or replace view public.v_daily_sales
with (security_invoker = true) as
select
  (r.paid_at at time zone 'Africa/Abidjan')::date as sale_date,
  count(*)                                   as reservations_paid,
  coalesce(sum(r.total_amount), 0)           as revenue,
  coalesce(sum(r.items_count), 0)            as meals_sold,
  coalesce((select count(*) from public.tickets t
             where t.status = 'USED'
               and (t.used_at at time zone 'Africa/Abidjan')::date
                   = (r.paid_at at time zone 'Africa/Abidjan')::date), 0) as tickets_used
from public.reservations r
where r.status = 'PAID'
group by 1
order by 1 desc;

-- ---------------------------------------------------------------------
-- RÃ©partition des ventes par repas
-- ---------------------------------------------------------------------
create or replace view public.v_sales_by_meal
with (security_invoker = true) as
select
  mt.id                                   as meal_type_id,
  mt.name                                 as meal,
  coalesce(sum(ri.quantity), 0)           as meals_ordered,
  coalesce(sum(ri.line_total), 0)         as revenue,
  coalesce(sum(t.used_count), 0)          as tickets_used
from public.meal_types mt
left join public.reservation_items ri on ri.meal_type_id = mt.id
left join public.reservations r       on r.id = ri.reservation_id and r.status = 'PAID'
left join (
  select meal_type_id, count(*) as used_count
    from public.tickets
   where status = 'USED'
   group by meal_type_id
) t on t.meal_type_id = mt.id
group by mt.id, mt.name
order by mt.display_order;

-- ---------------------------------------------------------------------
-- Tableau de bord par statut de ticket
-- ---------------------------------------------------------------------
create or replace view public.v_ticket_stats
with (security_invoker = true) as
select
  status,
  count(*)                                        as tickets,
  count(distinct student_id)                      as students,
  min(created_at)                                 as first_at,
  max(coalesce(used_at, expired_at))              as last_event_at
from public.tickets
group by status;

-- ---------------------------------------------------------------------
-- Consommation par Ã©tudiant (suivi mensuel)
-- ---------------------------------------------------------------------
create or replace view public.v_student_consumption
with (security_invoker = true) as
select
  p.id            as student_id,
  p.matricule,
  p.full_name,
  p.room,
  count(t.id) filter (where t.status = 'USED')      as tickets_used,
  count(t.id) filter (where t.status = 'GENERATED') as tickets_pending,
  count(t.id) filter (where t.status = 'EXPIRED')   as tickets_expired,
  coalesce(sum(r.total_amount) filter (where r.status = 'PAID'), 0) as total_spent
from public.profiles p
left join public.tickets t      on t.student_id = p.id
left join public.reservations r on r.student_id = p.id
where p.role = 'student'
group by p.id, p.matricule, p.full_name, p.room;

-- ---------------------------------------------------------------------
-- Vue matÃ©rialisÃ©e pour les rapports mensuels (rafraÃ®chie par un cron)
-- ---------------------------------------------------------------------
create materialized view if not exists public.mv_monthly_report as
select
  date_trunc('month', r.paid_at) as month,
  count(*)                       as reservations_paid,
  sum(r.total_amount)            as revenue,
  sum(r.items_count)             as meals_sold
from public.reservations r
where r.status = 'PAID'
group by 1;

create unique index if not exists mv_monthly_report_month_idx
  on public.mv_monthly_report (month);

grant select on public.mv_monthly_report to authenticated;


-- ==========================================================================
-- SOURCE : sql/05_seed.sql
-- ==========================================================================
-- =====================================================================
-- 05 - DONNÃ‰ES DE DÃ‰MARRAGE
-- Ã€ exÃ©cuter une seule fois, en base vide.
-- =====================================================================

set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- Repas
-- ---------------------------------------------------------------------
insert into public.meal_types (code, name, description, display_order) values
  ('BREAKFAST', 'Petit-dÃ©jeuner', 'Petit-dÃ©jeuner universitaire', 1),
  ('LUNCH',     'DÃ©jeuner',      'DÃ©jeuner universitaire',      2),
  ('DINNER',    'DÃ®ner',         'DÃ®ner universitaire',         3)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Prix initiaux
-- ATTENTION : montants Ã  confirmer avec le service de restauration.
-- ---------------------------------------------------------------------
-- Le prix rÃ©fÃ©rence est renseignÃ© par l'administrateur depuis l'interface
-- (Ã©cran Â« Tarifs Â» de l'Ã©tape 7). Pour un dÃ©marrage Ã  blanc, dÃ©commentez :
--
-- insert into public.meal_prices (meal_type_id, amount, created_by)
-- select m.id, 200.00, (select id from public.profiles where role = 'admin' limit 1)
--   from public.meal_types m
--  on conflict do nothing;

-- ---------------------------------------------------------------------
-- ParamÃ¨tres de l'application
-- ---------------------------------------------------------------------
insert into public.app_settings (key, value, description) values
  ('resto.identity', jsonb_build_object(
      'name', 'Restauration universitaire',
      'city', '',
      'phone', ''
   ), 'IdentitÃ© affichÃ©e sur les tickets PDF'),

  ('tickets.validity_days', '30'::jsonb,
   'Nombre de jours de validitÃ© d''un ticket aprÃ¨s paiement (hypothÃ¨se Ã©tape 1.6)'),

  ('tickets.pdf_template', jsonb_build_object(
      'page', 'A5',
      'orientation', 'portrait',
      'per_page', 4
   ), 'Mise en page du PDF gÃ©nÃ©rÃ©'),

  ('signature.image_path', 'null'::jsonb,
   'Chemin Supabase Storage de l''image de signature (Ã©tape 8)'),

  ('cachet.image_path', 'null'::jsonb,
   'Chemin Supabase Storage de l''image du cachet (Ã©tape 8)'),

  ('reservation.max_items_per_reservation', '10'::jsonb,
   'Nombre maximal de lignes de repas diffÃ©rentes par rÃ©servation'),

  ('reservation.max_quantity_per_item', '99'::jsonb,
   'QuantitÃ© maximale par repas et par rÃ©servation'),

  ('qr.secret_version', '1'::jsonb,
   'Version de la clÃ© HMAC utilisÃ©e pour signer les QR (rotation des clÃ©s, Ã©tape 8)')
on conflict (key) do nothing;


-- ==========================================================================
-- SOURCE : sql/06_storage.sql
-- ==========================================================================
-- =====================================================================
-- 06 - STOCKAGE (Supabase Storage)
-- Bucket privÃ© Â« tickets Â» :
--   images/   signature.png, cachet.png        (Ã©crits par l'admin)
--   pdf/      {student_id}/{ticket_number}.pdf (Ã©crits par le backend)
-- Le bucket est PRIVÃ‰ : les PDF passent par une URL signÃ©e Ã  durÃ©e
-- de vie courte, ou par un flux proxy du backend (Ã©tape 8).
-- =====================================================================

-- `DO UPDATE SET` et non `DO NOTHING SET` : les deux formes sont
-- exclusives, et la seconde est une erreur de syntaxe.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tickets', 'tickets', false, 10485760,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = false;

-- ---------------------------------------------------------------------
-- Lecture : l'Ã©tudiant lit ses propres fichiers, le personnel lit tout
-- (owner = uuid de l'Ã©tudiant, renseignÃ© par le backend Ã  l'upload)
-- ---------------------------------------------------------------------
drop policy if exists tickets_storage_select on storage.objects;
create policy tickets_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'tickets'
    and (owner = auth.uid() or public.is_staff())
  );

-- ---------------------------------------------------------------------
-- Ã‰criture : rÃ©servÃ©e au personnel connectÃ© (l'admin dÃ©pose la signature
-- et le cachet). Le backend, lui, Ã©crit avec le rÃ´le service_role.
-- ---------------------------------------------------------------------
drop policy if exists tickets_storage_write_staff on storage.objects;
create policy tickets_storage_write_staff on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tickets' and public.is_staff());

drop policy if exists tickets_storage_update_staff on storage.objects;
create policy tickets_storage_update_staff on storage.objects
  for update to authenticated
  using (bucket_id = 'tickets' and public.is_staff())
  with check (bucket_id = 'tickets' and public.is_staff());

drop policy if exists tickets_storage_delete_admin on storage.objects;
create policy tickets_storage_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'tickets' and public.is_admin());

-- ---------------------------------------------------------------------
-- TÃ¢che planifiÃ©e : expiration quotidienne des tickets pÃ©rimÃ©s
-- Supabase : Database -> Cron (pg_cron) ou Edge Function planifiÃ©e
--   select cron.schedule('expire-tickets', '5 0 * * *',
--     $$select public.fn_expire_tickets('system:cron')$$);
-- Et au 1er janvier :
--   select cron.schedule('reset-sequences', '0 0 1 1 *',
--     $$select public.fn_reset_number_sequences()$$);
-- ---------------------------------------------------------------------

