-- ANGROLINK — Entregador 360 V1: projeções administrativas de leitura.
-- Não altera estados, documentos, Storage, reenvios ou lógica futura de entregas.
begin;

create index if not exists veiculos_entrega_parceiro_criado_idx
  on public.veiculos_entrega (parceiro_id, criado_em desc);
create index if not exists documentos_parceiro_entrega_parceiro_criado_idx
  on public.documentos_parceiro_entrega (parceiro_id, criado_em desc);
create index if not exists areas_cobertura_entrega_parceiro_criado_idx
  on public.areas_cobertura_entrega (parceiro_id, criado_em desc);

create or replace function public.obter_entregador_admin(p_parceiro_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_resultado jsonb;
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  select jsonb_build_object(
    'parceiro', jsonb_build_object(
      'parceiro_id', pe.id,
      'user_id', pe.user_id,
      'nome_completo', pe.nome_completo,
      'email', pe.email,
      'telefone', pe.telefone,
      'foto_perfil_disponivel', pe.foto_perfil_url is not null,
      'criado_em', pe.criado_em,
      'atualizado_em', pe.atualizado_em,
      'estado', pe.estado,
      'disponibilidade', pe.disponibilidade,
      'aprovado_em', pe.aprovado_em,
      'motivo_rejeicao', pe.motivo_rejeicao,
      'motivo_suspensao', pe.motivo_suspensao,
      'provincia', pe.provincia,
      'municipio', pe.municipio,
      'bairro', pe.bairro,
      'zona_base', pe.zona_base
    ),
    'resumo_operacional', jsonb_build_object(
      'total_veiculos', (select count(*) from public.veiculos_entrega v where v.parceiro_id = pe.id),
      'veiculos_aprovados', (select count(*) from public.veiculos_entrega v where v.parceiro_id = pe.id and v.estado_verificacao = 'aprovado'),
      'total_documentos', (select count(*) from public.documentos_parceiro_entrega d where d.parceiro_id = pe.id),
      'documentos_pendentes', (select count(*) from public.documentos_parceiro_entrega d where d.parceiro_id = pe.id and d.estado = 'pendente'),
      'documentos_expirados', (select count(*) from public.documentos_parceiro_entrega d where d.parceiro_id = pe.id and d.estado = 'expirado'),
      'areas_ativas', (select count(*) from public.areas_cobertura_entrega a where a.parceiro_id = pe.id and a.ativo)
    ),
    'outros_papeis', jsonb_build_object(
      'cliente', exists(select 1 from public.clientes c where c.id = pe.user_id),
      'vendedor', exists(select 1 from public.vendedores v where v.user_id = pe.user_id),
      'admin', exists(select 1 from public.administradores a where a.user_id = pe.user_id)
    ),
    'historico_documental_disponivel', false,
    'historico_administrativo_disponivel', false,
    'entregas_disponiveis', false,
    'financeiro_disponivel', false,
    'incidentes_disponiveis', false
  ) into v_resultado
  from public.parceiros_entrega pe
  where pe.id = p_parceiro_id;

  if v_resultado is null then
    raise exception 'Entregador não encontrado.';
  end if;
  return v_resultado;
end;
$$;

create or replace function public.listar_veiculos_entregador_admin(
  p_parceiro_id uuid,
  p_limite integer default 25,
  p_offset integer default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if not exists (select 1 from public.parceiros_entrega where id = p_parceiro_id) then raise exception 'Entregador não encontrado.'; end if;
  return (
    with base as (
      select v.id, v.tipo_veiculo, v.marca, v.modelo, v.cor, v.ano, v.matricula,
        v.tipo_carrocaria, v.capacidade_kg, v.capacidade_volume_m3, v.possui_caixa_carga,
        v.aceita_paletes, v.possui_refrigeracao, v.estado_verificacao, v.motivo_rejeicao,
        v.foto_veiculo_path is not null as foto_disponivel, v.criado_em, v.atualizado_em
      from public.veiculos_entrega v
      where v.parceiro_id = p_parceiro_id
    ), pagina as (
      select * from base order by criado_em desc, id limit v_limite offset v_offset
    ), itens as (
      select coalesce(jsonb_agg(jsonb_build_object(
        'veiculo_id', id, 'tipo_veiculo', tipo_veiculo, 'marca', marca, 'modelo', modelo,
        'cor', cor, 'ano', ano, 'matricula', matricula, 'tipo_carrocaria', tipo_carrocaria,
        'capacidade_kg', capacidade_kg, 'capacidade_volume_m3', capacidade_volume_m3,
        'possui_caixa_carga', possui_caixa_carga, 'aceita_paletes', aceita_paletes,
        'possui_refrigeracao', possui_refrigeracao, 'estado_verificacao', estado_verificacao,
        'motivo_rejeicao', motivo_rejeicao, 'foto_disponivel', foto_disponivel,
        'criado_em', criado_em, 'atualizado_em', atualizado_em
      ) order by criado_em desc, id), '[]'::jsonb) as dados
      from pagina
    ) select jsonb_build_object('itens', itens.dados, 'paginacao', jsonb_build_object(
      'total_resultados', (select count(*) from base), 'limite', v_limite, 'offset', v_offset
    )) from itens
  );
end;
$$;

create or replace function public.listar_documentos_entregador_admin(
  p_parceiro_id uuid,
  p_limite integer default 25,
  p_offset integer default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if not exists (select 1 from public.parceiros_entrega where id = p_parceiro_id) then raise exception 'Entregador não encontrado.'; end if;
  return (
    with base as (
      select d.id, d.tipo_documento, d.numero_documento, d.validade, d.estado,
        d.veiculo_id, v.matricula as veiculo_matricula,
        d.frente_path is not null as frente_disponivel, d.verso_path is not null as verso_disponivel,
        d.criado_em, d.atualizado_em, d.analisado_por, d.analisado_em, d.motivo_rejeicao
      from public.documentos_parceiro_entrega d
      left join public.veiculos_entrega v on v.id = d.veiculo_id
      where d.parceiro_id = p_parceiro_id
    ), pagina as (
      select * from base order by criado_em desc, id limit v_limite offset v_offset
    ), itens as (
      select coalesce(jsonb_agg(jsonb_build_object(
        'documento_id', id, 'tipo_documento', tipo_documento, 'numero_documento', numero_documento,
        'validade', validade, 'estado', estado, 'veiculo_id', veiculo_id,
        'veiculo_matricula', veiculo_matricula, 'frente_disponivel', frente_disponivel,
        'verso_disponivel', verso_disponivel, 'criado_em', criado_em, 'atualizado_em', atualizado_em,
        'analisado_por', analisado_por, 'analisado_em', analisado_em, 'motivo_rejeicao', motivo_rejeicao
      ) order by criado_em desc, id), '[]'::jsonb) as dados
      from pagina
    ) select jsonb_build_object('itens', itens.dados, 'paginacao', jsonb_build_object(
      'total_resultados', (select count(*) from base), 'limite', v_limite, 'offset', v_offset
    )) from itens
  );
end;
$$;

create or replace function public.listar_areas_cobertura_entregador_admin(
  p_parceiro_id uuid,
  p_limite integer default 25,
  p_offset integer default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if not exists (select 1 from public.parceiros_entrega where id = p_parceiro_id) then raise exception 'Entregador não encontrado.'; end if;
  return (
    with base as (
      select a.id, a.provincia, a.municipio, a.bairro, a.ativo, a.criado_em
      from public.areas_cobertura_entrega a where a.parceiro_id = p_parceiro_id
    ), pagina as (
      select * from base order by criado_em desc, id limit v_limite offset v_offset
    ), itens as (
      select coalesce(jsonb_agg(jsonb_build_object(
        'area_id', id, 'provincia', provincia, 'municipio', municipio, 'bairro', bairro,
        'ativo', ativo, 'criado_em', criado_em
      ) order by criado_em desc, id), '[]'::jsonb) as dados from pagina
    ) select jsonb_build_object('itens', itens.dados, 'paginacao', jsonb_build_object(
      'total_resultados', (select count(*) from base), 'limite', v_limite, 'offset', v_offset
    )) from itens
  );
end;
$$;

revoke all on function public.obter_entregador_admin(uuid) from public, anon;
revoke all on function public.listar_veiculos_entregador_admin(uuid, integer, integer) from public, anon;
revoke all on function public.listar_documentos_entregador_admin(uuid, integer, integer) from public, anon;
revoke all on function public.listar_areas_cobertura_entregador_admin(uuid, integer, integer) from public, anon;
grant execute on function public.obter_entregador_admin(uuid) to authenticated;
grant execute on function public.listar_veiculos_entregador_admin(uuid, integer, integer) to authenticated;
grant execute on function public.listar_documentos_entregador_admin(uuid, integer, integer) to authenticated;
grant execute on function public.listar_areas_cobertura_entregador_admin(uuid, integer, integer) to authenticated;

commit;
