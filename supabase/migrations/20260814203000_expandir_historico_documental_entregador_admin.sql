-- ANGROLINK — Projeção administrativa segura do histórico documental versionado.
-- Não expõe paths privados: a abertura de ficheiros é responsabilidade da Edge Function.
begin;

create or replace function public.listar_historico_documental_entregador_admin(
  p_parceiro_id uuid,
  p_limite integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  return (
    with documentos as (
      select
        d.id as documento_id,
        d.tipo_documento,
        d.veiculo_id,
        ve.matricula as veiculo_matricula,
        d.versao_atual_id,
        atual.numero_versao as versao_atual,
        coalesce(atual.estado, d.estado) as estado_atual,
        coalesce(atual.validade_snapshot, d.validade) as validade_atual,
        coalesce(atual.criado_em, d.atualizado_em, d.criado_em) as atualizado_em,
        count(versao.id)::integer as total_versoes
      from public.documentos_parceiro_entrega d
      left join public.versoes_documento_parceiro_entrega atual
        on atual.id = d.versao_atual_id
      left join public.versoes_documento_parceiro_entrega versao
        on versao.documento_id = d.id
      left join public.veiculos_entrega ve
        on ve.id = d.veiculo_id
      where d.parceiro_id = p_parceiro_id
      group by d.id, d.tipo_documento, d.veiculo_id, ve.matricula, d.versao_atual_id,
        atual.numero_versao, atual.estado, d.estado, atual.validade_snapshot, d.validade,
        atual.criado_em, d.atualizado_em, d.criado_em
    ), pagina as (
      select *
      from documentos
      order by atualizado_em desc nulls last, documento_id
      limit v_limite offset v_offset
    )
    select jsonb_build_object(
      'itens', coalesce(
        (
          select jsonb_agg(jsonb_build_object(
          'documento_id', p.documento_id,
          'tipo_documento', p.tipo_documento,
          'veiculo_id', p.veiculo_id,
          'veiculo_matricula', p.veiculo_matricula,
          'versao_atual_id', p.versao_atual_id,
          'versao_atual', p.versao_atual,
          'total_versoes', p.total_versoes,
          'estado_atual', p.estado_atual,
          'validade_atual', p.validade_atual,
          'atualizado_em', p.atualizado_em,
          'versoes', coalesce(
            (
              select jsonb_agg(jsonb_build_object(
              'versao_id', v.id,
              'numero_versao', v.numero_versao,
              'estado', v.estado,
              'numero_documento', v.numero_documento_snapshot,
              'validade', v.validade_snapshot,
              'criado_em', v.criado_em,
              'analisado_por', v.analisado_por,
              'analisado_em', v.analisado_em,
              'motivo_rejeicao', v.motivo_rejeicao,
              'substituido_em', v.substituido_em,
              'frente_disponivel', (v.frente_path is not null),
              'verso_disponivel', (v.verso_path is not null)
              ) order by v.numero_versao desc)
              from public.versoes_documento_parceiro_entrega v
              where v.documento_id = p.documento_id
            ),
            '[]'::jsonb
          ),
          'eventos', coalesce(
            (
              select jsonb_agg(jsonb_build_object(
              'evento_id', e.id,
              'versao_id', e.versao_id,
              'ator_tipo', e.ator_tipo,
              'utilizador_id', e.utilizador_id,
              'evento', e.evento,
              'estado_anterior', e.estado_anterior,
              'estado_novo', e.estado_novo,
              'motivo', e.motivo,
              'criado_em', e.criado_em
              ) order by e.criado_em, e.id)
              from public.eventos_documento_parceiro_entrega e
              where e.documento_id = p.documento_id
            ),
            '[]'::jsonb
          )
          ) order by p.atualizado_em desc nulls last, p.documento_id)
          from pagina p
        ),
        '[]'::jsonb
      ),
      'paginacao', jsonb_build_object(
        'total_resultados', (select count(*) from documentos),
        'limite', v_limite,
        'offset', v_offset
      )
    )
  );
end;
$$;

revoke all on function public.listar_historico_documental_entregador_admin(uuid, integer, integer) from public, anon;
grant execute on function public.listar_historico_documental_entregador_admin(uuid, integer, integer) to authenticated;

commit;
