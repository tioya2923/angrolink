-- Correção do erro: record "old" has no field "estado".
-- A função é partilhada por veículos e documentos; referências aos campos de
-- documento têm de ficar dentro do ramo exclusivo de documentos.

begin;

create or replace function public.proteger_verificacao_logistica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'documentos_parceiro_entrega' then
    -- Permite apenas o reenvio controlado de um documento anteriormente rejeitado.
    if tg_op = 'UPDATE'
      and current_setting('angrolink.reenviar_documento', true) = 'true' then
      if old.estado = 'rejeitado' and new.estado = 'pendente' then
        return new;
      end if;
    end if;

    if public.eh_admin() then
      return new;
    end if;

    if tg_op = 'INSERT' then
      if new.estado <> 'pendente' then
        raise exception 'A verificação do documento só pode ser alterada por administrador';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.estado is distinct from old.estado
        or new.motivo_rejeicao is distinct from old.motivo_rejeicao
        or new.analisado_por is distinct from old.analisado_por
        or new.analisado_em is distinct from old.analisado_em then
        raise exception 'A verificação do documento só pode ser alterada por administrador';
      end if;
    end if;

    return new;
  end if;

  if tg_table_name = 'veiculos_entrega' then
    if public.eh_admin() then
      return new;
    end if;

    if tg_op = 'INSERT' then
      if new.estado_verificacao <> 'pendente' then
        raise exception 'A verificação do veículo só pode ser alterada por administrador';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.estado_verificacao is distinct from old.estado_verificacao
        or new.motivo_rejeicao is distinct from old.motivo_rejeicao then
        raise exception 'A verificação do veículo só pode ser alterada por administrador';
      end if;
    end if;
  end if;

  return new;
end;
$$;

commit;
