-- ANGROLINK — ownership por auth.uid() nas fotografias públicas de vendedor e cliente.
-- Os buckets permanecem públicos para leitura; escrita é limitada à pasta do dono.

begin;

drop policy if exists "Permitir upload publico para vendedores" on storage.objects;
drop policy if exists "Permitir leitura publica de vendedores" on storage.objects;
drop policy if exists "Permitir atualizar imagens de vendedores" on storage.objects;
drop policy if exists "Permitir apagar imagens de vendedores" on storage.objects;

create policy vendedores_foto_upload_proprio
on storage.objects for insert to authenticated
with check (
  bucket_id = 'vendedores'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy vendedores_foto_leitura_publica
on storage.objects for select to public
using (bucket_id = 'vendedores');

create policy vendedores_foto_atualizar_proprio
on storage.objects for update to authenticated
using (
  bucket_id = 'vendedores'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'vendedores'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy vendedores_foto_eliminar_proprio
on storage.objects for delete to authenticated
using (
  bucket_id = 'vendedores'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Clientes podem fazer upload da propria foto" on storage.objects;
drop policy if exists "Fotos clientes publicas" on storage.objects;
drop policy if exists "Clientes podem atualizar a propria foto" on storage.objects;
drop policy if exists "Clientes podem apagar a propria foto" on storage.objects;

create policy clientes_foto_upload_proprio
on storage.objects for insert to authenticated
with check (
  bucket_id = 'clientes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy clientes_foto_leitura_publica
on storage.objects for select to public
using (bucket_id = 'clientes');

create policy clientes_foto_atualizar_proprio
on storage.objects for update to authenticated
using (
  bucket_id = 'clientes'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'clientes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy clientes_foto_eliminar_proprio
on storage.objects for delete to authenticated
using (
  bucket_id = 'clientes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;
