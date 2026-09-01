-- ANGROLINK staging baseline: configuração de Storage confirmada no dump
-- estrutural remoto de 2026-08-31.
-- Não contém storage.objects nem ficheiros. Aplicar após a infraestrutura
-- nativa de Storage existir no novo projeto Supabase.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('produtos', 'produtos', true, null, null),
  ('vendedores', 'vendedores', true, null, null),
  ('clientes', 'clientes', true, null, null),
  ('documentos-parceiros', 'documentos-parceiros', false, null, null),
  ('documentos-vendedores', 'documentos-vendedores', false, null, null)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Permitir leitura publica produtos" on storage.objects;
create policy "Permitir leitura publica produtos" on storage.objects
  for select using (bucket_id = 'produtos');

-- Produtos: escrita apenas no namespace pertencente ao utilizador autenticado.
-- Não existe política de upload público ampla.
drop policy if exists "Permitir upload publico produtos" on storage.objects;
drop policy if exists "produtos_atualizar_proprio" on storage.objects;
create policy "produtos_atualizar_proprio" on storage.objects
  for update to authenticated
  using (bucket_id = 'produtos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'produtos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "produtos_eliminar_proprio" on storage.objects;
create policy "produtos_eliminar_proprio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'produtos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "produtos_upload_proprio" on storage.objects;
create policy "produtos_upload_proprio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'produtos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "clientes_foto_atualizar_proprio" on storage.objects;
create policy "clientes_foto_atualizar_proprio" on storage.objects
  for update to authenticated
  using (bucket_id = 'clientes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'clientes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "clientes_foto_eliminar_proprio" on storage.objects;
create policy "clientes_foto_eliminar_proprio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'clientes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "clientes_foto_leitura_publica" on storage.objects;
create policy "clientes_foto_leitura_publica" on storage.objects
  for select using (bucket_id = 'clientes');

drop policy if exists "clientes_foto_upload_proprio" on storage.objects;
create policy "clientes_foto_upload_proprio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'clientes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "documentos_parceiros_atualizar_proprio" on storage.objects;
create policy "documentos_parceiros_atualizar_proprio" on storage.objects
  for update to authenticated
  using (bucket_id = 'documentos-parceiros' and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin()))
  with check (bucket_id = 'documentos-parceiros' and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin()));

drop policy if exists "documentos_parceiros_eliminar_proprio" on storage.objects;
create policy "documentos_parceiros_eliminar_proprio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos-parceiros' and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin()));

drop policy if exists "documentos_parceiros_leitura_propria_admin" on storage.objects;
create policy "documentos_parceiros_leitura_propria_admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos-parceiros' and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin()));

drop policy if exists "documentos_parceiros_upload_proprio" on storage.objects;
create policy "documentos_parceiros_upload_proprio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos-parceiros' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "documentos_vendedores_leitura_propria_admin" on storage.objects;
create policy "documentos_vendedores_leitura_propria_admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos-vendedores' and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin()));

drop policy if exists "documentos_vendedores_upload_proprio" on storage.objects;
create policy "documentos_vendedores_upload_proprio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos-vendedores' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "vendedores_foto_atualizar_proprio" on storage.objects;
create policy "vendedores_foto_atualizar_proprio" on storage.objects
  for update to authenticated
  using (bucket_id = 'vendedores' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'vendedores' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "vendedores_foto_eliminar_proprio" on storage.objects;
create policy "vendedores_foto_eliminar_proprio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vendedores' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "vendedores_foto_leitura_publica" on storage.objects;
create policy "vendedores_foto_leitura_publica" on storage.objects
  for select using (bucket_id = 'vendedores');

drop policy if exists "vendedores_foto_upload_proprio" on storage.objects;
create policy "vendedores_foto_upload_proprio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vendedores' and (storage.foldername(name))[1] = auth.uid()::text);
