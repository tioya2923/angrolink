-- Correção imediata do erro: record "old" has no field "estado".
-- Pode ser executado isoladamente no SQL Editor do Supabase.

begin;

create or replace function public.proteger_estado_parceiro_entrega()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name <> 'parceiros_entrega' then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and current_setting('angrolink.submeter_parceiro', true) = 'true'
    and old.estado in ('rascunho', 'documentos_pendentes', 'rejeitado')
    and new.estado = 'em_analise'
    and new.disponibilidade = false then
    return new;
  end if;

  if not public.eh_admin() then
    if tg_op = 'INSERT' and (new.estado <> 'rascunho' or new.disponibilidade) then
      raise exception 'O parceiro não pode aprovar-se ou ficar disponível no cadastro';
    end if;

    if tg_op = 'UPDATE' and (
      new.user_id is distinct from old.user_id or
      new.estado is distinct from old.estado or
      new.motivo_rejeicao is distinct from old.motivo_rejeicao or
      new.motivo_suspensao is distinct from old.motivo_suspensao or
      new.aprovado_em is distinct from old.aprovado_em
    ) then
      raise exception 'O estado administrativo do parceiro só pode ser alterado por administrador';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_estado_parceiro_entrega on public.parceiros_entrega;
drop trigger if exists proteger_estado_parceiro_entrega on public.veiculos_entrega;
drop trigger if exists proteger_estado_parceiro_entrega on public.documentos_parceiro_entrega;

create trigger proteger_estado_parceiro_entrega
before insert or update on public.parceiros_entrega
for each row execute function public.proteger_estado_parceiro_entrega();

commit;
