begin;

-- O reenvio controlado precisa aceitar tanto rejeicao como expiracao, sem
-- confiar numa GUC apresentada diretamente por um papel de browser. A funcao
-- roda como invoker: chamadas pelas RPCs SECURITY DEFINER usam o papel interno;
-- chamadas diretas authenticated/anon continuam sujeitas a RLS e a este bloqueio.
create or replace function public.proteger_verificacao_logistica()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_table_name = 'documentos_parceiro_entrega' then
    if tg_op = 'UPDATE'
      and current_setting('angrolink.reenviar_documento', true) = 'true'
      and current_user not in ('authenticated', 'anon')
      and old.estado in ('rejeitado', 'expirado')
      and new.estado = 'pendente' then
      return new;
    end if;

    if public.eh_admin() then
      return new;
    end if;

    if tg_op = 'INSERT' then
      if new.estado <> 'pendente' then
        raise exception 'A verificacao do documento so pode ser alterada por administrador';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.estado is distinct from old.estado
        or new.motivo_rejeicao is distinct from old.motivo_rejeicao
        or new.analisado_por is distinct from old.analisado_por
        or new.analisado_em is distinct from old.analisado_em then
        raise exception 'A verificacao do documento so pode ser alterada por administrador';
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
        raise exception 'A verificacao do veiculo so pode ser alterada por administrador';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.estado_verificacao is distinct from old.estado_verificacao
        or new.motivo_rejeicao is distinct from old.motivo_rejeicao then
        raise exception 'A verificacao do veiculo so pode ser alterada por administrador';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- A reabertura administrativa não pode fingir que uma candidatura está pronta
-- para análise enquanto ainda existe documento rejeitado. O motivo da rejeição
-- permanece exclusivamente no documento; os motivos administrativos do parceiro
-- são limpos porque a suspensão/rejeição foi reaberta.
create or replace function public.proteger_estado_parceiro_entrega()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_table_name <> 'parceiros_entrega' then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and public.eh_admin()
    and old.estado in ('rejeitado', 'suspenso', 'documentacao_expirada')
    and new.estado = 'em_analise' then
    if exists (
      select 1
      from public.documentos_parceiro_entrega documento
      where documento.parceiro_id = old.id
        and documento.estado = 'rejeitado'
    ) then
      new.estado := 'documentos_pendentes';
    elsif exists (
      select 1
      from public.documentos_parceiro_entrega documento
      where documento.parceiro_id = old.id
        and documento.estado = 'expirado'
    ) then
      new.estado := 'documentacao_expirada';
    end if;

    new.disponibilidade := false;
    new.motivo_rejeicao := null;
    new.motivo_suspensao := null;
  end if;

  if tg_op = 'UPDATE'
    and current_setting('angrolink.submeter_parceiro', true) = 'true'
    and current_user not in ('authenticated', 'anon')
    and old.estado in ('rascunho', 'documentos_pendentes', 'rejeitado', 'documentacao_expirada')
    and new.estado = 'em_analise'
    and new.disponibilidade = false then
    return new;
  end if;

  if not public.eh_admin() then
    if tg_op = 'INSERT' and (new.estado <> 'rascunho' or new.disponibilidade) then
      raise exception 'O parceiro não pode aprovar-se ou ficar disponível no cadastro';
    end if;

    if tg_op = 'UPDATE' and (
      new.user_id is distinct from old.user_id
      or new.estado is distinct from old.estado
      or new.motivo_rejeicao is distinct from old.motivo_rejeicao
      or new.motivo_suspensao is distinct from old.motivo_suspensao
      or new.aprovado_em is distinct from old.aprovado_em
    ) then
      raise exception 'O estado administrativo do parceiro só pode ser alterado por administrador';
    end if;
  end if;

  return new;
end;
$$;

-- Mantém a assinatura e a idempotência documental existentes, mas só aceita o
-- reenvio depois de uma reabertura que tenha deixado a candidatura no estado
-- documental próprio. Nunca aprova automaticamente o parceiro.
create or replace function public.reenviar_documento_parceiro(
  p_documento_id uuid,
  p_frente_path text,
  p_verso_path text,
  p_numero_documento text,
  p_validade date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  documento public.documentos_parceiro_entrega%rowtype;
  v_nova_versao uuid;
  v_numero_versao integer;
  v_numero_documento text;
  v_validade date;
begin
  select documento_atual.*
    into documento
    from public.documentos_parceiro_entrega documento_atual
    join public.parceiros_entrega parceiro on parceiro.id = documento_atual.parceiro_id
   where documento_atual.id = p_documento_id
     and parceiro.user_id = auth.uid()
     and parceiro.estado in ('documentos_pendentes', 'documentacao_expirada')
     and documento_atual.estado in ('rejeitado', 'expirado')
   for update;

  if not found then
    raise exception 'O documento só pode ser reenviado depois de a análise ser reaberta para correção.';
  end if;

  if documento.estado = 'expirado'
    and documento.validade is not null
    and p_validade is null then
    raise exception 'Indique a nova validade para renovar este documento expirado.';
  end if;

  if documento.estado = 'expirado'
    and documento.validade is not null
    and p_validade <= greatest(documento.validade, current_date) then
    raise exception 'A nova validade deve ser posterior à validade expirada e a hoje.';
  end if;

  v_numero_documento := coalesce(nullif(btrim(p_numero_documento), ''), documento.numero_documento);
  v_validade := coalesce(p_validade, documento.validade);

  select coalesce(max(versao.numero_versao), 0) + 1
    into v_numero_versao
    from public.versoes_documento_parceiro_entrega versao
   where versao.documento_id = documento.id;

  perform set_config('angrolink.sincronizar_documento', 'true', true);
  update public.versoes_documento_parceiro_entrega
     set substituido_em = now()
   where id = documento.versao_atual_id;

  insert into public.eventos_documento_parceiro_entrega(
    documento_id, versao_id, parceiro_id, ator_tipo, utilizador_id, evento,
    estado_anterior, estado_novo
  ) values (
    documento.id, documento.versao_atual_id, documento.parceiro_id, 'parceiro',
    auth.uid(), 'substituido', documento.estado, documento.estado
  );

  insert into public.versoes_documento_parceiro_entrega(
    documento_id, parceiro_id, veiculo_id, numero_versao, frente_path, verso_path,
    numero_documento_snapshot, validade_snapshot, estado
  ) values (
    documento.id, documento.parceiro_id, documento.veiculo_id, v_numero_versao,
    p_frente_path, p_verso_path, v_numero_documento, v_validade, 'pendente'
  ) returning id into v_nova_versao;

  perform set_config('angrolink.reenviar_documento', 'true', true);
  perform set_config('angrolink.reenviar_versao_documento', 'true', true);
  update public.documentos_parceiro_entrega
     set frente_path = p_frente_path,
         verso_path = p_verso_path,
         numero_documento = v_numero_documento,
         validade = v_validade,
         versao_atual_id = v_nova_versao,
         estado = 'pendente',
         motivo_rejeicao = null,
         analisado_por = null,
         analisado_em = null
   where id = documento.id;

  insert into public.eventos_documento_parceiro_entrega(
    documento_id, versao_id, parceiro_id, ator_tipo, utilizador_id, evento,
    estado_anterior, estado_novo
  ) values (
    documento.id, v_nova_versao, documento.parceiro_id, 'parceiro', auth.uid(),
    'reenviado', documento.estado, 'pendente'
  );

  perform set_config('angrolink.submeter_parceiro', 'true', true);
  update public.parceiros_entrega parceiro
     set estado = case
           when exists (
             select 1
             from public.documentos_parceiro_entrega pendencia
             where pendencia.parceiro_id = parceiro.id
               and pendencia.estado = 'rejeitado'
           ) then 'documentos_pendentes'
           when exists (
             select 1
             from public.documentos_parceiro_entrega pendencia
             where pendencia.parceiro_id = parceiro.id
               and pendencia.estado = 'expirado'
           ) then 'documentacao_expirada'
           else 'em_analise'
         end,
         disponibilidade = false
   where parceiro.id = documento.parceiro_id
     and estado in ('documentos_pendentes', 'documentacao_expirada');
end;
$$;

revoke all on function public.reenviar_documento_parceiro(uuid, text, text, text, date) from public, anon;
grant execute on function public.reenviar_documento_parceiro(uuid, text, text, text, date) to authenticated;

commit;
