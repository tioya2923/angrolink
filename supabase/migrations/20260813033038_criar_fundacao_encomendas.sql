-- ANGROLINK — fundação transacional de encomendas de produtos.
-- Esta migration inicia apenas o fluxo de levantamento no local. Entregas,
-- pagamentos, parceiros, stock reservado e serviços transacionáveis ficam
-- deliberadamente fora deste primeiro modelo.

begin;

create table public.encomendas (
  id uuid primary key default gen_random_uuid(),
  codigo_publico text not null unique check (codigo_publico ~ '^ANG-[0-9]{4}-[A-F0-9]{8}$'),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  vendedor_id uuid not null references public.vendedores(id) on delete restrict,
  estado text not null default 'aguardando_confirmacao' check (estado in (
    'aguardando_confirmacao', 'confirmada', 'em_preparacao',
    'pronta_para_levantamento', 'levantada', 'concluida', 'recusada', 'cancelada'
  )),
  -- A coluna está preparada para entrega futura, mas a constraint mantém o MVP
  -- operacionalmente honesto: nenhuma encomenda de entrega nasce sem logística.
  modalidade_recebimento text not null default 'levantamento'
    check (modalidade_recebimento in ('levantamento')),
  moeda char(3) not null default 'AOA' check (moeda = 'AOA'),
  subtotal_centimos bigint not null check (subtotal_centimos >= 0),
  desconto_centimos bigint not null default 0 check (desconto_centimos >= 0),
  entrega_centimos bigint not null default 0 check (entrega_centimos >= 0),
  total_centimos bigint not null check (total_centimos >= 0),
  constraint encomendas_desconto_nao_supera_subtotal check (
    desconto_centimos <= subtotal_centimos
  ),
  constraint encomendas_total_consistente check (
    total_centimos = subtotal_centimos - desconto_centimos + entrega_centimos
  ),
  destinatario_nome text not null,
  destinatario_telefone text not null,
  -- No MVP estes campos são o snapshot do local de levantamento do vendedor.
  provincia text,
  municipio text,
  bairro text,
  endereco_levantamento text,
  ponto_referencia text,
  observacoes_cliente text,
  motivo_recusa text,
  motivo_cancelamento text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  confirmado_em timestamptz,
  recusado_em timestamptz,
  concluido_em timestamptz,
  cancelado_em timestamptz
);

create table public.itens_encomenda (
  id uuid primary key default gen_random_uuid(),
  -- O anúncio pode ser apagado fisicamente pelo vendedor. Os snapshots abaixo
  -- preservam a compra histórica e produto_id passa a null, sem cascade.
  encomenda_id uuid not null references public.encomendas(id) on delete restrict,
  produto_id uuid references public.produtos(id) on delete set null,
  vendedor_id uuid not null references public.vendedores(id) on delete restrict,
  quantidade numeric(14,3) not null check (quantidade > 0),
  unidade text not null,
  tipo_preco_snapshot text not null check (tipo_preco_snapshot in (
    'normal', 'promocional', 'grosso'
  )),
  valor_unitario_centimos bigint not null check (valor_unitario_centimos >= 0),
  subtotal_centimos bigint not null check (subtotal_centimos >= 0),
  nome_produto_snapshot text not null,
  descricao_snapshot text,
  imagem_principal_snapshot text,
  criado_em timestamptz not null default now()
);

create table public.eventos_encomenda (
  id uuid primary key default gen_random_uuid(),
  -- Eventos imutáveis impedem a eliminação física de uma encomenda auditável.
  encomenda_id uuid not null references public.encomendas(id) on delete restrict,
  tipo_evento text not null check (tipo_evento in (
    'encomenda_criada', 'vendedor_confirmou', 'vendedor_recusou',
    'preparacao_iniciada', 'pronta_para_levantamento',
    'levantamento_confirmado', 'encomenda_concluida', 'cliente_cancelou'
  )),
  estado_anterior text,
  estado_novo text not null,
  ator_tipo text not null check (ator_tipo in ('cliente', 'vendedor', 'admin', 'sistema')),
  utilizador_id uuid references auth.users(id) on delete set null,
  metadados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index encomendas_cliente_criado_idx on public.encomendas (cliente_id, criado_em desc);
create index encomendas_vendedor_estado_criado_idx on public.encomendas (vendedor_id, estado, criado_em desc);
create index itens_encomenda_encomenda_idx on public.itens_encomenda (encomenda_id);
create index eventos_encomenda_encomenda_criado_idx on public.eventos_encomenda (encomenda_id, criado_em);

create or replace function public.atualizar_atualizado_em_encomenda()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger atualizar_encomenda_em
before update on public.encomendas
for each row execute function public.atualizar_atualizado_em_encomenda();

create or replace function public.gerar_codigo_publico_encomenda()
returns text
language sql
volatile
set search_path = public
as $$
  select format(
    'ANG-%s-%s',
    to_char(current_date, 'YYYY'),
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  );
$$;

create or replace function public.criar_encomenda_levantamento(
  p_itens jsonb,
  p_modalidade text default 'levantamento',
  p_nome_destinatario text default null,
  p_telefone_destinatario text default null,
  p_observacoes_cliente text default null
)
returns public.encomendas
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

  if coalesce(p_modalidade, '') <> 'levantamento' then
    raise exception 'A entrega ainda não está disponível. Escolha levantamento no local.';
  end if;

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

  v_destinatario_nome := coalesce(nullif(btrim(p_nome_destinatario), ''), nullif(btrim(v_cliente.nome), ''));
  v_destinatario_telefone := coalesce(nullif(btrim(p_telefone_destinatario), ''), nullif(btrim(v_cliente.telefone), ''));
  if v_destinatario_nome is null or v_destinatario_telefone is null then
    raise exception 'Indique nome e telefone de contacto para o levantamento.';
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
        v_codigo_publico, v_cliente.id, v_vendedor_id, 'levantamento', 'AOA',
        v_subtotal_centimos, 0, 0, v_subtotal_centimos,
        v_destinatario_nome, v_destinatario_telefone,
        (v_itens_preparados -> 0 ->> 'provincia'),
        (v_itens_preparados -> 0 ->> 'municipio'),
        (v_itens_preparados -> 0 ->> 'bairro'),
        (v_itens_preparados -> 0 ->> 'endereco_levantamento'),
        (v_itens_preparados -> 0 ->> 'ponto_referencia'),
        nullif(btrim(p_observacoes_cliente), '')
      ) returning * into v_encomenda;
      exit;
    exception when unique_violation then
      if v_tentativas >= 5 then
        raise exception 'Não foi possível gerar o código público da encomenda. Tente novamente.';
      end if;
    end;
  end loop;

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

  return v_encomenda;
end;
$$;

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

  select * into v_encomenda
  from public.encomendas
  where id = p_encomenda_id
  for update;
  if not found then
    raise exception 'Encomenda não encontrada.';
  end if;

  if exists (
    select 1 from public.clientes c
    where c.id = v_encomenda.cliente_id and c.id = auth.uid()
  ) then
    v_ator := 'cliente';
  elsif exists (
    select 1 from public.vendedores v
    where v.id = v_encomenda.vendedor_id
      and v.user_id = auth.uid()
      and v.status_aprovacao = 'aprovado'
      and coalesce(v.conta_ativa, true) = true
  ) then
    v_ator := 'vendedor';
  else
    raise exception 'Sem permissão para alterar esta encomenda.';
  end if;

  if v_ator = 'cliente' then
    if v_encomenda.estado = 'aguardando_confirmacao' and p_proximo_estado = 'cancelada' then
      v_evento := 'cliente_cancelou';
    else
      raise exception 'Esta transição não é permitida para o cliente.';
    end if;
  else
    if v_encomenda.estado = 'aguardando_confirmacao' and p_proximo_estado = 'confirmada' then
      v_evento := 'vendedor_confirmou';
    elsif v_encomenda.estado = 'aguardando_confirmacao' and p_proximo_estado = 'recusada' then
      if v_motivo is null then
        raise exception 'Indique o motivo da recusa.';
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

  update public.encomendas
  set
    estado = p_proximo_estado,
    motivo_recusa = case when p_proximo_estado = 'recusada' then v_motivo else motivo_recusa end,
    motivo_cancelamento = case when p_proximo_estado = 'cancelada' then v_motivo else motivo_cancelamento end,
    confirmado_em = case when p_proximo_estado = 'confirmada' then now() else confirmado_em end,
    recusado_em = case when p_proximo_estado = 'recusada' then now() else recusado_em end,
    concluido_em = case when p_proximo_estado = 'concluida' then now() else concluido_em end,
    cancelado_em = case when p_proximo_estado = 'cancelada' then now() else cancelado_em end
  where id = v_encomenda.id
  returning * into v_encomenda;

  insert into public.eventos_encomenda (
    encomenda_id, tipo_evento, estado_anterior, estado_novo,
    ator_tipo, utilizador_id, metadados
  ) values (
    v_encomenda.id, v_evento, v_estado_anterior, p_proximo_estado,
    v_ator, auth.uid(), case when v_motivo is null then '{}'::jsonb else jsonb_build_object('motivo', v_motivo) end
  );

  return v_encomenda;
end;
$$;

alter table public.encomendas enable row level security;
alter table public.itens_encomenda enable row level security;
alter table public.eventos_encomenda enable row level security;

create policy encomendas_leitura_cliente_vendedor_admin
on public.encomendas for select to authenticated
using (
  cliente_id = auth.uid()
  or exists (select 1 from public.vendedores v where v.id = vendedor_id and v.user_id = auth.uid())
  or public.eh_admin()
);

create policy itens_encomenda_leitura_cliente_vendedor_admin
on public.itens_encomenda for select to authenticated
using (
  exists (
    select 1 from public.encomendas e
    where e.id = encomenda_id
      and (
        e.cliente_id = auth.uid()
        or exists (select 1 from public.vendedores v where v.id = e.vendedor_id and v.user_id = auth.uid())
        or public.eh_admin()
      )
  )
);

create policy eventos_encomenda_leitura_cliente_vendedor_admin
on public.eventos_encomenda for select to authenticated
using (
  exists (
    select 1 from public.encomendas e
    where e.id = encomenda_id
      and (
        e.cliente_id = auth.uid()
        or exists (select 1 from public.vendedores v where v.id = e.vendedor_id and v.user_id = auth.uid())
        or public.eh_admin()
      )
  )
);

-- Não há INSERT/UPDATE/DELETE direto para clientes, vendedores, parceiros ou
-- admins. As RPCs são a única porta de escrita e criam eventos append-only.
revoke all on table public.encomendas, public.itens_encomenda, public.eventos_encomenda from anon, authenticated;
grant select on table public.encomendas, public.itens_encomenda, public.eventos_encomenda to authenticated;

revoke all on function public.gerar_codigo_publico_encomenda() from public, anon, authenticated;
revoke all on function public.criar_encomenda_levantamento(jsonb, text, text, text, text) from public, anon;
revoke all on function public.transicionar_encomenda_levantamento(uuid, text, text) from public, anon;
grant execute on function public.criar_encomenda_levantamento(jsonb, text, text, text, text) to authenticated;
grant execute on function public.transicionar_encomenda_levantamento(uuid, text, text) to authenticated;

commit;
