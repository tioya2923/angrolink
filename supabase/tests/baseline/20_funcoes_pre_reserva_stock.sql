-- TEST-ONLY — NÃO APLICAR EM PRODUÇÃO
-- NÃO É MIGRATION. Funções mínimas, rastreáveis às migrations pré-Reserva Stock.

create or replace function public.gerar_codigo_publico_encomenda()
returns text language sql volatile set search_path = public as $$
  select format('ANG-%s-%s', to_char(current_date, 'YYYY'), upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 8)))
$$;

create or replace function public.vendedor_pode_receber_encomendas(p_vendedor_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.vendedores v join public.profiles p on p.id = v.user_id
    where v.id = p_vendedor_id and v.user_id is not null
      and v.status_aprovacao = 'aprovado' and v.conta_ativa and not v.bloqueado
      and p.ativo and p.apagado_em is null and p.papel in ('vendedor', 'admin')
  )
$$;

create or replace function public.garantir_perfil_comprador()
returns public.clientes language plpgsql security definer set search_path = public as $$
declare v_cliente public.clientes%rowtype; v_vendedor public.vendedores%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão inválida. Inicie sessão antes de criar a encomenda.'; end if;
  select * into v_cliente from public.clientes where id = auth.uid() for update;
  if found then
    if not v_cliente.conta_ativa then raise exception 'A conta de comprador está desativada.'; end if;
    return v_cliente;
  end if;
  select * into v_vendedor from public.vendedores where user_id = auth.uid() and conta_ativa for update;
  if not found then raise exception 'É necessária uma conta de comprador ativa para criar encomendas.'; end if;
  insert into public.clientes(id,nome,email,telefone,provincia,municipio,conta_ativa)
  values(auth.uid(),coalesce(v_vendedor.nome_responsavel,v_vendedor.nome_comercial),v_vendedor.email,coalesce(v_vendedor.telefone_whatsapp,v_vendedor.whatsapp),v_vendedor.provincia,v_vendedor.municipio,true);
  select * into v_cliente from public.clientes where id=auth.uid();
  return v_cliente;
end $$;

create or replace function public.validar_compra_produto_alheio(p_itens jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sessão inválida. Inicie sessão antes de criar a encomenda.'; end if;
  if exists (select 1 from jsonb_array_elements(p_itens) x join public.produtos p on p.id=(x->>'produto_id')::uuid join public.vendedores v on v.id=p.vendedor_id where v.user_id=auth.uid()) then
    raise exception 'Não podes comprar produtos da tua própria loja.';
  end if;
end $$;

create or replace function public.territorio_angola_valido(p_provincia text, p_municipio text)
returns boolean language sql stable as $$ select nullif(btrim(p_provincia),'') is not null and nullif(btrim(p_municipio),'') is not null $$;

create or replace function public.criar_pagamento_encomenda(p_encomenda_id uuid, p_chave_idempotencia uuid)
returns public.pagamentos language plpgsql security definer set search_path = public as $$
declare e public.encomendas%rowtype; resultado public.pagamentos%rowtype;
begin
  select * into e from public.encomendas where id=p_encomenda_id and cliente_id=auth.uid() for update;
  if not found then raise exception 'Encomenda não encontrada ou sem permissão para iniciar pagamento.'; end if;
  select * into resultado from public.pagamentos where encomenda_id=e.id; if found then return resultado; end if;
  insert into public.pagamentos(encomenda_id,cliente_id,vendedor_id,referencia_interna,chave_idempotencia_criacao,subtotal_centimos,desconto_centimos,entrega_centimos,valor_vendedor_centimos,valor_logistica_centimos,valor_total_centimos,total_cliente_centimos)
  values(e.id,e.cliente_id,e.vendedor_id,'PGT-'||replace(extensions.gen_random_uuid()::text,'-',''),p_chave_idempotencia,e.subtotal_centimos,e.desconto_centimos,e.entrega_centimos,e.subtotal_centimos-e.desconto_centimos,e.entrega_centimos,e.total_centimos,e.total_centimos) returning * into resultado;
  return resultado;
end $$;

create or replace function public.criar_tentativa_pagamento(p_pagamento_id uuid,p_metodo text,p_chave_idempotencia uuid)
returns public.tentativas_pagamento language plpgsql security definer set search_path = public as $$
declare resultado public.tentativas_pagamento%rowtype;
begin
  if not exists(select 1 from public.pagamentos where id=p_pagamento_id and cliente_id=auth.uid()) then raise exception 'Pagamento não encontrado ou sem permissão.'; end if;
  select * into resultado from public.tentativas_pagamento where chave_idempotencia=p_chave_idempotencia; if found then return resultado; end if;
  insert into public.tentativas_pagamento(pagamento_id,metodo,referencia_interna,chave_idempotencia) values(p_pagamento_id,p_metodo,'TPT-'||replace(extensions.gen_random_uuid()::text,'-',''),p_chave_idempotencia) returning * into resultado;
  return resultado;
end $$;

create or replace function public.criar_notificacao(p_utilizador_id uuid,p_contexto text,p_tipo text,p_titulo text,p_mensagem text,p_entidade_tipo text default null,p_entidade_id uuid default null,p_url_destino text default null,p_metadata jsonb default null,p_chave text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare resultado uuid;
begin
  insert into public.notificacoes(utilizador_id,contexto,tipo,titulo,mensagem,entidade_tipo,entidade_id,url_destino,metadata,chave_idempotencia)
  values(p_utilizador_id,p_contexto,p_tipo,p_titulo,p_mensagem,p_entidade_tipo,p_entidade_id,p_url_destino,coalesce(p_metadata,'{}'),p_chave)
  on conflict(chave_idempotencia) do update set chave_idempotencia=excluded.chave_idempotencia returning id into resultado;
  return resultado;
end $$;
