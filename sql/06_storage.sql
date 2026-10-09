-- =====================================================================
-- 06 - STOCKAGE (Supabase Storage)
-- Bucket privé « tickets » :
--   images/   signature.png, cachet.png        (écrits par l'admin)
--   pdf/      {student_id}/{ticket_number}.pdf (écrits par le backend)
-- Le bucket est PRIVÉ : les PDF passent par une URL signée à durée
-- de vie courte, ou par un flux proxy du backend (étape 8).
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
-- Lecture : l'étudiant lit ses propres fichiers, le personnel lit tout
-- (owner = uuid de l'étudiant, renseigné par le backend à l'upload)
-- ---------------------------------------------------------------------
drop policy if exists tickets_storage_select on storage.objects;
create policy tickets_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'tickets'
    and (owner = auth.uid() or public.is_staff())
  );

-- ---------------------------------------------------------------------
-- Écriture : réservée au personnel connecté (l'admin dépose la signature
-- et le cachet). Le backend, lui, écrit avec le rôle service_role.
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
-- Tâche planifiée : expiration quotidienne des tickets périmés
-- Supabase : Database -> Cron (pg_cron) ou Edge Function planifiée
--   select cron.schedule('expire-tickets', '5 0 * * *',
--     $$select public.fn_expire_tickets('system:cron')$$);
-- Et au 1er janvier :
--   select cron.schedule('reset-sequences', '0 0 1 1 *',
--     $$select public.fn_reset_number_sequences()$$);
-- ---------------------------------------------------------------------
