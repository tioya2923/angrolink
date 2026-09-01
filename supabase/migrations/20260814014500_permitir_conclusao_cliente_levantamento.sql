-- ANGROLINK — conclusão comercial após levantamento confirmado.
-- Não confirma pagamento, não cria repasse e não movimenta valores financeiros.

begin;

create or replace function public.transicionar_encomenda_levantamento(
  p_encomenda_id uuid,
  p_proximo_estado text,
  p_motivo text default null
)
returns public.encomendas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encomenda public.encomendas%rowtype;
  v_estado_anterior text;
  v_ator text;
  v_evento text;
  v_motivo text := nullif(btrim(p_motivo), '');
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão novamente.';
  end if;

  select * into v_encomenda from public.encomendas where id = p_encomenda_id for update;
  if not found then raise exception 'Encomenda não encontrada.'; end if;

  if exists (select 1 from public.clientes c where c.id = v_encomenda.cliente_id and c.id = auth.uid()) then
    v_ator := 'cliente';
  elsif exists (
    select 1 from public.vendedores v
    where v.id = v_encomenda.vendedor_id and v.user_id = auth.uid()
      and public.vendedor_pode_receber_encomendas(v.id) = true
  ) then
    v_ator := 'vendedor';
  else
    raise exception 'Sem permissão para alterar esta encomenda.';
  end if;

  if v_ator = 'cliente' then
    if v_encomenda.estado = 'aguardando_confirmacao' and p_proximo_estado = 'cancelada' then
      if v_motivo is null or char_length(v_motivo) < 3 or char_length(v_motivo) > 500 then
        raise exception 'Indique um motivo de cancelamento entre 3 e 500 caracteres.';
      end if;
      v_evento := 'cliente_cancelou';
    elsif v_encomenda.estado = 'levantada' and p_proximo_estado = 'concluida' then
      v_evento := 'encomenda_concluida';
    else
      raise exception 'Esta transição não é permitida para o cliente.';
    end if;
  else
    if v_encomenda.estado = 'aguardando_confirmacao' and p_proximo_estado = 'confirmada' then
      v_evento := 'vendedor_confirmou';
    elsif v_encomenda.estado = 'aguardando_confirmacao' and p_proximo_estado = 'recusada' then
      if v_motivo is null or char_length(v_motivo) < 3 or char_length(v_motivo) > 500 then
        raise exception 'Indique um motivo de recusa entre 3 e 500 caracteres.';
      end if;
      v_evento := 'vendedor_recusou';
    elsif v_encomenda.estado = 'confirmada' and p_proximo_estado = 'em_preparacao' then
      v_evento := 'preparacao_iniciada';
    elsif v_encomenda.estado = 'em_preparacao' and p_proximo_estado = 'pronta_para_levantamento' then
      v_evento := 'pronta_para_levantamento';
    else
      raise exception 'Esta transição não é permitida para o vendedor.';
    end if;
  end if;

  v_estado_anterior := v_encomenda.estado;
  update public.encomendas set
    estado = p_proximo_estado,
    motivo_recusa = case when v_ator = 'vendedor' and p_proximo_estado = 'recusada' then v_motivo else motivo_recusa end,
    motivo_cancelamento = case when v_ator = 'cliente' and p_proximo_estado = 'cancelada' then v_motivo else motivo_cancelamento end,
    confirmado_em = case when p_proximo_estado = 'confirmada' then now() else confirmado_em end,
    recusado_em = case when p_proximo_estado = 'recusada' then now() else recusado_em end,
    concluido_em = case when p_proximo_estado = 'concluida' then now() else concluido_em end,
    cancelado_em = case when p_proximo_estado = 'cancelada' then now() else cancelado_em end
  where id = v_encomenda.id returning * into v_encomenda;

  insert into public.eventos_encomenda (encomenda_id, tipo_evento, estado_anterior, estado_novo, ator_tipo, utilizador_id, metadados)
  values (
    v_encomenda.id, v_evento, v_estado_anterior, p_proximo_estado, v_ator, auth.uid(),
    case when v_evento in ('cliente_cancelou', 'vendedor_recusou') then jsonb_build_object('motivo', v_motivo) else '{}'::jsonb end
  );

  return v_encomenda;
end;
$$;

commit;
