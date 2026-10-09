-- =====================================================================
-- 05 - DONNÉES DE DÉMARRAGE
-- À exécuter une seule fois, en base vide.
-- =====================================================================

set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- Repas
-- ---------------------------------------------------------------------
insert into public.meal_types (code, name, description, display_order) values
  ('BREAKFAST', 'Petit-déjeuner', 'Petit-déjeuner universitaire', 1),
  ('LUNCH',     'Déjeuner',      'Déjeuner universitaire',      2),
  ('DINNER',    'Dîner',         'Dîner universitaire',         3)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Prix initiaux
-- ATTENTION : montants à confirmer avec le service de restauration.
-- ---------------------------------------------------------------------
-- Le prix référence est renseigné par l'administrateur depuis l'interface
-- (écran « Tarifs » de l'étape 7). Pour un démarrage à blanc, décommentez :
--
-- insert into public.meal_prices (meal_type_id, amount, created_by)
-- select m.id, 200.00, (select id from public.profiles where role = 'admin' limit 1)
--   from public.meal_types m
--  on conflict do nothing;

-- ---------------------------------------------------------------------
-- Paramètres de l'application
-- ---------------------------------------------------------------------
insert into public.app_settings (key, value, description) values
  ('resto.identity', jsonb_build_object(
      'name', 'Restauration universitaire',
      'city', '',
      'phone', ''
   ), 'Identité affichée sur les tickets PDF'),

  ('tickets.validity_days', '30'::jsonb,
   'Nombre de jours de validité d''un ticket après paiement (hypothèse étape 1.6)'),

  ('tickets.pdf_template', jsonb_build_object(
      'page', 'A5',
      'orientation', 'portrait',
      'per_page', 4
   ), 'Mise en page du PDF généré'),

  ('signature.image_path', 'null'::jsonb,
   'Chemin Supabase Storage de l''image de signature (étape 8)'),

  ('cachet.image_path', 'null'::jsonb,
   'Chemin Supabase Storage de l''image du cachet (étape 8)'),

  ('reservation.max_items_per_reservation', '10'::jsonb,
   'Nombre maximal de lignes de repas différentes par réservation'),

  ('reservation.max_quantity_per_item', '99'::jsonb,
   'Quantité maximale par repas et par réservation'),

  ('qr.secret_version', '1'::jsonb,
   'Version de la clé HMAC utilisée pour signer les QR (rotation des clés, étape 8)')
on conflict (key) do nothing;
