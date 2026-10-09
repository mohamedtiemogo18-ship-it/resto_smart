create schema if not exists extensions;

create extension if not exists "pgcrypto"     with schema extensions;
create extension if not exists "btree_gist"  with schema extensions;

-- =====================================================================
-- TYPES ÉNUMÉRÉS
-- =====================================================================

-- Rôles applicatifs (le rôle vit dans profiles, PAS dans auth.users)
create type public.user_role as enum ('student', 'logistician', 'admin');

-- Machine à états réservation : PENDING_PAYMENT -> PAID | CANCELLED
-- Aucun retour arrière possible depuis PAID (règle 5)
create type public.reservation_status as enum ('PENDING_PAYMENT', 'PAID', 'CANCELLED');

-- Machine à états ticket : GENERATED -> USED | EXPIRED
-- USED est définitif (règle 6)
create type public.ticket_status as enum ('GENERATED', 'USED', 'EXPIRED');

-- Créneaux de repas
create type public.meal_slot as enum ('BREAKFAST', 'LUNCH', 'DINNER');

-- =====================================================================
-- SÉQUENCES DE NUMÉROTATION
-- RES-YYYY-000001 / TKT-YYYY-000001 (règle 8)
-- nextval() est atomique et non transactionnel : aucun doublon possible,
-- même en cas de rollback (pas de « trou » réutilisé, ce qui est voulu).
-- =====================================================================

create sequence public.reservation_number_seq as bigint start with 1 increment by 1 minvalue 1 no maxvalue cache 1;
create sequence public.ticket_number_seq      as bigint start with 1 increment by 1 minvalue 1 no maxvalue cache 1;

comment on sequence public.reservation_number_seq is 'Remise à 1 au 1er janvier via fn_reset_number_sequences()';
comment on sequence public.ticket_number_seq      is 'Remise à 1 au 1er janvier via fn_reset_number_sequences()';
