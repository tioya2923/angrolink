-- Permite que o trigger de auth.users crie perfis técnicos de parceiros
-- sem os transformar em clientes.

begin;

do $$
declare
  restricao record;
begin
  for restricao in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'profiles'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%papel%'
  loop
    execute format('alter table public.profiles drop constraint %I', restricao.conname);
  end loop;
end;
$$;

alter table public.profiles
  add constraint profiles_papel_check
  check (papel in ('cliente', 'vendedor', 'admin', 'parceiro_entrega'));

-- Corrige perfis já criados como cliente antes desta regra existir.
update public.profiles perfil
set papel = 'parceiro_entrega',
    atualizado_em = now()
from public.parceiros_entrega parceiro
where parceiro.user_id = perfil.id
  and perfil.papel = 'cliente';

commit;
