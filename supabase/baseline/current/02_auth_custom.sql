-- ANGROLINK staging baseline: customizações mínimas de Auth, confirmadas
-- no dump estrutural remoto de 2026-08-31.
-- Não contém auth.users, identities, sessões, tokens nem credenciais.
-- Aplicar APÓS 01_public_schema.sql numa instância Supabase nova.

-- As funções já são reproduzidas por 01_public_schema.sql. Estes triggers
-- ligam-nas à tabela nativa auth.users do novo projeto.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();
