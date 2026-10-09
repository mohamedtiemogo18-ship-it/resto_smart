-- =====================================================================
-- 01 - TABLES
-- Ordre de création respectant les dépendances de clés étrangères.
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles : extension de auth.users, porte le rôle applicatif
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

  -- Un étudiant doit avoir un matricule ET une chambre (règle métier étape 1.6)
  constraint profiles_student_fields_chk
    check (role <> 'student' or (matricule is not null and room is not null)),

  -- Format du matricule, seulement s'il est renseigné
  constraint profiles_matricule_format_chk
    check (matricule is null or matricule ~ '^[A-Z0-9][A-Z0-9/-]{3,19}$'),

  -- Le personnel n'a pas de matricule étudiant
  constraint profiles_staff_no_matricule_chk
    check (role = 'student' or matricule is null)
);

create index profiles_role_idx on public.profiles (role) where is_active;
create index profiles_matricule_idx on public.profiles (matricule) where matricule is not null;

-- ---------------------------------------------------------------------
-- meal_types : les repas vendables (petit-déjeuner, déjeuner, dîner)
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
-- meal_prices : historique des prix (règle 2 : le prix vient de la base)
-- Périodes de validité non chevauchantes garanties par exclusion contrainte.
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

  -- Deux prix pour un même repas ne peuvent pas se chevaucher dans le temps
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

  -- Cohérence statut / dates : impossible d'avoir paid_at ET cancelled_at
  constraint reservations_status_dates_chk check (
    (status = 'PAID'             and paid_at is not null and paid_by is not null
                                  and cancelled_at is null)
    or (status = 'CANCELLED'     and cancelled_at is not null
                                  and paid_at is null and cancellation_reason is not null)
    or (status = 'PENDING_PAYMENT' and paid_at is null and cancelled_at is null)
  )
);

-- File d'attente d'encaissement : index partiel très sélectif
create index reservations_pending_idx
  on public.reservations (created_at) where status = 'PENDING_PAYMENT';
create index reservations_student_idx
  on public.reservations (student_id, created_at desc);
create index reservations_paid_at_idx
  on public.reservations (paid_at desc) where status = 'PAID';

-- Clé composite : permet à tickets de référencer (réservation, étudiant)
-- et donc de garantir en base que le ticket appartient bien au bon étudiant.
alter table public.reservations
  add constraint reservations_id_student_uk unique (id, student_id);

-- ---------------------------------------------------------------------
-- reservation_items : lignes de la réservation
-- unit_price est figé ici -> un changement de prix n'altère pas
-- l'historique (règle 3)
-- ---------------------------------------------------------------------
create table public.reservation_items (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  meal_type_id   smallint not null references public.meal_types(id) on delete restrict,
  quantity       int not null check (quantity between 1 and 99),
  unit_price     numeric(10,2) not null check (unit_price > 0),
  line_total     numeric(12,2) generated always as (quantity * unit_price) stored,
  created_at     timestamptz not null default now(),

  -- Une seule ligne par repas et par réservation (on incrémente la quantité)
  constraint reservation_items_unique_meal_uk unique (reservation_id, meal_type_id)
);

create index reservation_items_reservation_idx on public.reservation_items (reservation_id);

-- Clé composite : permet à tickets de vérifier (item, repas) de façon cohérente
alter table public.reservation_items
  add constraint reservation_items_id_meal_uk unique (id, meal_type_id);

-- ---------------------------------------------------------------------
-- tickets : un ticket par unité commandée (règle 7)
-- ---------------------------------------------------------------------
create table public.tickets (
  id                 uuid primary key default gen_random_uuid(),
  ticket_number      text not null unique,
  reservation_id     uuid not null references public.reservations(id) on delete restrict,
  reservation_item_id uuid not null,
  student_id         uuid not null,
  meal_type_id       smallint not null,
  status             public.ticket_status not null default 'GENERATED',
  qr_payload         text unique,          -- renseigné par le backend (signature HMAC)
  qr_image_path      text,                 -- PNG dans Storage (optionnel)
  pdf_path           text not null,        -- PDF dans Storage
  valid_until        date,
  used_at            timestamptz,
  used_by            uuid references public.profiles(id) on delete set null,
  expired_at         timestamptz,
  created_at         timestamptz not null default now(),

  constraint tickets_number_format_chk
    check (ticket_number ~ '^TKT-[0-9]{4}-[0-9]{6}$'),

  -- Le ticket appartient forcément à l'étudiant de sa réservation
  constraint tickets_student_fk foreign key (reservation_id, student_id)
    references public.reservations (id, student_id) on delete cascade,

  -- Le repas du ticket correspond forcément à celui de sa ligne de commande
  constraint tickets_meal_fk foreign key (reservation_item_id, meal_type_id)
    references public.reservation_items (id, meal_type_id) on delete cascade,

  -- Cohérence statut / dates (règle 6 : USED est définitif)
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
-- Index de la tâche d'expiration planifiée
create index tickets_expiry_idx         on public.tickets (valid_until) where status = 'GENERATED';

-- ---------------------------------------------------------------------
-- audit_logs : journal immuable des opérations sensibles (règle 10)
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
-- app_settings : signature, cachet, paramètres (étape 8)
-- ---------------------------------------------------------------------
create table public.app_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  description text,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);
