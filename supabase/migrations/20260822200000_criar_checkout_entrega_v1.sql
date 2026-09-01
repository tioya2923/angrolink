-- ANGROLINK — checkout de entrega V1. Criação direta e transacional de entrega.
begin;

create or replace function public.criar_encomenda_entrega(p_itens jsonb,p_destinatario_nome text,p_destinatario_telefone text,p_provincia text,p_municipio text,p_bairro text,p_endereco_detalhado text,p_ponto_referencia text default null,p_instrucoes_entrega text default null,p_observacoes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente public.clientes%rowtype;
  v_item jsonb;
  v_produto record;
  v_produto_id uuid;
  v_quantidade numeric;
  v_preco numeric;
  v_tipo_venda text;
  v_tipo_preco text;
  v_minimo_retalho numeric;
  v_minimo_grosso numeric;
  v_valor_unitario_centimos bigint;
  v_subtotal_item_centimos bigint;
  v_subtotal_centimos bigint := 0;
  v_vendedor_id uuid := null;
  v_itens_preparados jsonb := '[]'::jsonb;
  v_codigo_publico text;
  v_tentativas integer := 0;
  v_encomenda public.encomendas%rowtype;
  v_destinatario_nome text;
  v_destinatario_telefone text;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão antes de criar a encomenda.';
  end if;

  if not public.territorio_angola_valido(p_provincia,p_municipio) then raise exception 'A província e o município indicados não formam um território válido.'; end if;
  if nullif(btrim(p_destinatario_nome),'') is null or nullif(btrim(p_destinatario_telefone),'') is null or nullif(btrim(p_bairro),'') is null or nullif(btrim(p_endereco_detalhado),'') is null then raise exception 'Indique nome, telefone, bairro e endereço detalhado para a entrega.'; end if;

  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Indique pelo menos um produto para a encomenda.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_itens) item
    group by item ->> 'produto_id'
    having count(*) > 1
  ) then
    raise exception 'Não repita o mesmo produto na encomenda.';
  end if;

  select * into v_cliente
  from public.clientes
  where id = auth.uid()
    and coalesce(conta_ativa, true) = true;

  if not found then
    raise exception 'É necessária uma conta de cliente ativa para criar encomendas.';
  end if;

  v_destinatario_nome := coalesce(nullif(btrim(p_destinatario_nome), ''), nullif(btrim(v_cliente.nome), ''));
  v_destinatario_telefone := coalesce(nullif(btrim(p_destinatario_telefone), ''), nullif(btrim(v_cliente.telefone), ''));
  if v_destinatario_nome is null or v_destinatario_telefone is null then
    raise exception 'Indique nome e telefone de contacto para a entrega.';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    if coalesce(jsonb_typeof(v_item), '') <> 'object'
      or nullif(btrim(v_item ->> 'produto_id'), '') is null
      or coalesce(jsonb_typeof(v_item -> 'quantidade'), '') <> 'number' then
      raise exception 'Cada item deve indicar produto e quantidade válidos.';
    end if;

    v_produto_id := (v_item ->> 'produto_id')::uuid;
    v_quantidade := (v_item ->> 'quantidade')::numeric;
    if v_quantidade <= 0 or v_quantidade <> trunc(v_quantidade, 3) then
      raise exception 'A quantidade deve ser superior a zero e ter no máximo três casas decimais.';
    end if;

    select
      p.id, p.vendedor_id, p.nome_produto, p.descricao, p.imagem_url,
      p.unidade, p.preco_aproximado, p.preco_promocional, p.preco_grosso,
      p.quantidade_minima, p.quantidade_minima_grosso,
      lower(btrim(coalesce(p.tipo_venda, 'retalho'))) as tipo_venda,
      v.status_aprovacao, v.conta_ativa, v.provincia, v.municipio,
      coalesce(v.bairro, v.mercado_bairro) as bairro,
      v.endereco_detalhado, v.mercado_bairro
    into v_produto
    from public.produtos p
    join public.vendedores v on v.id = p.vendedor_id
    where p.id = v_produto_id
      and p.publicado = true
      and p.disponivel = true
    for share of p, v;

    if not found then
      raise exception 'O produto selecionado não existe ou não está disponível.';
    end if;

    if v_produto.status_aprovacao <> 'aprovado' or coalesce(v_produto.conta_ativa, true) = false then
      raise exception 'O vendedor deste produto não está disponível para receber encomendas.';
    end if;

    v_tipo_venda := v_produto.tipo_venda;
    if v_tipo_venda not in ('retalho', 'grosso', 'ambos') then
      raise exception 'O produto possui um tipo de venda inválido.';
    end if;

    -- As unidades existentes já distinguem medidas contínuas das unidades
    -- comerciais indivisíveis. Não se cria aqui um motor de conversão.
    if lower(btrim(coalesce(v_produto.unidade, 'unidade'))) in ('unidade', 'animal', 'saco', 'caixa')
      and v_quantidade <> trunc(v_quantidade) then
      raise exception 'A unidade de venda deste produto aceita apenas quantidades inteiras.';
    end if;

    v_minimo_retalho := coalesce(v_produto.quantidade_minima, 1);
    if v_minimo_retalho <= 0 then
      raise exception 'O produto possui uma quantidade mínima de retalho inválida.';
    end if;

    -- Política transacional: promoção é uma condição do retalho. O grossista
    -- usa uma tabela independente quando ela está completa; nunca escolhemos
    -- silenciosamente o menor dos dois preços.
    if v_tipo_venda = 'retalho' then
      if v_quantidade < v_minimo_retalho then
        raise exception 'A quantidade solicitada é inferior ao mínimo de retalho definido para o produto.';
      end if;

      if v_produto.preco_promocional is not null
        and v_produto.preco_promocional > 0
        and (v_produto.preco_aproximado is null or v_produto.preco_promocional < v_produto.preco_aproximado) then
        v_preco := v_produto.preco_promocional;
        v_tipo_preco := 'promocional';
      else
        v_preco := v_produto.preco_aproximado;
        v_tipo_preco := 'normal';
      end if;

    elsif v_tipo_venda = 'grosso' then
      -- Nos produtos exclusivamente grossistas legados, o único campo de
      -- preço preenchido é frequentemente preco_aproximado, apesar do nome.
      -- Nesse contexto ele é o preço comercial de grosso já mostrado no site.
      v_minimo_grosso := coalesce(v_produto.quantidade_minima_grosso, v_minimo_retalho);
      if v_minimo_grosso <= 0 or v_quantidade < v_minimo_grosso then
        raise exception 'A quantidade solicitada é inferior ao mínimo de grosso definido para o produto.';
      end if;

      v_preco := coalesce(nullif(v_produto.preco_grosso, 0), v_produto.preco_aproximado);
      v_tipo_preco := 'grosso';

    else
      -- Um produto "ambos" só passa ao preço grossista quando preço e mínimo
      -- grossistas foram configurados. Caso contrário continua em retalho.
      if v_produto.preco_grosso is not null
        and v_produto.preco_grosso > 0
        and v_produto.quantidade_minima_grosso is not null
        and v_produto.quantidade_minima_grosso > 0
        and v_quantidade >= v_produto.quantidade_minima_grosso then
        v_preco := v_produto.preco_grosso;
        v_tipo_preco := 'grosso';
      else
        if v_quantidade < v_minimo_retalho then
          raise exception 'A quantidade solicitada é inferior ao mínimo de retalho definido para o produto.';
        end if;

        if v_produto.preco_promocional is not null
          and v_produto.preco_promocional > 0
          and (v_produto.preco_aproximado is null or v_produto.preco_promocional < v_produto.preco_aproximado) then
          v_preco := v_produto.preco_promocional;
          v_tipo_preco := 'promocional';
        else
          v_preco := v_produto.preco_aproximado;
          v_tipo_preco := 'normal';
        end if;
      end if;
    end if;

    if v_vendedor_id is null then
      v_vendedor_id := v_produto.vendedor_id;
    elsif v_vendedor_id <> v_produto.vendedor_id then
      raise exception 'Uma encomenda só pode conter produtos do mesmo vendedor.';
    end if;

    if v_preco is null or v_preco <= 0 then
      raise exception 'O produto selecionado não possui um preço comercial válido para este modo de venda.';
    end if;

    -- O catálogo usa numeric em Kwanzas. A conversão acontece no servidor,
    -- para cêntimos inteiros, e o subtotal da linha é arredondado uma única vez.
    v_valor_unitario_centimos := round(v_preco * 100)::bigint;
    v_subtotal_item_centimos := round(v_valor_unitario_centimos * v_quantidade)::bigint;
    v_subtotal_centimos := v_subtotal_centimos + v_subtotal_item_centimos;

    v_itens_preparados := v_itens_preparados || jsonb_build_array(jsonb_build_object(
      'produto_id', v_produto.id,
      'vendedor_id', v_produto.vendedor_id,
      'quantidade', v_quantidade,
      'unidade', coalesce(v_produto.unidade, 'unidade'),
      'tipo_preco_snapshot', v_tipo_preco,
      'valor_unitario_centimos', v_valor_unitario_centimos,
      'subtotal_centimos', v_subtotal_item_centimos,
      'nome_produto_snapshot', v_produto.nome_produto,
      'descricao_snapshot', v_produto.descricao,
      'imagem_principal_snapshot', v_produto.imagem_url,
      'provincia', v_produto.provincia,
      'municipio', v_produto.municipio,
      'bairro', v_produto.bairro,
      'endereco_levantamento', v_produto.endereco_detalhado,
      'ponto_referencia', v_produto.mercado_bairro
    ));
  end loop;

  loop
    v_tentativas := v_tentativas + 1;
    v_codigo_publico := public.gerar_codigo_publico_encomenda();
    begin
      insert into public.encomendas (
        codigo_publico, cliente_id, vendedor_id, modalidade_recebimento, moeda,
        subtotal_centimos, desconto_centimos, entrega_centimos, total_centimos,
        destinatario_nome, destinatario_telefone, provincia, municipio, bairro,
        endereco_levantamento, ponto_referencia,
        observacoes_cliente
      ) values (
        v_codigo_publico, v_cliente.id, v_vendedor_id, 'entrega', 'AOA',
        v_subtotal_centimos, 0, 0, v_subtotal_centimos,
        v_destinatario_nome, v_destinatario_telefone,
        (v_itens_preparados -> 0 ->> 'provincia'),
        (v_itens_preparados -> 0 ->> 'municipio'),
        (v_itens_preparados -> 0 ->> 'bairro'),
        (v_itens_preparados -> 0 ->> 'endereco_levantamento'),
        (v_itens_preparados -> 0 ->> 'ponto_referencia'),
        nullif(btrim(p_observacoes), '')
      ) returning * into v_encomenda;
      exit;
    exception when unique_violation then
      if v_tentativas >= 5 then
        raise exception 'Não foi possível gerar o código público da encomenda. Tente novamente.';
      end if;
    end;
  end loop;

  insert into public.enderecos_entrega_encomenda (encomenda_id,destinatario_nome,destinatario_telefone,provincia,municipio,bairro,endereco_detalhado,ponto_referencia,instrucoes_entrega) values (v_encomenda.id,v_destinatario_nome,v_destinatario_telefone,btrim(p_provincia),btrim(p_municipio),btrim(p_bairro),btrim(p_endereco_detalhado),nullif(btrim(p_ponto_referencia),''),nullif(btrim(p_instrucoes_entrega),''));

  insert into public.itens_encomenda (
    encomenda_id, produto_id, vendedor_id, quantidade, unidade, tipo_preco_snapshot,
    valor_unitario_centimos, subtotal_centimos, nome_produto_snapshot,
    descricao_snapshot, imagem_principal_snapshot
  )
  select
    v_encomenda.id,
    (item ->> 'produto_id')::uuid,
    (item ->> 'vendedor_id')::uuid,
    (item ->> 'quantidade')::numeric,
    item ->> 'unidade',
    item ->> 'tipo_preco_snapshot',
    (item ->> 'valor_unitario_centimos')::bigint,
    (item ->> 'subtotal_centimos')::bigint,
    item ->> 'nome_produto_snapshot',
    nullif(item ->> 'descricao_snapshot', ''),
    nullif(item ->> 'imagem_principal_snapshot', '')
  from jsonb_array_elements(v_itens_preparados) item;

  insert into public.eventos_encomenda (
    encomenda_id, tipo_evento, estado_novo, ator_tipo, utilizador_id, metadados
  ) values (
    v_encomenda.id, 'encomenda_criada', 'aguardando_confirmacao', 'cliente', auth.uid(),
    jsonb_build_object('quantidade_itens', jsonb_array_length(v_itens_preparados))
  );

  perform public.criar_pagamento_encomenda(v_encomenda.id,gen_random_uuid());
  perform public.criar_tentativa_pagamento((select id from public.pagamentos where encomenda_id=v_encomenda.id),'pagamento_na_entrega',gen_random_uuid());
  return jsonb_build_object('id',v_encomenda.id,'codigo_publico',v_encomenda.codigo_publico,'total_centimos',v_encomenda.total_centimos,'vendedor_id',v_encomenda.vendedor_id,'pagamento_id',(select id from public.pagamentos where encomenda_id=v_encomenda.id),'estado_pagamento','pendente');
end;
$$;

revoke all on function public.criar_encomenda_entrega(jsonb,text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.criar_encomenda_entrega(jsonb,text,text,text,text,text,text,text,text,text) to authenticated;
commit;
