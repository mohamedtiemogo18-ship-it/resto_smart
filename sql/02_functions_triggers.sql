-- =====================================================================
-- 02 - FONCTIONS ET TRIGGERS
-- Toutes les fonctions sont SECURITY DEFINER : les règles métier sont
-- appliquées par la base, pas seulement par le backend.
-- =====================================================================

set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- Helpers d'autorisation (SECURITY DEFINER pour éviter la récursion RLS
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

-- Le journal n'est JAMAIS modifiable ni supprimable (règle 10)
create or replace function public.fn_audit_logs_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'AUDIT_LOG_IMMUTABLE: audit_logs ne peut être ni modifié ni supprimé'
    using errcode = '23514';
end $$;

create trigger audit_logs_no_update before update on public.audit_logs
  for each row execute function public.fn_audit_logs_immutable();
create trigger audit_logs_no_delete before delete on public.audit_logs
  for each row execute function public.fn_audit_logs_immutable();

-- ---------------------------------------------------------------------
-- updated_at générique
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
-- Numérotation automatique RES-YYYY-000001 / TKT-YYYY-000001 (règle 8)
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

-- Remise à zéro annuelle des compteurs, à déclencher par une tâche planifiée
-- (Supabase cron / pg_cron) le 1er janvier.
create or replace function public.fn_reset_number_sequences() returns void
language plpgsql security definer set search_path = public as $$
begin
  if to_char(current_date, 'MM-DD') <> '01-01' then
    raise exception 'SEQUENCE_RESET_DATE: remise à zéro autorisée uniquement le 1er janvier';
  end if;
  alter sequence public.reservation_number_seq restart with 1;
  alter sequence public.ticket_number_seq      restart with 1;
  perform public.fn_audit(null, 'system.sequence_reset', 'sequence', null,
                          jsonb_build_object('year', to_char(current_date, 'YYYY')));
end $$;

-- ---------------------------------------------------------------------
-- Garde-fous sur les lignes de réservation
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

  -- On ne modifie une réservation que tant qu'elle est en attente de paiement
  if v_status <> 'PENDING_PAYMENT' then
    raise exception 'RESERVATION_LOCKED: réservation % non modifiable (statut %)', new.reservation_id, v_status
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
-- Le total et le nombre d'articles sont TOUJOURS recalculés depuis les
-- lignes : le montant ne peut jamais être falsifié côté client (règle 2)
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

  -- Lève la protection « montant immuable » le temps de cette mise à jour interne
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
-- Garde-fous sur les statuts de réservation (règles 4 et 5)
-- ---------------------------------------------------------------------
create or replace function public.fn_guard_reservation_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.current_user_role() = 'student' then
    if new.student_id <> auth.uid() then
      raise exception 'RESERVATION_FORBIDDEN: un étudiant ne réserve que pour lui-même'
        using errcode = '42501';
    end if;
    if new.status <> 'PENDING_PAYMENT' then
      raise exception 'RESERVATION_STATUS_FORBIDDEN: une réservation naît en PENDING_PAYMENT'
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
  -- Règle 5 : aucun retour arrière depuis PAID
  if old.status = 'PAID' and new.status <> 'PAID' then
    raise exception 'RESERVATION_PAID_FINAL: une réservation payée est définitive'
      using errcode = '23514';
  end if;

  -- Règle 4 : seul le logisticien/l'admin confirme un paiement, et seulement
  -- via fn_confirm_payment (drapeau transactionnel) ou un admin explicite.
  if new.status = 'PAID' and old.status <> 'PAID'
     and coalesce(current_setting('app.payment_confirm', true), 'off') <> 'on'
     and v_role is distinct from 'admin'
  then
    raise exception 'PAYMENT_CONFIRM_FORBIDDEN: seul le logisticien ou l''administrateur confirme un paiement'
      using errcode = '42501';
  end if;

  -- Le montant et le propriétaire ne changent jamais après coup
  if coalesce(current_setting('app.sync_totals', true), 'off') <> 'on'
     and (new.total_amount <> old.total_amount or new.student_id <> old.student_id)
  then
    raise exception 'RESERVATION_AMOUNT_IMMUTABLE: total et étudiant sont figés'
      using errcode = '23514';
  end if;

  -- Un étudiant ne peut qu'annuler sa propre réservation encore en attente
  if v_role = 'student' then
    if new.student_id <> auth.uid() then
      raise exception 'RESERVATION_FORBIDDEN' using errcode = '42501';
    end if;
    if old.status <> 'PENDING_PAYMENT' then
      raise exception 'RESERVATION_NOT_PENDING: annulation impossible' using errcode = '23514';
    end if;
    if new.status = 'PAID' then
      raise exception 'PAYMENT_CONFIRM_FORBIDDEN: l''étudiant ne confirme jamais un paiement'
        using errcode = '42501';
    end if;
  end if;

  return new;
end $$;

create trigger reservations_guard_update before update on public.reservations
  for each row execute function public.fn_guard_reservation_update();

-- ---------------------------------------------------------------------
-- Garde-fous sur les tickets (règle 6)
-- ---------------------------------------------------------------------
create or replace function public.fn_guard_ticket_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Un ticket USED est définitif
  if old.status = 'USED' then
    raise exception 'TICKET_USED_FINAL: un ticket consommé est définitif'
      using errcode = '23514';
  end if;

  -- Impossible de « dé-expirer » un ticket, ni de le consommer après expiration
  if old.status = 'EXPIRED' and new.status <> 'EXPIRED' then
    raise exception 'TICKET_EXPIRED_FINAL: un ticket expiré ne redevient pas valide'
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
-- Protection du rôle et de l'activation des comptes
-- ---------------------------------------------------------------------
create or replace function public.fn_guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
     and not public.is_admin()
  then
    raise exception 'ROLE_CHANGE_FORBIDDEN: seul un administrateur change un rôle ou désactive un compte'
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger profiles_guard_update before update on public.profiles
  for each row execute function public.fn_guard_profile_update();

-- =====================================================================
-- OPÉRATIONS MÉTIER ATOMIQUES
-- =====================================================================

-- ---------------------------------------------------------------------
-- fn_confirm_payment : encaissement atomique et IDEMPOTENT (règle 9)
-- Crée les tickets (un par unité commandée, règle 7) dans la même
-- transaction. Le backend complète ensuite qr_payload / pdf_path dans
-- la même transaction : soit tout est commité, soit rien ne l'est.
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
  -- Vérou de ligne : deux clics simultanés sont sérialisés ici
  select * into v_res from public.reservations
   where id = p_reservation_id
   for update;

  if not found then
    raise exception 'RESERVATION_NOT_FOUND' using errcode = '02000';
  end if;

  -- IDEMPOTENCE : second clic -> on renvoie l'état existant, sans rien recréer
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
    raise exception 'RESERVATION_CANCELLED: une réservation annulée ne peut pas être encaissée'
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

  -- Génération des tickets : un par unité commandée
  insert into public.tickets (
    ticket_number, reservation_id, reservation_item_id,
    student_id, meal_type_id, status, valid_until, pdf_path
  )
  select
    'TKT-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.ticket_number_seq')::text, 6, '0'),
    r.id, ri.id, r.student_id, ri.meal_type_id, 'GENERATED',
    (current_date + make_interval(days => greatest(coalesce(p_validity_days, 30), 1))),
    ''                                   -- pdf_path renseigné par le backend avant le commit
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
-- fn_consume_ticket : scan au restaurant, atomique (règle 6)
-- Le backend vérifie la signature HMAC AVANT d'appeler cette fonction ;
-- la base reste le dernier verrou anti-réutilisation.
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
    raise exception 'TICKET_ALREADY_USED: % déjà consommé le %', p_ticket_number, v_ticket.used_at
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
-- (hypothèse étape 1.6 : pas de remboursement après PAID)
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
    raise exception 'RESERVATION_PAID_FINAL: annulation après paiement hors périmètre (gestion manuelle)'
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
-- fn_expire_tickets : tâche planifiée GENERATED -> EXPIRED
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
-- Droits d'exécution
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
