begin;

create or replace function public.proteger_verificacao_logistica()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'documentos_parceiro_entrega'
    and tg_op = 'UPDATE'
    and current_setting('angrolink.reenviar_documento', true) = 'true'
    and old.estado = 'rejeitado'
    and new.estado = 'pendente' then
    return new;
  end if;

  if public.eh_admin() then return new; end if;

  if tg_table_name = 'veiculos_entrega' then
    if tg_op = 'INSERT' and new.estado_verificacao <> 'pendente' then
      raise exception 'A verificação do veículo só pode ser alterada por administrador';
    elsif tg_op = 'UPDATE' and (new.estado_verificacao is distinct from old.estado_verificacao or new.motivo_rejeicao is distinct from old.motivo_rejeicao) then
      raise exception 'A verificação do veículo só pode ser alterada por administrador';
    end if;
  elsif tg_table_name = 'documentos_parceiro_entrega' then
    if tg_op = 'INSERT' and new.estado <> 'pendente' then
      raise exception 'A verificação do documento só pode ser alterada por administrador';
    elsif tg_op = 'UPDATE' and (new.estado is distinct from old.estado or new.motivo_rejeicao is distinct from old.motivo_rejeicao or new.analisado_por is distinct from old.analisado_por or new.analisado_em is distinct from old.analisado_em) then
      raise exception 'A verificação do documento só pode ser alterada por administrador';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.reenviar_documento_parceiro(
  p_documento_id uuid,
  p_frente_path text,
  p_verso_path text
)
returns void language plpgsql security definer set search_path = public as $$
declare v_parceiro_id uuid;
begin
  select d.parceiro_id into v_parceiro_id
  from public.documentos_parceiro_entrega d
  join public.parceiros_entrega p on p.id = d.parceiro_id
  where d.id = p_documento_id and p.user_id = auth.uid() and d.estado = 'rejeitado'
  for update;
  if not found then raise exception 'Documento rejeitado não encontrado.'; end if;

  perform set_config('angrolink.reenviar_documento', 'true', true);
  update public.documentos_parceiro_entrega
  set frente_path = p_frente_path, verso_path = p_verso_path, estado = 'pendente', motivo_rejeicao = null, analisado_por = null, analisado_em = null, atualizado_em = now()
  where id = p_documento_id;

  perform set_config('angrolink.submeter_parceiro', 'true', true);
  update public.parceiros_entrega
  set estado = 'em_analise', disponibilidade = false, atualizado_em = now()
  where id = v_parceiro_id and estado = 'documentos_pendentes';
end;
$$;

grant execute on function public.reenviar_documento_parceiro(uuid, text, text) to authenticated;
commit;
