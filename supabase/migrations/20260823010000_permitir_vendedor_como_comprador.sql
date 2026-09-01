-- ANGROLINK — capacidade compradora secundária para contas vendedoras.
-- Depende das RPCs de levantamento e entrega já existentes; não altera o
-- papel principal da conta nem a lógica comercial interna dessas RPCs.

begin;

create or replace function public.garantir_perfil_comprador()
returns public.clientes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente public.clientes%rowtype;
  v_vendedor public.vendedores%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão antes de criar a encomenda.';
  end if;

  select * into v_cliente
  from public.clientes
  where id = auth.uid()
  for update;

  if found then
    if coalesce(v_cliente.conta_ativa, true) = false then
      raise exception 'A conta de comprador está desativada.';
    end if;
    return v_cliente;
  end if;

  select * into v_vendedor
  from public.vendedores
  where user_id = auth.uid()
    and coalesce(conta_ativa, true) = true
  for update;

  if not found then
    raise exception 'É necessária uma conta de comprador ativa para criar encomendas.';
  end if;

  insert into public.clientes (
    id, nome, email, telefone, provincia, municipio, conta_ativa, tipo_comprador
  ) values (
    auth.uid(),
    nullif(btrim(coalesce(v_vendedor.nome_responsavel, v_vendedor.nome_comercial)), ''),
    nullif(btrim(v_vendedor.email), ''),
    nullif(btrim(coalesce(v_vendedor.telefone_whatsapp, v_vendedor.whatsapp)), ''),
    nullif(btrim(v_vendedor.provincia), ''),
    nullif(btrim(v_vendedor.municipio), ''),
    true,
    null
  )
  on conflict (id) do nothing;

  select * into v_cliente
  from public.clientes
  where id = auth.uid()
  for update;

  if not found or coalesce(v_cliente.conta_ativa, true) = false then
    raise exception 'Não foi possível preparar uma identidade de comprador ativa.';
  end if;

  return v_cliente;
end;
$$;

create or replace function public.validar_compra_produto_alheio(p_itens jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão antes de criar a encomenda.';
  end if;

  if jsonb_typeof(p_itens) = 'array' and exists (
    select 1
    from jsonb_array_elements(p_itens) item
    join public.produtos produto
      on produto.id = (item ->> 'produto_id')::uuid
    join public.vendedores vendedor
      on vendedor.id = produto.vendedor_id
    where vendedor.user_id = auth.uid()
  ) then
    raise exception 'Não podes comprar produtos da tua própria loja.';
  end if;
end;
$$;

alter function public.criar_encomenda_levantamento(jsonb, text, text, text, text)
  rename to criar_encomenda_levantamento_base_v1;

create function public.criar_encomenda_levantamento(
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
begin
  perform public.garantir_perfil_comprador();
  perform public.validar_compra_produto_alheio(p_itens);
  return public.criar_encomenda_levantamento_base_v1(
    p_itens, p_modalidade, p_nome_destinatario, p_telefone_destinatario, p_observacoes_cliente
  );
end;
$$;

alter function public.criar_encomenda_entrega(jsonb, text, text, text, text, text, text, text, text, text)
  rename to criar_encomenda_entrega_base_v1;

create function public.criar_encomenda_entrega(
  p_itens jsonb,
  p_destinatario_nome text,
  p_destinatario_telefone text,
  p_provincia text,
  p_municipio text,
  p_bairro text,
  p_endereco_detalhado text,
  p_ponto_referencia text default null,
  p_instrucoes_entrega text default null,
  p_observacoes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.garantir_perfil_comprador();
  perform public.validar_compra_produto_alheio(p_itens);
  return public.criar_encomenda_entrega_base_v1(
    p_itens, p_destinatario_nome, p_destinatario_telefone, p_provincia, p_municipio,
    p_bairro, p_endereco_detalhado, p_ponto_referencia, p_instrucoes_entrega, p_observacoes
  );
end;
$$;

revoke all on function public.garantir_perfil_comprador() from public, anon;
revoke all on function public.validar_compra_produto_alheio(jsonb) from public, anon, authenticated;
revoke all on function public.criar_encomenda_levantamento_base_v1(jsonb, text, text, text, text) from public, anon, authenticated;
revoke all on function public.criar_encomenda_entrega_base_v1(jsonb, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.criar_encomenda_levantamento(jsonb, text, text, text, text) from public, anon;
revoke all on function public.criar_encomenda_entrega(jsonb, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.criar_encomenda_levantamento(jsonb, text, text, text, text) to authenticated;
grant execute on function public.criar_encomenda_entrega(jsonb, text, text, text, text, text, text, text, text, text) to authenticated;

commit;
