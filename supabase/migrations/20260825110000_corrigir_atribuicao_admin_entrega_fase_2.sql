begin;

-- O Admin 360 precisa da última atribuição histórica, inclusive quando a
-- tarefa já foi recusada, cancelada ou concluída. A ausência de qualquer
-- atribuição continua sendo o único caso que devolve `nao_atribuido`.
create or replace function public.obter_atribuicao_entrega_encomenda_admin(
  p_encomenda_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_resultado jsonb;
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  if not exists (
    select 1
    from public.encomendas
    where id = p_encomenda_id
  ) then
    raise exception 'Encomenda não encontrada.';
  end if;

  select jsonb_build_object(
    'id', a.id,
    'estado', a.estado,
    'atribuido_em', a.atribuido_em,
    'aceite_em', a.aceite_em,
    'chegou_origem_em', a.chegou_origem_em,
    'recolhida_em', a.recolhida_em,
    'recusado_em', a.recusado_em,
    'cancelado_em', a.cancelado_em,
    'concluido_em', a.concluido_em,
    'motivo_recusa', a.motivo_recusa,
    'motivo_cancelamento', a.motivo_cancelamento,
    'parceiro_id', p.id,
    'parceiro_nome', p.nome_completo,
    'veiculo_id', v.id,
    'veiculo_tipo', v.tipo_veiculo,
    'matricula', v.matricula,
    'atribuido_por', a.atribuido_por,
    'admin_nome', pr.nome
  )
  into v_resultado
  from public.atribuicoes_entrega_encomenda a
  join public.parceiros_entrega p on p.id = a.parceiro_entrega_id
  join public.veiculos_entrega v on v.id = a.veiculo_id
  left join public.profiles pr on pr.id = a.atribuido_por
  where a.encomenda_id = p_encomenda_id
  order by a.atribuido_em desc, a.id desc
  limit 1;

  return coalesce(v_resultado, jsonb_build_object('estado', 'nao_atribuido'));
end;
$$;

revoke all on function public.obter_atribuicao_entrega_encomenda_admin(uuid) from public, anon;
grant execute on function public.obter_atribuicao_entrega_encomenda_admin(uuid) to authenticated;

commit;
