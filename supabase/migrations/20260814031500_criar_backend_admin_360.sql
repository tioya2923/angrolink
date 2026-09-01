-- ANGROLINK — backend administrativo 360 V1.
-- Projeções e decisões lógicas; não processa PSP, repasse ou transferência.
-- Esta migration é atómica: qualquer falha reverte todo o módulo administrativo.
begin;

alter table public.disputas_encomenda
  add column if not exists analisado_por uuid references auth.users(id) on delete set null,
  add column if not exists analisado_em timestamptz;

create table if not exists public.auditoria_administrativa (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  entidade_tipo text not null check (entidade_tipo in ('disputa', 'reembolso')),
  entidade_id uuid not null,
  acao text not null check (acao in (
    'disputa_assumida', 'disputa_resolvida_sem_reembolso',
    'disputa_resolvida_reembolso_parcial', 'disputa_resolvida_reembolso_total'
  )),
  estado_anterior text,
  estado_novo text not null,
  motivo text,
  metadados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists auditoria_administrativa_entidade_idx
  on public.auditoria_administrativa (entidade_tipo, entidade_id, criado_em desc);

alter table public.auditoria_administrativa enable row level security;
create policy auditoria_administrativa_leitura_admin
  on public.auditoria_administrativa for select to authenticated
  using (public.eh_admin());

revoke all on table public.auditoria_administrativa from public, anon, authenticated;
grant select on table public.auditoria_administrativa to authenticated;

create or replace function public.proteger_auditoria_administrativa_append_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'A auditoria administrativa é append-only.';
end;
$$;

create trigger impedir_alteracao_auditoria_administrativa
before update or delete on public.auditoria_administrativa
for each row execute function public.proteger_auditoria_administrativa_append_only();

create or replace function public.listar_encomendas_admin(
  p_estado text default null,
  p_cliente_id uuid default null,
  p_vendedor_id uuid default null,
  p_estado_pagamento text default null,
  p_com_disputa boolean default null,
  p_de timestamptz default null,
  p_ate timestamptz default null
)
returns table (
  encomenda_id uuid, codigo_publico text, criado_em timestamptz,
  atualizado_em timestamptz, estado text, modalidade text, cliente_id uuid,
  cliente_nome text, vendedor_id uuid, vendedor_nome text, quantidade_itens bigint,
  subtotal_centimos bigint, desconto_centimos bigint, entrega_centimos bigint,
  total_centimos bigint, estado_pagamento text, tem_disputa boolean
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  return query
  select e.id, e.codigo_publico, e.criado_em, e.atualizado_em, e.estado,
    e.modalidade_recebimento, e.cliente_id, c.nome, e.vendedor_id, v.nome_comercial,
    count(i.id), e.subtotal_centimos, e.desconto_centimos, e.entrega_centimos,
    e.total_centimos, p.estado, public.encomenda_tem_disputa_ativa(e.id)
  from public.encomendas e
  join public.clientes c on c.id = e.cliente_id
  join public.vendedores v on v.id = e.vendedor_id
  left join public.itens_encomenda i on i.encomenda_id = e.id
  left join public.pagamentos p on p.encomenda_id = e.id
  where (p_estado is null or e.estado = p_estado)
    and (p_cliente_id is null or e.cliente_id = p_cliente_id)
    and (p_vendedor_id is null or e.vendedor_id = p_vendedor_id)
    and (p_estado_pagamento is null or p.estado = p_estado_pagamento)
    and (p_com_disputa is null or public.encomenda_tem_disputa_ativa(e.id) = p_com_disputa)
    and (p_de is null or e.criado_em >= p_de)
    and (p_ate is null or e.criado_em <= p_ate)
  group by e.id, c.nome, v.nome_comercial, p.estado
  order by e.atualizado_em desc;
end;
$$;

create or replace function public.listar_financeiro_admin()
returns table (
  pagamento_id uuid, encomenda_id uuid, codigo_publico text, cliente_nome text,
  vendedor_nome text, estado_pagamento text, metodo text, subtotal_centimos bigint,
  desconto_centimos bigint, entrega_centimos bigint, total_centimos bigint,
  comissao_snapshot_centimos bigint, comissao_efetiva_centimos bigint,
  valor_vendedor_snapshot_centimos bigint, valor_vendedor_efetivo_centimos bigint,
  total_reembolsado_centimos bigint, estado_repasse text, referencia_interna text,
  criado_em timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  return query
  select p.id, p.encomenda_id, e.codigo_publico, c.nome, v.nome_comercial,
    p.estado, t.metodo, p.subtotal_centimos, p.desconto_centimos, p.entrega_centimos,
    p.total_cliente_centimos, p.comissao_angrolink_centimos, x.comissao_efetiva_centimos,
    p.valor_vendedor_centimos, x.valor_vendedor_efetivo_centimos,
    x.reembolso_total_aprovado_centimos, r.estado, p.referencia_interna, p.criado_em
  from public.pagamentos p
  join public.encomendas e on e.id = p.encomenda_id
  join public.clientes c on c.id = p.cliente_id
  join public.vendedores v on v.id = p.vendedor_id
  join lateral public.calcular_valores_financeiros_efetivos(p.id) x on true
  left join lateral (
    select tt.metodo from public.tentativas_pagamento tt
    where tt.pagamento_id = p.id order by tt.criado_em desc limit 1
  ) t on true
  left join public.repasses_vendedor r on r.pagamento_id = p.id
  order by p.criado_em desc;
end;
$$;

create or replace function public.listar_disputas_admin(p_estado text default null)
returns table (
  disputa_id uuid, encomenda_id uuid, codigo_publico text, cliente_nome text,
  vendedor_nome text, tipo_problema text, estado text, descricao_resumida text,
  valor_reclamado_centimos bigint, pagamento_id uuid, criado_em timestamptz,
  atualizado_em timestamptz, responsavel_admin_id uuid
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  return query
  select d.id, d.encomenda_id, e.codigo_publico, c.nome, v.nome_comercial,
    d.tipo_problema, d.estado, left(d.descricao, 240), d.valor_reclamado_centimos,
    d.pagamento_id, d.criado_em, d.atualizado_em, d.analisado_por
  from public.disputas_encomenda d
  join public.encomendas e on e.id = d.encomenda_id
  join public.clientes c on c.id = d.cliente_id
  join public.vendedores v on v.id = d.vendedor_id
  where p_estado is null or d.estado = p_estado
  order by d.atualizado_em desc;
end;
$$;

create or replace function public.obter_encomenda_admin(p_encomenda_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_resultado jsonb;
begin
  if not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  select jsonb_build_object(
    'encomenda', jsonb_build_object(
      'id', e.id, 'codigo_publico', e.codigo_publico, 'estado', e.estado,
      'modalidade', e.modalidade_recebimento, 'criado_em', e.criado_em,
      'atualizado_em', e.atualizado_em, 'observacoes_cliente', e.observacoes_cliente
    ),
    'cliente', jsonb_build_object('id', c.id, 'nome', c.nome, 'email', c.email, 'telefone', c.telefone),
    'vendedor', jsonb_build_object(
      'id', v.id, 'nome_comercial', v.nome_comercial,
      'telefone', coalesce(v.telefone_whatsapp, v.whatsapp), 'estado', v.status_aprovacao
    ),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nome', i.nome_produto_snapshot, 'quantidade', i.quantidade,
        'unidade', i.unidade, 'valor_unitario_centimos', i.valor_unitario_centimos,
        'subtotal_centimos', i.subtotal_centimos, 'tipo_preco', i.tipo_preco_snapshot
      ) order by i.criado_em)
      from public.itens_encomenda i where i.encomenda_id = e.id
    ), '[]'::jsonb),
    'eventos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tipo', x.tipo_evento, 'ator', x.ator_tipo,
        'estado_anterior', x.estado_anterior, 'estado_novo', x.estado_novo,
        'criado_em', x.criado_em, 'metadados', x.metadados
      ) order by x.criado_em)
      from public.eventos_encomenda x where x.encomenda_id = e.id
    ), '[]'::jsonb),
    'financeiro', coalesce((
      select jsonb_build_object(
        'pagamento_id', p.id, 'estado', p.estado,
        'subtotal_centimos', p.subtotal_centimos, 'desconto_centimos', p.desconto_centimos,
        'entrega_centimos', p.entrega_centimos, 'total_centimos', p.total_cliente_centimos,
        'comissao_snapshot_centimos', p.comissao_angrolink_centimos,
        'comissao_efetiva_centimos', f.comissao_efetiva_centimos,
        'valor_vendedor_snapshot_centimos', p.valor_vendedor_centimos,
        'valor_vendedor_efetivo_centimos', f.valor_vendedor_efetivo_centimos,
        'reembolsos', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', rr.id, 'estado', rr.estado, 'valor_centimos', rr.valor_aprovado_centimos,
            'criado_em', rr.criado_em
          )) from public.reembolsos_pagamento rr where rr.pagamento_id = p.id
        ), '[]'::jsonb),
        'repasse_estado', rp.estado
      )
      from public.pagamentos p
      join lateral public.calcular_valores_financeiros_efetivos(p.id) f on true
      left join public.repasses_vendedor rp on rp.pagamento_id = p.id
      where p.encomenda_id = e.id
    ), '{}'::jsonb),
    'disputa', coalesce((
      select jsonb_build_object(
        'id', d.id, 'estado', d.estado, 'tipo', d.tipo_problema,
        'descricao', d.descricao, 'decisao', d.decisao,
        'analisado_por', d.analisado_por, 'analisado_em', d.analisado_em,
        'resolvido_em', d.resolvido_em
      ) from public.disputas_encomenda d
      where d.encomenda_id = e.id order by d.criado_em desc limit 1
    ), '{}'::jsonb)
  ) into v_resultado
  from public.encomendas e
  join public.clientes c on c.id = e.cliente_id
  join public.vendedores v on v.id = e.vendedor_id
  where e.id = p_encomenda_id;

  if v_resultado is null then raise exception 'Encomenda não encontrada.'; end if;
  return v_resultado;
end;
$$;

create or replace function public.obter_disputa_admin(p_disputa_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_resultado jsonb;
begin
  if not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  select jsonb_build_object(
    'disputa', jsonb_build_object(
      'id', d.id, 'estado', d.estado, 'tipo', d.tipo_problema,
      'descricao', d.descricao, 'valor_reclamado_centimos', d.valor_reclamado_centimos,
      'criado_em', d.criado_em, 'atualizado_em', d.atualizado_em,
      'analisado_por', d.analisado_por, 'analisado_em', d.analisado_em,
      'resolvido_por', d.resolvido_por, 'resolvido_em', d.resolvido_em,
      'decisao', d.decisao, 'observacao_resolucao', d.observacao_resolucao
    ),
    'encomenda', public.obter_encomenda_admin(d.encomenda_id),
    'auditoria', coalesce((
      select jsonb_agg(jsonb_build_object(
        'acao', a.acao, 'estado_anterior', a.estado_anterior,
        'estado_novo', a.estado_novo, 'motivo', a.motivo, 'criado_em', a.criado_em
      ) order by a.criado_em)
      from public.auditoria_administrativa a
      where a.entidade_tipo = 'disputa' and a.entidade_id = d.id
    ), '[]'::jsonb)
  ) into v_resultado
  from public.disputas_encomenda d
  where d.id = p_disputa_id;

  if v_resultado is null then raise exception 'Disputa não encontrada.'; end if;
  return v_resultado;
end;
$$;

create or replace function public.assumir_disputa_admin(p_disputa_id uuid)
returns public.disputas_encomenda
language plpgsql security definer set search_path = public
as $$
declare v_disputa public.disputas_encomenda%rowtype;
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  select * into v_disputa from public.disputas_encomenda where id = p_disputa_id for update;
  if not found then raise exception 'Disputa não encontrada.'; end if;
  if v_disputa.estado <> 'aberta' then raise exception 'A disputa já não pode ser assumida.'; end if;

  update public.disputas_encomenda
  set estado = 'em_analise', analisado_por = auth.uid(), analisado_em = now()
  where id = v_disputa.id returning * into v_disputa;

  insert into public.auditoria_administrativa(
    admin_user_id, entidade_tipo, entidade_id, acao, estado_anterior, estado_novo
  ) values (auth.uid(), 'disputa', v_disputa.id, 'disputa_assumida', 'aberta', 'em_analise');
  return v_disputa;
end;
$$;

create or replace function public.resolver_disputa_sem_reembolso_admin(
  p_disputa_id uuid,
  p_observacao text
)
returns public.disputas_encomenda
language plpgsql security definer set search_path = public
as $$
declare v_disputa public.disputas_encomenda%rowtype;
declare v_observacao text := nullif(btrim(p_observacao), '');
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if v_observacao is null or char_length(v_observacao) not between 3 and 1000 then
    raise exception 'Indique uma observação entre 3 e 1000 caracteres.';
  end if;
  select * into v_disputa from public.disputas_encomenda where id = p_disputa_id for update;
  if not found or v_disputa.estado <> 'em_analise' then raise exception 'A disputa não está em análise.'; end if;

  update public.disputas_encomenda
  set estado = 'resolvida_sem_reembolso', decisao = v_observacao,
    observacao_resolucao = v_observacao, resolvido_por = auth.uid(), resolvido_em = now()
  where id = v_disputa.id returning * into v_disputa;

  insert into public.auditoria_administrativa(
    admin_user_id, entidade_tipo, entidade_id, acao, estado_anterior, estado_novo, motivo
  ) values (
    auth.uid(), 'disputa', v_disputa.id, 'disputa_resolvida_sem_reembolso',
    'em_analise', v_disputa.estado, v_observacao
  );
  return v_disputa;
end;
$$;

create or replace function public.resolver_disputa_reembolso_parcial_admin(
  p_disputa_id uuid,
  p_valor_produtos_centimos bigint,
  p_valor_entrega_centimos bigint,
  p_valor_taxa_processador_centimos bigint,
  p_observacao text,
  p_chave_idempotencia uuid
)
returns public.disputas_encomenda
language plpgsql security definer set search_path = public
as $$
declare
  v_disputa public.disputas_encomenda%rowtype;
  v_pagamento public.pagamentos%rowtype;
  v_reembolso public.reembolsos_pagamento%rowtype;
  v_observacao text := nullif(btrim(p_observacao), '');
  v_produtos bigint := coalesce(p_valor_produtos_centimos, 0);
  v_entrega bigint := coalesce(p_valor_entrega_centimos, 0);
  v_taxa bigint := coalesce(p_valor_taxa_processador_centimos, 0);
  v_total bigint;
  v_referencia text;
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if v_observacao is null or char_length(v_observacao) not between 3 and 1000 or p_chave_idempotencia is null then
    raise exception 'Indique observação válida e chave de idempotência.';
  end if;
  if v_produtos < 0 or v_entrega < 0 then raise exception 'Os componentes do reembolso não podem ser negativos.'; end if;
  -- Política V1: a taxa do processador não é reembolsável, nem parcialmente.
  if v_taxa <> 0 then
    raise exception 'A política atual não permite reembolsar a taxa do processador.';
  end if;
  v_total := v_produtos + v_entrega;
  if v_total <= 0 then raise exception 'O reembolso parcial deve ser superior a zero.'; end if;

  -- A chave é consultada antes de exigir em_analise para suportar retry após sucesso.
  select * into v_disputa from public.disputas_encomenda where id = p_disputa_id;
  if not found then raise exception 'Disputa não encontrada.'; end if;
  select * into v_reembolso from public.reembolsos_pagamento where chave_idempotencia = p_chave_idempotencia;
  if found then
    if v_reembolso.pagamento_id <> v_disputa.pagamento_id
      or v_reembolso.valor_produtos_aprovado_centimos <> v_produtos
      or v_reembolso.valor_entrega_aprovado_centimos <> v_entrega
      or v_reembolso.valor_taxa_processador_aprovado_centimos <> v_taxa
      or v_reembolso.motivo <> v_observacao
      or v_disputa.estado <> 'resolvida_reembolso_parcial' then
      raise exception 'A chave de idempotência já foi usada com dados diferentes.';
    end if;
    return v_disputa;
  end if;

  select * into v_disputa from public.disputas_encomenda where id = p_disputa_id for update;
  if not found then raise exception 'Disputa não encontrada.'; end if;
  if v_disputa.estado <> 'em_analise' then
    select * into v_reembolso from public.reembolsos_pagamento where chave_idempotencia = p_chave_idempotencia;
    if found
      and v_reembolso.pagamento_id = v_disputa.pagamento_id
      and v_reembolso.valor_produtos_aprovado_centimos = v_produtos
      and v_reembolso.valor_entrega_aprovado_centimos = v_entrega
      and v_reembolso.valor_taxa_processador_aprovado_centimos = v_taxa
      and v_reembolso.motivo = v_observacao
      and v_disputa.estado = 'resolvida_reembolso_parcial' then
      return v_disputa;
    end if;
    raise exception 'A disputa não está em análise.';
  end if;

  select * into v_pagamento from public.pagamentos where id = v_disputa.pagamento_id for update;
  if not found then raise exception 'Pagamento não encontrado.'; end if;
  v_referencia := 'RMB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));

  begin
    insert into public.reembolsos_pagamento (
      pagamento_id, encomenda_id, estado, motivo,
      valor_solicitado_centimos, valor_produtos_solicitado_centimos,
      valor_entrega_solicitado_centimos, valor_taxa_processador_solicitado_centimos,
      valor_aprovado_centimos, valor_produtos_aprovado_centimos,
      valor_entrega_aprovado_centimos, valor_taxa_processador_aprovado_centimos,
      referencia_interna, chave_idempotencia, solicitado_por, aprovado_por, aprovado_em
    ) values (
      v_pagamento.id, v_pagamento.encomenda_id, 'aprovado', v_observacao,
      v_total, v_produtos, v_entrega, 0, v_total, v_produtos, v_entrega, 0,
      v_referencia, p_chave_idempotencia, auth.uid(), auth.uid(), now()
    );
  exception when unique_violation then
    select * into v_reembolso from public.reembolsos_pagamento where chave_idempotencia = p_chave_idempotencia;
    select * into v_disputa from public.disputas_encomenda where id = p_disputa_id;
    if found
      and v_reembolso.pagamento_id = v_pagamento.id
      and v_reembolso.valor_produtos_aprovado_centimos = v_produtos
      and v_reembolso.valor_entrega_aprovado_centimos = v_entrega
      and v_reembolso.valor_taxa_processador_aprovado_centimos = v_taxa
      and v_reembolso.motivo = v_observacao
      and v_disputa.estado = 'resolvida_reembolso_parcial' then
      return v_disputa;
    end if;
    raise;
  end;

  update public.disputas_encomenda
  set estado = 'resolvida_reembolso_parcial', decisao = v_observacao,
    observacao_resolucao = v_observacao, resolvido_por = auth.uid(), resolvido_em = now()
  where id = v_disputa.id returning * into v_disputa;

  insert into public.auditoria_administrativa(
    admin_user_id, entidade_tipo, entidade_id, acao, estado_anterior, estado_novo, motivo, metadados
  ) values (
    auth.uid(), 'disputa', v_disputa.id, 'disputa_resolvida_reembolso_parcial',
    'em_analise', v_disputa.estado, v_observacao,
    jsonb_build_object('valor_aprovado_centimos', v_total)
  );
  return v_disputa;
end;
$$;

create or replace function public.resolver_disputa_reembolso_total_admin(
  p_disputa_id uuid,
  p_observacao text,
  p_chave_idempotencia uuid
)
returns public.disputas_encomenda
language plpgsql security definer set search_path = public
as $$
declare
  v_disputa public.disputas_encomenda%rowtype;
  v_pagamento public.pagamentos%rowtype;
  v_reembolso public.reembolsos_pagamento%rowtype;
  v_observacao text := nullif(btrim(p_observacao), '');
  v_produtos bigint;
  v_entrega bigint;
  v_total bigint;
  v_referencia text;
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if v_observacao is null or char_length(v_observacao) not between 3 and 1000 or p_chave_idempotencia is null then
    raise exception 'Indique observação válida e chave de idempotência.';
  end if;

  -- Retry só é válido se esta chave já tiver resolvido esta mesma disputa como total.
  select * into v_disputa from public.disputas_encomenda where id = p_disputa_id;
  if not found then raise exception 'Disputa não encontrada.'; end if;
  select * into v_reembolso from public.reembolsos_pagamento where chave_idempotencia = p_chave_idempotencia;
  if found then
    if v_reembolso.pagamento_id <> v_disputa.pagamento_id
      or v_reembolso.motivo <> v_observacao
      or v_reembolso.valor_taxa_processador_aprovado_centimos <> 0
      or v_disputa.estado <> 'resolvida_reembolso_total' then
      raise exception 'A chave de idempotência já foi usada com dados diferentes.';
    end if;
    return v_disputa;
  end if;

  select * into v_disputa from public.disputas_encomenda where id = p_disputa_id for update;
  if not found then raise exception 'Disputa não encontrada.'; end if;
  if v_disputa.estado <> 'em_analise' then
    select * into v_reembolso from public.reembolsos_pagamento where chave_idempotencia = p_chave_idempotencia;
    if found
      and v_reembolso.pagamento_id = v_disputa.pagamento_id
      and v_reembolso.motivo = v_observacao
      and v_reembolso.valor_taxa_processador_aprovado_centimos = 0
      and v_disputa.estado = 'resolvida_reembolso_total' then
      return v_disputa;
    end if;
    raise exception 'A disputa não está em análise.';
  end if;

  select * into v_pagamento from public.pagamentos where id = v_disputa.pagamento_id for update;
  if not found then raise exception 'Pagamento não encontrado.'; end if;
  select
    (v_pagamento.subtotal_centimos - v_pagamento.desconto_centimos)
      - coalesce(sum(r.valor_produtos_aprovado_centimos) filter (where r.estado in ('aprovado', 'processando', 'concluido')), 0),
    v_pagamento.entrega_centimos
      - coalesce(sum(r.valor_entrega_aprovado_centimos) filter (where r.estado in ('aprovado', 'processando', 'concluido')), 0)
  into v_produtos, v_entrega
  from public.reembolsos_pagamento r
  where r.pagamento_id = v_pagamento.id;

  v_total := v_produtos + v_entrega;
  if v_total <= 0 then raise exception 'Não existe valor elegível restante para reembolso total.'; end if;
  v_referencia := 'RMB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));

  begin
    insert into public.reembolsos_pagamento (
      pagamento_id, encomenda_id, estado, motivo,
      valor_solicitado_centimos, valor_produtos_solicitado_centimos,
      valor_entrega_solicitado_centimos, valor_taxa_processador_solicitado_centimos,
      valor_aprovado_centimos, valor_produtos_aprovado_centimos,
      valor_entrega_aprovado_centimos, valor_taxa_processador_aprovado_centimos,
      referencia_interna, chave_idempotencia, solicitado_por, aprovado_por, aprovado_em
    ) values (
      v_pagamento.id, v_pagamento.encomenda_id, 'aprovado', v_observacao,
      v_total, v_produtos, v_entrega, 0, v_total, v_produtos, v_entrega, 0,
      v_referencia, p_chave_idempotencia, auth.uid(), auth.uid(), now()
    );
  exception when unique_violation then
    select * into v_reembolso from public.reembolsos_pagamento where chave_idempotencia = p_chave_idempotencia;
    select * into v_disputa from public.disputas_encomenda where id = p_disputa_id;
    if found
      and v_reembolso.pagamento_id = v_pagamento.id
      and v_reembolso.motivo = v_observacao
      and v_reembolso.valor_taxa_processador_aprovado_centimos = 0
      and v_disputa.estado = 'resolvida_reembolso_total' then
      return v_disputa;
    end if;
    raise;
  end;

  update public.disputas_encomenda
  set estado = 'resolvida_reembolso_total', decisao = v_observacao,
    observacao_resolucao = v_observacao, resolvido_por = auth.uid(), resolvido_em = now()
  where id = v_disputa.id returning * into v_disputa;

  insert into public.auditoria_administrativa(
    admin_user_id, entidade_tipo, entidade_id, acao, estado_anterior, estado_novo, motivo, metadados
  ) values (
    auth.uid(), 'disputa', v_disputa.id, 'disputa_resolvida_reembolso_total',
    'em_analise', v_disputa.estado, v_observacao,
    jsonb_build_object(
      'valor_produtos_centimos', v_produtos,
      'valor_entrega_centimos', v_entrega,
      'taxa_processador_centimos', 0
    )
  );
  return v_disputa;
end;
$$;

revoke all on function
  public.listar_encomendas_admin(text, uuid, uuid, text, boolean, timestamptz, timestamptz),
  public.obter_encomenda_admin(uuid),
  public.listar_financeiro_admin(),
  public.listar_disputas_admin(text),
  public.obter_disputa_admin(uuid),
  public.assumir_disputa_admin(uuid),
  public.resolver_disputa_sem_reembolso_admin(uuid, text),
  public.resolver_disputa_reembolso_parcial_admin(uuid, bigint, bigint, bigint, text, uuid),
  public.resolver_disputa_reembolso_total_admin(uuid, text, uuid)
from public, anon;

grant execute on function
  public.listar_encomendas_admin(text, uuid, uuid, text, boolean, timestamptz, timestamptz),
  public.obter_encomenda_admin(uuid),
  public.listar_financeiro_admin(),
  public.listar_disputas_admin(text),
  public.obter_disputa_admin(uuid),
  public.assumir_disputa_admin(uuid),
  public.resolver_disputa_sem_reembolso_admin(uuid, text),
  public.resolver_disputa_reembolso_parcial_admin(uuid, bigint, bigint, bigint, text, uuid),
  public.resolver_disputa_reembolso_total_admin(uuid, text, uuid)
to authenticated;

commit;
