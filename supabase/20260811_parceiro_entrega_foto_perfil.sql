-- ANGROLINK — adiciona suporte a foto de perfil para parceiros de entrega.
-- Use esta migração se ainda não existir a coluna foto_perfil_url.

begin;

alter table public.parceiros_entrega
  add column if not exists foto_perfil_url text;

commit;
