-- =====================================================================
-- 04 - VUES
-- security_invoker = true : la RLS de l'utilisateur qui interroge
-- s'applique à travers la vue (un étudiant ne voit que ses lignes).
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

comment on view public.v_current_prices is 'Prix courant de chaque repas, prêt à être renvoyé au client';

-- ---------------------------------------------------------------------
-- File d'attente d'encaissement (écran du logisticien)
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
-- Les encaissements et les consommations sont agrégés séparément puis
-- joints par date. Une sous-requête corrélée référençant r.paid_at serait
-- rejetée : cette colonne n'est pas dans le GROUP BY (erreur 42803).
create or replace view public.v_daily_sales
with (security_invoker = true) as
with paid as (
  select (r.paid_at at time zone 'Africa/Abidjan')::date as sale_date,
         count(*)                    as reservations_paid,
         coalesce(sum(r.total_amount), 0) as revenue,
         coalesce(sum(r.items_count), 0)  as meals_sold
    from public.reservations r
   where r.status = 'PAID'
   group by 1
), used as (
  select (t.used_at at time zone 'Africa/Abidjan')::date as sale_date,
         count(*) as tickets_used
    from public.tickets t
   where t.status = 'USED'
   group by 1
)
select
  p.sale_date,
  p.reservations_paid,
  p.revenue,
  p.meals_sold,
  coalesce(u.tickets_used, 0) as tickets_used
from paid p
left join used u on u.sale_date = p.sale_date
order by p.sale_date desc;

-- ---------------------------------------------------------------------
-- Répartition des ventes par repas
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
-- `t.used_count` doit être dans le GROUP BY : `t` est une sous-requête,
-- donc aucune dépendance fonctionnelle ne s'applique (contrairement à
-- mt.id, clé primaire de meal_types, qui couvre mt.name et mt.display_order).
group by mt.id, mt.name, mt.display_order, t.used_count
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
-- Consommation par étudiant (suivi mensuel)
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
-- Vue matérialisée pour les rapports mensuels (rafraîchie par un cron)
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
