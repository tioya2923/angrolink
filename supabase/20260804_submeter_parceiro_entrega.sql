-- Envia um cadastro completo para análise depois de todos os documentos serem guardados.
-- Executar depois de 20260803_parceiros_entrega_fundacao.sql.

begin;

-- Permite exclusivamente a transição controlada pela função de submissão.
-- O parceiro continua sem poder aprovar, rejeitar, suspender ou disponibilizar-se.
create or replace function public.proteger_estado_parceiro_entrega()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if current_setting('angrolink.submeter_parceiro', true) = 'true'
      and old.estado in ('rascunho', 'documentos_pendentes', 'rejeitado')
      and new.estado = 'em_analise'
      and new.disponibilidade = false then
      return new;
    end if;
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

-- Não mistura campos de veículo e de documento. Isto evita erros como
-- "record NEW has no field estado_verificacao" durante o envio de ficheiros.
create or replace function public.proteger_verificacao_logistica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.eh_admin() then
    return new;
  end if;

  if tg_table_name = 'veiculos_entrega' then
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
  elsif tg_table_name = 'documentos_parceiro_entrega' then
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
  end if;

  return new;
end;
$$;

create or replace function public.submeter_pedido_parceiro_entrega(p_parceiro_id uuid)
returns public.parceiros_entrega
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
  v_total_documentos integer;
  v_minimo_documentos integer;
  v_resultado public.parceiros_entrega%rowtype;
begin
  select estado
    into v_estado
  from public.parceiros_entrega
  where id = p_parceiro_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Parceiro não encontrado ou sem permissão.';
  end if;

  if v_estado not in ('rascunho', 'documentos_pendentes', 'rejeitado') then
    raise exception 'Este pedido não pode ser submetido no estado atual.';
  end if;

  if not exists (
    select 1
    from public.veiculos_entrega
    where parceiro_id = p_parceiro_id
  ) then
    raise exception 'Indique pelo menos um veículo antes de enviar o pedido.';
  end if;

  select count(*)
    into v_total_documentos
  from public.documentos_parceiro_entrega
  where parceiro_id = p_parceiro_id
    and nullif(frente_path, '') is not null
    and nullif(verso_path, '') is not null;

  select case when exists (
    select 1 from public.veiculos_entrega
    where parceiro_id = p_parceiro_id and tipo_veiculo = 'mota'
  ) then 4 else 6 end
  into v_minimo_documentos;

  if v_total_documentos < v_minimo_documentos then
    raise exception 'Envie frente e verso de todos os documentos obrigatórios.';
  end if;

  perform set_config('angrolink.submeter_parceiro', 'true', true);

  update public.parceiros_entrega
  set estado = 'em_analise',
      disponibilidade = false,
      motivo_rejeicao = null,
      motivo_suspensao = null,
      atualizado_em = now()
  where id = p_parceiro_id
  returning * into v_resultado;

  return v_resultado;
end;
$$;

grant execute on function public.submeter_pedido_parceiro_entrega(uuid) to authenticated;

-- Recupera apenas rascunhos completos criados antes desta correção, para que
-- cheguem à análise administrativa sem obrigar o parceiro a preencher tudo de novo.
select set_config('angrolink.submeter_parceiro', 'true', true);
update public.parceiros_entrega p
set estado = 'em_analise',
    disponibilidade = false,
    atualizado_em = now()
where p.estado = 'rascunho'
  and exists (
    select 1 from public.veiculos_entrega v
    where v.parceiro_id = p.id
  )
  and (
    (exists (select 1 from public.veiculos_entrega v where v.parceiro_id = p.id and v.tipo_veiculo = 'mota') and
      (select count(*) from public.documentos_parceiro_entrega d where d.parceiro_id = p.id and nullif(d.frente_path, '') is not null and nullif(d.verso_path, '') is not null) >= 4)
    or
    (not exists (select 1 from public.veiculos_entrega v where v.parceiro_id = p.id and v.tipo_veiculo = 'mota') and
      (select count(*) from public.documentos_parceiro_entrega d where d.parceiro_id = p.id and nullif(d.frente_path, '') is not null and nullif(d.verso_path, '') is not null) >= 6)
  );

commit;
