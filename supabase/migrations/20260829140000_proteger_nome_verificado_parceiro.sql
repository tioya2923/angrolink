begin;

-- A aprovação fixa o nome legal do parceiro para utilizadores não
-- administrativos. O restante perfil continua atualizável pelo próprio dono.
create or replace function public.proteger_nome_verificado_parceiro_entrega()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.aprovado_em is not null
    and new.nome_completo is distinct from old.nome_completo
    and not public.eh_admin() then
    raise exception 'O nome verificado não pode ser alterado. Contacte o Apoio ANGROLINK.';
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_nome_verificado_parceiro_entrega
  on public.parceiros_entrega;

create trigger proteger_nome_verificado_parceiro_entrega
before update of nome_completo on public.parceiros_entrega
for each row
execute function public.proteger_nome_verificado_parceiro_entrega();

revoke all on function public.proteger_nome_verificado_parceiro_entrega()
  from public, anon, authenticated;

commit;
