begin;

-- Autoridade única para a taxonomia e território operacional da Fase 1.
-- A subcategoria NULL é deliberadamente suportada para produtos legados: a
-- configuração-pai define o estado sem tentar inferir texto histórico.
create or replace function public.produto_eh_operacional_fase1(
  p_categoria_id uuid,
  p_subcategoria_id uuid,
  p_provincia_texto text,
  p_vendedor_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.categorias c
    join public.vendedores v on v.id = p_vendedor_id
    join public.provincias_angola h
      on h.codigo_oficial = 'HBO'
      and h.ativo = true
    cross join lateral public.obter_estado_operacional_catalogo_produto(
      h.id,
      p_categoria_id,
      p_subcategoria_id
    ) estado_operacional
    where c.id = p_categoria_id
      and public.normalizar_texto_territorial(c.nome)
        <> public.normalizar_texto_territorial('Serviços')
      and public.normalizar_texto_territorial(p_provincia_texto)
        = public.normalizar_texto_territorial(h.nome)
      and public.normalizar_texto_territorial(v.provincia)
        = public.normalizar_texto_territorial(h.nome)
      and estado_operacional.estado in ('ativa', 'experimental')
  );
$$;

create or replace function public.destino_entrega_eh_operacional_fase1(
  p_provincia text,
  p_municipio text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.resolver_territorio_angola(p_provincia, p_municipio) territorio
    where territorio.provincia_codigo = 'HBO'
  );
$$;

-- A função é interna aos checkouts modernos. Mantém os erros comerciais já
-- existentes para produto inexistente, indisponível ou vendedor não elegível;
-- só antecipa a rejeição quando uma linha existente viola o gate Fase 1.
create or replace function public.validar_itens_checkout_operacionais_fase1(
  p_itens jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_item jsonb;
  v_produto_id uuid;
  v_produto record;
begin
  for v_item in select value from jsonb_array_elements(p_itens) loop
    v_produto_id := (v_item ->> 'produto_id')::uuid;

    select
      p.id,
      p.categoria_id,
      p.subcategoria_id,
      p.provincia,
      p.vendedor_id
    into v_produto
    from public.produtos p
    where p.id = v_produto_id
    for share;

    -- A RPC de checkout preexistente continua responsável por produto
    -- inexistente, publicado/disponível e elegibilidade comercial do vendedor.
    if found and not public.produto_eh_operacional_fase1(
      v_produto.categoria_id,
      v_produto.subcategoria_id,
      v_produto.provincia,
      v_produto.vendedor_id
    ) then
      raise exception 'Este produto não está operacional para a Fase 1 no Huambo.';
    end if;
  end loop;
end;
$$;

create or replace function public.proteger_operacao_produto_fase1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.subcategoria_id is not null and not exists (
    select 1
    from public.subcategorias_produto s
    where s.id = new.subcategoria_id
      and s.categoria_id = new.categoria_id
  ) then
    raise exception 'A subcategoria selecionada não pertence à categoria do produto.';
  end if;

  -- Serviços não entram no domínio de produtos novos. Linhas históricas já
  -- existentes permanecem preservadas enquanto não forem reclassificadas.
  if (tg_op = 'INSERT' or new.categoria_id is distinct from old.categoria_id)
    and exists (
      select 1
      from public.categorias c
      where c.id = new.categoria_id
        and public.normalizar_texto_territorial(c.nome)
          = public.normalizar_texto_territorial('Serviços')
    ) then
    raise exception 'A categoria Serviços não pode ser usada para produtos.';
  end if;

  -- Um novo produto só nasce operacional no Huambo. Em updates, a exigência
  -- ocorre somente quando pode haver exposição/reativação: publicar, voltar a
  -- disponibilizar ou alterar a taxonomia/território/vendedor de um publicado.
  if tg_op = 'INSERT' then
    if not public.produto_eh_operacional_fase1(
      new.categoria_id,
      new.subcategoria_id,
      new.provincia,
      new.vendedor_id
    ) then
      raise exception 'O produto deve pertencer a uma categoria operacional e ao Huambo para a Fase 1.';
    end if;
  elsif coalesce(new.publicado, false)
    and (
      coalesce(old.publicado, false) = false
      or coalesce(old.disponivel, false) = false and coalesce(new.disponivel, false) = true
      or new.categoria_id is distinct from old.categoria_id
      or new.subcategoria_id is distinct from old.subcategoria_id
      or new.provincia is distinct from old.provincia
      or new.vendedor_id is distinct from old.vendedor_id
    ) then
    if not public.produto_eh_operacional_fase1(
      new.categoria_id,
      new.subcategoria_id,
      new.provincia,
      new.vendedor_id
    ) then
      raise exception 'O produto deve pertencer a uma categoria operacional e ao Huambo para a Fase 1.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_operacao_produto_fase1 on public.produtos;
create trigger proteger_operacao_produto_fase1
before insert or update of categoria_id, subcategoria_id, provincia, vendedor_id, publicado, disponivel
on public.produtos
for each row execute function public.proteger_operacao_produto_fase1();

-- O staging contém duas policies SELECT públicas permissivas. Ambas precisam
-- ser substituídas; manter qualquer uma faria OR com o novo gate e exporia os
-- produtos dormentes apesar da policy canónica abaixo.
drop policy if exists "catalogo_publico" on public.produtos;
drop policy if exists "produtos publicos apenas de vendedores aprovados" on public.produtos;
create policy "catalogo_publico"
  on public.produtos
  for select
  to anon, authenticated
  using (
    publicado = true
    and disponivel = true
    and public.is_vendedor_publico_aprovado(vendedor_id)
    and public.produto_eh_operacional_fase1(
      categoria_id,
      subcategoria_id,
      provincia,
      vendedor_id
    )
  );

-- A leitura pÃºblica nÃ£o consulta a tabela directamente. A policy privada
-- `produtos_gerir_proprios` Ã© permissiva por desenho para o dashboard do
-- vendedor/Admin; por isso nÃ£o pode ser o boundary do catÃ¡logo. Esta projecÃ§Ã£o
-- aplica o gate completo no prÃ³prio contrato, independentemente de auth.uid().
create or replace function public.listar_produtos_publicos_fase1(
  p_produto_id uuid default null,
  p_produto_ids uuid[] default null,
  p_vendedor_id uuid default null,
  p_categoria_id uuid default null,
  p_categoria_ids uuid[] default null,
  p_provincia text default null,
  p_municipio text default null,
  p_localizacao_ou boolean default false,
  p_pesquisa text default null,
  p_excluir_produto_id uuid default null,
  p_ordenar_por_destaque boolean default false,
  p_limite integer default 100
)
returns setof jsonb
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select jsonb_build_object(
    'id', p.id,
    'vendedor_id', p.vendedor_id,
    'categoria_id', p.categoria_id,
    'nome_produto', p.nome_produto,
    'descricao', p.descricao,
    'preco_aproximado', p.preco_aproximado,
    'preco_grosso', p.preco_grosso,
    'preco_promocional', p.preco_promocional,
    'unidade', p.unidade,
    'tipo_venda', p.tipo_venda,
    'quantidade_minima', p.quantidade_minima,
    'quantidade_minima_grosso', p.quantidade_minima_grosso,
    'imagem_url', p.imagem_url,
    'disponivel', p.disponivel,
    'destaque', p.destaque,
    'provincia', p.provincia,
    'municipio', p.municipio,
    'subcategoria', p.subcategoria,
    'criado_em', p.criado_em,
    'atualizado_em', p.atualizado_em,
    'visualizacoes', p.visualizacoes,
    'cliques_whatsapp', p.cliques_whatsapp,
    'categoria', case when c.id is null then null else jsonb_build_object(
      'id', c.id,
      'nome', c.nome
    ) end,
    'vendedor', jsonb_build_object(
      'id', v.id,
      'nome_comercial', v.nome_comercial,
      'descricao', v.descricao,
      'telefone_whatsapp', v.telefone_whatsapp,
      'whatsapp', v.whatsapp,
      'provincia', v.provincia,
      'municipio', v.municipio,
      'bairro', v.bairro,
      'tipo_vendedor', v.tipo_vendedor,
      'verificado', v.verificado,
      'foto_perfil', v.foto_perfil,
      'entrega_disponivel', v.entrega_disponivel,
      'venda_grosso', v.venda_grosso,
      'venda_retalho', v.venda_retalho,
      'criado_em', v.criado_em
    )
  )
  from public.produtos p
  join public.vendedores v on v.id = p.vendedor_id
  left join public.categorias c on c.id = p.categoria_id
  where p.publicado = true
    and p.disponivel = true
    and public.is_vendedor_publico_aprovado(p.vendedor_id)
    and public.produto_eh_operacional_fase1(
      p.categoria_id,
      p.subcategoria_id,
      p.provincia,
      p.vendedor_id
    )
    and (p_produto_id is null or p.id = p_produto_id)
    and (p_produto_ids is null or cardinality(p_produto_ids) = 0 or p.id = any(p_produto_ids))
    and (p_vendedor_id is null or p.vendedor_id = p_vendedor_id)
    and (p_categoria_id is null or p.categoria_id = p_categoria_id)
    and (p_categoria_ids is null or cardinality(p_categoria_ids) = 0 or p.categoria_id = any(p_categoria_ids))
    and (p_excluir_produto_id is null or p.id <> p_excluir_produto_id)
    and (
      p_pesquisa is null
      or btrim(p_pesquisa) = ''
      or p.nome_produto ilike '%' || btrim(p_pesquisa) || '%'
    )
    and (
      p_provincia is null
      or (
        case when p_localizacao_ou and p_municipio is not null then
          p.provincia ilike '%' || btrim(p_provincia) || '%'
          or p.municipio ilike '%' || btrim(p_municipio) || '%'
        else p.provincia ilike '%' || btrim(p_provincia) || '%'
        end
      )
    )
    and (
      p_municipio is null
      or p_localizacao_ou
      or p.municipio ilike '%' || btrim(p_municipio) || '%'
    )
  order by
    case when p_ordenar_por_destaque then coalesce(p.destaque, false) else false end desc,
    p.criado_em desc nulls last
  limit least(greatest(coalesce(p_limite, 100), 1), 100);
$$;

-- Preserva integralmente os wrappers idempotentes aplicados: o retry legítimo
-- retorna antes de novos gates e nenhum preço ou cálculo é aceito do browser.
create or replace function public.criar_encomenda_levantamento(
  p_itens jsonb,
  p_modalidade text,
  p_nome_destinatario text,
  p_telefone_destinatario text,
  p_observacoes_cliente text,
  p_idempotency_key uuid
)
returns public.encomendas
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_itens jsonb;
  v_hash text;
  v_registo public.idempotencia_checkout_encomenda%rowtype;
  v_encomenda public.encomendas%rowtype;
  v_pagamento_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão antes de criar a encomenda.';
  end if;
  if p_idempotency_key is null then
    raise exception 'Não foi possível identificar esta tentativa de encomenda. Tente novamente.';
  end if;
  if coalesce(btrim(p_modalidade), '') <> 'levantamento' then
    raise exception 'A entrega ainda não está disponível. Escolha levantamento no local.';
  end if;

  v_itens := public.normalizar_itens_checkout_idempotencia(p_itens);
  v_hash := public.calcular_hash_intencao_checkout(jsonb_build_object(
    'modalidade_recebimento', 'levantamento',
    'itens', v_itens,
    'destinatario_nome', nullif(btrim(p_nome_destinatario), ''),
    'destinatario_telefone', nullif(btrim(p_telefone_destinatario), ''),
    'observacoes_cliente', nullif(btrim(p_observacoes_cliente), '')
  ));

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':levantamento:' || p_idempotency_key::text, 0));
  select * into v_registo
  from public.idempotencia_checkout_encomenda
  where cliente_id = auth.uid()
    and modalidade_recebimento = 'levantamento'
    and chave_idempotencia = p_idempotency_key
  for update;

  if found then
    if v_registo.payload_hash <> v_hash then
      raise exception 'Esta chave de idempotência já foi usada com dados diferentes.';
    end if;
    if v_registo.encomenda_id is null then
      raise exception 'Esta tentativa de encomenda ainda está a ser processada. Tente novamente.';
    end if;
    select * into v_encomenda from public.encomendas where id = v_registo.encomenda_id;
    if not found then
      raise exception 'Não foi possível recuperar a encomenda desta tentativa.';
    end if;
    return v_encomenda;
  end if;

  perform public.validar_itens_checkout_operacionais_fase1(v_itens);
  perform public.garantir_perfil_comprador();
  insert into public.idempotencia_checkout_encomenda (
    cliente_id, modalidade_recebimento, chave_idempotencia, payload_hash
  ) values (auth.uid(), 'levantamento', p_idempotency_key, v_hash);

  v_encomenda := public.criar_encomenda_levantamento(
    p_itens,
    p_modalidade,
    p_nome_destinatario,
    p_telefone_destinatario,
    p_observacoes_cliente
  );

  perform public.criar_pagamento_encomenda(v_encomenda.id, gen_random_uuid());
  select id into v_pagamento_id from public.pagamentos where encomenda_id = v_encomenda.id for update;
  if v_pagamento_id is null then
    raise exception 'Não foi possível preparar o pagamento desta encomenda.';
  end if;
  perform public.criar_tentativa_pagamento(v_pagamento_id, 'pagamento_no_levantamento', gen_random_uuid());

  update public.idempotencia_checkout_encomenda
  set encomenda_id = v_encomenda.id, concluida_em = now()
  where cliente_id = auth.uid()
    and modalidade_recebimento = 'levantamento'
    and chave_idempotencia = p_idempotency_key;

  return v_encomenda;
end;
$$;

create or replace function public.criar_encomenda_entrega(
  p_itens jsonb,
  p_destinatario_nome text,
  p_destinatario_telefone text,
  p_provincia text,
  p_municipio text,
  p_bairro text,
  p_endereco_detalhado text,
  p_ponto_referencia text,
  p_instrucoes_entrega text,
  p_observacoes text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_itens jsonb;
  v_hash text;
  v_registo public.idempotencia_checkout_encomenda%rowtype;
  v_resultado jsonb;
  v_encomenda public.encomendas%rowtype;
  v_pagamento public.pagamentos%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão antes de criar a encomenda.';
  end if;
  if p_idempotency_key is null then
    raise exception 'Não foi possível identificar esta tentativa de encomenda. Tente novamente.';
  end if;

  v_itens := public.normalizar_itens_checkout_idempotencia(p_itens);
  v_hash := public.calcular_hash_intencao_checkout(jsonb_build_object(
    'modalidade_recebimento', 'entrega',
    'itens', v_itens,
    'destinatario_nome', nullif(btrim(p_destinatario_nome), ''),
    'destinatario_telefone', nullif(btrim(p_destinatario_telefone), ''),
    'provincia', nullif(btrim(p_provincia), ''),
    'municipio', nullif(btrim(p_municipio), ''),
    'bairro', nullif(btrim(p_bairro), ''),
    'endereco_detalhado', nullif(btrim(p_endereco_detalhado), ''),
    'ponto_referencia', nullif(btrim(p_ponto_referencia), ''),
    'instrucoes_entrega', nullif(btrim(p_instrucoes_entrega), ''),
    'observacoes_cliente', nullif(btrim(p_observacoes), '')
  ));

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':entrega:' || p_idempotency_key::text, 0));
  select * into v_registo
  from public.idempotencia_checkout_encomenda
  where cliente_id = auth.uid()
    and modalidade_recebimento = 'entrega'
    and chave_idempotencia = p_idempotency_key
  for update;

  if found then
    if v_registo.payload_hash <> v_hash then
      raise exception 'Esta chave de idempotência já foi usada com dados diferentes.';
    end if;
    if v_registo.encomenda_id is null then
      raise exception 'Esta tentativa de encomenda ainda está a ser processada. Tente novamente.';
    end if;
    select * into v_encomenda from public.encomendas where id = v_registo.encomenda_id;
    select * into v_pagamento from public.pagamentos where encomenda_id = v_registo.encomenda_id;
    if not found or v_encomenda.id is null then
      raise exception 'Não foi possível recuperar a encomenda desta tentativa.';
    end if;
    return jsonb_build_object(
      'id', v_encomenda.id,
      'codigo_publico', v_encomenda.codigo_publico,
      'total_centimos', v_encomenda.total_centimos,
      'vendedor_id', v_encomenda.vendedor_id,
      'pagamento_id', v_pagamento.id,
      'estado_pagamento', v_pagamento.estado
    );
  end if;

  -- Mantém a mensagem histórica para território Angola inválido e acrescenta
  -- só o gate adicional de destino operacional Huambo.
  if not public.territorio_angola_valido(p_provincia, p_municipio) then
    raise exception 'A província e o município indicados não formam um território válido.';
  end if;
  if not public.destino_entrega_eh_operacional_fase1(p_provincia, p_municipio) then
    raise exception 'O destino da entrega deve pertencer ao Huambo durante a Fase 1.';
  end if;

  perform public.validar_itens_checkout_operacionais_fase1(v_itens);
  perform public.garantir_perfil_comprador();
  insert into public.idempotencia_checkout_encomenda (
    cliente_id, modalidade_recebimento, chave_idempotencia, payload_hash
  ) values (auth.uid(), 'entrega', p_idempotency_key, v_hash);

  v_resultado := public.criar_encomenda_entrega(
    p_itens,
    p_destinatario_nome,
    p_destinatario_telefone,
    p_provincia,
    p_municipio,
    p_bairro,
    p_endereco_detalhado,
    p_ponto_referencia,
    p_instrucoes_entrega,
    p_observacoes
  );

  update public.idempotencia_checkout_encomenda
  set encomenda_id = (v_resultado ->> 'id')::uuid, concluida_em = now()
  where cliente_id = auth.uid()
    and modalidade_recebimento = 'entrega'
    and chave_idempotencia = p_idempotency_key;

  return v_resultado;
end;
$$;

-- Os dois wrappers continuam públicos apenas para utilizadores autenticados;
-- helpers de gate são chamados pelo RLS, trigger ou checkout, nunca pelo browser.
revoke all on function public.produto_eh_operacional_fase1(uuid, uuid, text, uuid), public.destino_entrega_eh_operacional_fase1(text, text), public.validar_itens_checkout_operacionais_fase1(jsonb), public.proteger_operacao_produto_fase1() from public, anon, authenticated;
grant execute on function public.produto_eh_operacional_fase1(uuid, uuid, text, uuid) to anon, authenticated;
revoke all on function public.listar_produtos_publicos_fase1(uuid, uuid[], uuid, uuid, uuid[], text, text, boolean, text, uuid, boolean, integer) from public;
grant execute on function public.listar_produtos_publicos_fase1(uuid, uuid[], uuid, uuid, uuid[], text, text, boolean, text, uuid, boolean, integer) to anon, authenticated;
revoke all on function public.criar_encomenda_levantamento(jsonb, text, text, text, text, uuid), public.criar_encomenda_entrega(jsonb, text, text, text, text, text, text, text, text, text, uuid) from public, anon;
grant execute on function public.criar_encomenda_levantamento(jsonb, text, text, text, text, uuid), public.criar_encomenda_entrega(jsonb, text, text, text, text, text, text, text, text, text, uuid) to authenticated;

commit;
