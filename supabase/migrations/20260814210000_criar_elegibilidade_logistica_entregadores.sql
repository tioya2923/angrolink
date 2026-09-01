-- ANGROLINK — Fundação de elegibilidade logística de entregadores V1.
-- Não atribui entregas, não calcula tarifas e não expõe media/documentos privados.
begin;

-- A política antes existia apenas de forma implícita no formulário de cadastro:
-- mota: BI, carta, livrete e seguro; restantes veículos: os anteriores +
-- inspeção técnica e licença de transporte. A configuração passa a ser a única
-- fonte de verdade para futuras operações logísticas.
create table if not exists public.requisitos_documentos_entrega (
  id uuid primary key default gen_random_uuid(),
  escopo text not null check (escopo in ('pessoal', 'veiculo')),
  tipo_veiculo text not null check (tipo_veiculo in ('todos', 'mota', 'carro', 'carrinha', 'camiao')),
  tipo_documento text not null check (tipo_documento in (
    'bi', 'carta_conducao', 'livrete_veiculo', 'seguro_automovel',
    'inspecao_tecnica', 'licenca_transporte_mercadorias', 'nif',
    'certidao_comercial', 'alvara_comercial'
  )),
  validade_obrigatoria boolean not null default false,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint requisitos_documentos_entrega_escopo_veiculo_check check (
    (escopo = 'pessoal' and tipo_veiculo = 'todos')
    or (escopo = 'veiculo' and tipo_veiculo <> 'todos')
  ),
  constraint requisitos_documentos_entrega_unico unique (escopo, tipo_veiculo, tipo_documento)
);

create index if not exists requisitos_documentos_entrega_ativos_idx
  on public.requisitos_documentos_entrega (escopo, tipo_veiculo, tipo_documento)
  where ativo;

-- Não depende do helper histórico dos parceiros: esta tabela usa um trigger
-- próprio, genérico e limitado ao respetivo campo de auditoria.
create or replace function public.atualizar_requisito_documento_entrega_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists atualizar_requisito_documento_entrega_em on public.requisitos_documentos_entrega;
create trigger atualizar_requisito_documento_entrega_em
before update on public.requisitos_documentos_entrega
for each row execute function public.atualizar_requisito_documento_entrega_em();

insert into public.requisitos_documentos_entrega (escopo, tipo_veiculo, tipo_documento, validade_obrigatoria)
values
  ('pessoal', 'todos', 'bi', false),
  ('pessoal', 'todos', 'carta_conducao', false),
  ('veiculo', 'mota', 'livrete_veiculo', false),
  ('veiculo', 'mota', 'seguro_automovel', false),
  ('veiculo', 'carro', 'livrete_veiculo', false),
  ('veiculo', 'carro', 'seguro_automovel', false),
  ('veiculo', 'carro', 'inspecao_tecnica', false),
  ('veiculo', 'carro', 'licenca_transporte_mercadorias', false),
  ('veiculo', 'carrinha', 'livrete_veiculo', false),
  ('veiculo', 'carrinha', 'seguro_automovel', false),
  ('veiculo', 'carrinha', 'inspecao_tecnica', false),
  ('veiculo', 'carrinha', 'licenca_transporte_mercadorias', false),
  ('veiculo', 'camiao', 'livrete_veiculo', false),
  ('veiculo', 'camiao', 'seguro_automovel', false),
  ('veiculo', 'camiao', 'inspecao_tecnica', false),
  ('veiculo', 'camiao', 'licenca_transporte_mercadorias', false)
on conflict (escopo, tipo_veiculo, tipo_documento) do nothing;

alter table public.requisitos_documentos_entrega enable row level security;
revoke all on table public.requisitos_documentos_entrega from public, anon, authenticated;

-- Códigos estáveis para diagnóstico operacional de um veículo. Veículo
-- operacional não é autorização de matching: qualquer atribuição futura deve
-- exigir também entregador_pode_receber_entregas(parceiro_id).
create or replace function public.motivos_operacionais_veiculo_entrega(p_veiculo_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_veiculo public.veiculos_entrega%rowtype;
  v_motivos text[] := array[]::text[];
begin
  select * into v_veiculo
  from public.veiculos_entrega
  where id = p_veiculo_id;

  if not found then
    return array['veiculo_inexistente'];
  end if;

  if v_veiculo.estado_verificacao <> 'aprovado' then
    v_motivos := v_motivos || ('veiculo_' || v_veiculo.estado_verificacao);
  end if;

  select coalesce(array_agg(codigo order by codigo), array[]::text[])
    into v_motivos
  from (
    select distinct unnest(v_motivos) as codigo
    union
    select distinct case
      when d.id is null or atual.id is null then 'documento_em_falta:' || r.tipo_documento
      when atual.estado = 'pendente' then 'documento_pendente:' || r.tipo_documento
      when atual.estado = 'rejeitado' then 'documento_rejeitado:' || r.tipo_documento
      when atual.estado = 'expirado' then 'documento_expirado:' || r.tipo_documento
      when r.validade_obrigatoria and atual.validade_snapshot is null then 'validade_em_falta:' || r.tipo_documento
      when atual.validade_snapshot is not null and atual.validade_snapshot < current_date then 'documento_expirado:' || r.tipo_documento
      else null
    end as codigo
    from public.requisitos_documentos_entrega r
    left join lateral (
      select d0.*
      from public.documentos_parceiro_entrega d0
      where d0.parceiro_id = v_veiculo.parceiro_id
        and d0.veiculo_id = v_veiculo.id
        and d0.tipo_documento = r.tipo_documento
      order by d0.atualizado_em desc, d0.id desc
      limit 1
    ) d on true
    left join public.versoes_documento_parceiro_entrega atual
      on atual.id = d.versao_atual_id
    where r.ativo
      and r.escopo = 'veiculo'
      and r.tipo_veiculo = v_veiculo.tipo_veiculo
  ) motivos
  where codigo is not null;

  return v_motivos;
end;
$$;

create or replace function public.veiculo_operacional_para_entregas(p_veiculo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select cardinality(public.motivos_operacionais_veiculo_entrega(p_veiculo_id)) = 0;
$$;

-- Compatibilidade de nome. Esta função só responde pela condição operacional
-- do veículo; nunca deve ser usada isoladamente para atribuir/matchear entrega.
create or replace function public.veiculo_pode_receber_entregas(p_veiculo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.veiculo_operacional_para_entregas(p_veiculo_id);
$$;

-- Diagnóstico completo do parceiro. Os documentos pessoais são avaliados uma
-- única vez; basta haver um veículo aprovado e operacional para o parceiro
-- poder receber uma entrega no futuro.
create or replace function public.motivos_elegibilidade_entregador(p_parceiro_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_parceiro public.parceiros_entrega%rowtype;
  v_motivos text[] := array[]::text[];
begin
  select * into v_parceiro
  from public.parceiros_entrega
  where id = p_parceiro_id;

  if not found then
    return array['parceiro_inexistente'];
  end if;

  if v_parceiro.estado <> 'aprovado' then
    v_motivos := v_motivos || 'parceiro_nao_aprovado';
  end if;
  if not v_parceiro.disponibilidade then
    v_motivos := v_motivos || 'indisponivel';
  end if;
  if not exists (
    select 1 from public.areas_cobertura_entrega a
    where a.parceiro_id = v_parceiro.id and a.ativo
  ) then
    v_motivos := v_motivos || 'sem_area_ativa';
  end if;

  select coalesce(array_agg(codigo order by codigo), array[]::text[])
    into v_motivos
  from (
    select distinct unnest(v_motivos) as codigo
    union
    select distinct case
      when d.id is null or atual.id is null then 'documento_em_falta:' || r.tipo_documento
      when atual.estado = 'pendente' then 'documento_pendente:' || r.tipo_documento
      when atual.estado = 'rejeitado' then 'documento_rejeitado:' || r.tipo_documento
      when atual.estado = 'expirado' then 'documento_expirado:' || r.tipo_documento
      when r.validade_obrigatoria and atual.validade_snapshot is null then 'validade_em_falta:' || r.tipo_documento
      when atual.validade_snapshot is not null and atual.validade_snapshot < current_date then 'documento_expirado:' || r.tipo_documento
      else null
    end as codigo
    from public.requisitos_documentos_entrega r
    left join lateral (
      select d0.*
      from public.documentos_parceiro_entrega d0
      where d0.parceiro_id = v_parceiro.id
        and d0.veiculo_id is null
        and d0.tipo_documento = r.tipo_documento
      order by d0.atualizado_em desc, d0.id desc
      limit 1
    ) d on true
    left join public.versoes_documento_parceiro_entrega atual
      on atual.id = d.versao_atual_id
    where r.ativo
      and r.escopo = 'pessoal'
  ) motivos
  where codigo is not null;

  if not exists (select 1 from public.veiculos_entrega v where v.parceiro_id = v_parceiro.id) then
    v_motivos := v_motivos || 'sem_veiculo';
  elsif not exists (
    select 1 from public.veiculos_entrega v
    where v.parceiro_id = v_parceiro.id and v.estado_verificacao = 'aprovado'
  ) then
    v_motivos := v_motivos || case when exists (
      select 1 from public.veiculos_entrega v
      where v.parceiro_id = v_parceiro.id and v.estado_verificacao = 'rejeitado'
    ) then 'veiculo_rejeitado' else 'sem_veiculo_aprovado' end;
  elsif not exists (
    select 1 from public.veiculos_entrega v
    where v.parceiro_id = v_parceiro.id
      and public.veiculo_operacional_para_entregas(v.id)
  ) then
    v_motivos := v_motivos || 'sem_veiculo_operacional';
  end if;

  select coalesce(array_agg(distinct codigo order by codigo), array[]::text[])
    into v_motivos
  from unnest(v_motivos) as codigo;

  return v_motivos;
end;
$$;

create or replace function public.entregador_pode_receber_entregas(p_parceiro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select cardinality(public.motivos_elegibilidade_entregador(p_parceiro_id)) = 0;
$$;

-- Projeção administrativa sem paths privados, números de documentos ou URLs.
create or replace function public.obter_elegibilidade_entregador_admin(p_parceiro_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;
  if not exists (select 1 from public.parceiros_entrega where id = p_parceiro_id) then
    raise exception 'Entregador não encontrado.';
  end if;

  return jsonb_build_object(
    'pode_receber_entregas', public.entregador_pode_receber_entregas(p_parceiro_id),
    'motivos', to_jsonb(public.motivos_elegibilidade_entregador(p_parceiro_id)),
    'veiculos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'veiculo_id', v.id,
        'veiculo_operacional', public.veiculo_operacional_para_entregas(v.id),
        'motivos', to_jsonb(public.motivos_operacionais_veiculo_entrega(v.id))
      ) order by v.criado_em, v.id)
      from public.veiculos_entrega v
      where v.parceiro_id = p_parceiro_id
    ), '[]'::jsonb)
  );
end;
$$;

-- Mantém o contrato 360 existente e acrescenta somente uma projeção segura de
-- elegibilidade. A interface continua a chamar a mesma RPC já tipada.
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
      'parceiro_id', pe.id, 'user_id', pe.user_id, 'nome_completo', pe.nome_completo,
      'email', pe.email, 'telefone', pe.telefone,
      'foto_perfil_disponivel', pe.foto_perfil_url is not null,
      'criado_em', pe.criado_em, 'atualizado_em', pe.atualizado_em,
      'estado', pe.estado, 'disponibilidade', pe.disponibilidade,
      'aprovado_em', pe.aprovado_em, 'motivo_rejeicao', pe.motivo_rejeicao,
      'motivo_suspensao', pe.motivo_suspensao, 'provincia', pe.provincia,
      'municipio', pe.municipio, 'bairro', pe.bairro, 'zona_base', pe.zona_base
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
    'elegibilidade_logistica', public.obter_elegibilidade_entregador_admin(pe.id),
    'historico_documental_disponivel', true,
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

revoke all on function public.motivos_operacionais_veiculo_entrega(uuid) from public, anon, authenticated;
revoke all on function public.veiculo_operacional_para_entregas(uuid) from public, anon, authenticated;
revoke all on function public.veiculo_pode_receber_entregas(uuid) from public, anon, authenticated;
revoke all on function public.motivos_elegibilidade_entregador(uuid) from public, anon, authenticated;
revoke all on function public.entregador_pode_receber_entregas(uuid) from public, anon, authenticated;
revoke all on function public.atualizar_requisito_documento_entrega_em() from public, anon, authenticated;
revoke all on function public.obter_elegibilidade_entregador_admin(uuid) from public, anon;
grant execute on function public.obter_elegibilidade_entregador_admin(uuid) to authenticated;

commit;
