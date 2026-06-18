-- ============================================================
-- Storage : bucket privé pour les documents (PDF)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;

create policy "org members read own docs" on storage.objects for select
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth_org_id()::text);

create policy "org members upload own docs" on storage.objects for insert
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth_org_id()::text);

create policy "org members delete own docs" on storage.objects for delete
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth_org_id()::text);

-- ============================================================
-- Realtime : visites de groupe (broadcast + presence via channels,
-- aucune table à exposer — on autorise simplement les messages)
-- ============================================================
-- Les channels Supabase Realtime "group:{code}" sont utilisés en mode
-- broadcast/presence côté client : aucune configuration SQL requise.
