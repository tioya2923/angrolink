-- ANGROLINK — fundação financeira interna.
-- Não integra provedores, não confirma pagamentos e não movimenta dinheiro.
-- `pagamentos` representa a obrigação da encomenda; cada cobrança concreta
-- pertence a `tentativas_pagamento`.

begin;

create table public.configuracoes_financeiras (
  chave text primary key,
  comissao_bps integer not null default 0 check (comissao_bps between 0 and 10000),
  prazo_repasse_horas integer not null default 0 check (prazo_repasse_horas >= 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Valor inicial seguro enquanto a política comercial não estiver decidida.
insert into public.configuracoes_financeiras (chave, comissao_bps, prazo_repasse_horas)
values ('padrao', 0, 0)
on conflict (chave) do nothing;

create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  -- Uma obrigação financeira principal por encomenda; as tentativas podem ser várias.
  encomenda_id uuid not null unique references public.encomendas(id) on delete restrict,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  vendedor_id uuid not null references public.vendedores(id) on delete restrict,
  moeda char(3) not null check (moeda = 'AOA'),
  estado text not null default 'pendente' check (estado in (
    'pendente', 'a_processar', 'confirmado', 'falhado', 'cancelado', 'expirado',
    'reembolsado_parcialmente', 'reembolsado'
  )),
  referencia_interna text not null unique,
  chave_idempotencia_criacao uuid not null unique,
  subtotal_centimos bigint not null check (subtotal_centimos >= 0),
  desconto_centimos bigint not null default 0 check (desconto_centimos >= 0),
  entrega_centimos bigint not null default 0 check (entrega_centimos >= 0),
  taxa_processador_centimos bigint not null default 0 check (taxa_processador_centimos >= 0),
  comissao_angrolink_centimos bigint not null default 0 check (comissao_angrolink_centimos >= 0),
  valor_vendedor_centimos bigint not null check (valor_vendedor_centimos >= 0),
  valor_logistica_centimos bigint not null default 0 check (valor_logistica_centimos >= 0),
  valor_total_centimos bigint not null check (valor_total_centimos >= 0),
  total_cliente_centimos bigint not null check (total_cliente_centimos >= 0),
  comissao_bps_snapshot integer not null check (comissao_bps_snapshot between 0 and 10000),
  confirmado_em timestamptz,
  falhado_em timestamptz,
  cancelado_em timestamptz,
  expirado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint pagamentos_desconto_valido check (desconto_centimos <= subtotal_centimos),
  constraint pagamentos_total_cliente_consistente check (
    total_cliente_centimos = subtotal_centimos - desconto_centimos + entrega_centimos + taxa_processador_centimos
  ),
  constraint pagamentos_valor_total_consistente check (valor_total_centimos = total_cliente_centimos),
  constraint pagamentos_divisao_consistente check (
    total_cliente_centimos = valor_vendedor_centimos + comissao_angrolink_centimos
      + valor_logistica_centimos + taxa_processador_centimos
  ),
  constraint pagamentos_comercio_consistente check (
    subtotal_centimos - desconto_centimos = valor_vendedor_centimos + comissao_angrolink_centimos
  ),
  constraint pagamentos_logistica_consistente check (valor_logistica_centimos = entrega_centimos),
  constraint pagamentos_marcos_estado_consistentes check (
    (estado <> 'confirmado' or confirmado_em is not null)
    and (estado <> 'falhado' or falhado_em is not null)
    and (estado <> 'cancelado' or cancelado_em is not null)
    and (estado <> 'expirado' or expirado_em is not null)
  )
);

create table public.tentativas_pagamento (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid not null references public.pagamentos(id) on delete restrict,
  metodo text not null check (metodo in (
    'online', 'pagamento_na_entrega', 'digital_na_entrega', 'pagamento_no_levantamento'
  )),
  -- O nome do provedor só será preenchido por integração futura controlada.
  provedor text,
  estado text not null default 'criada' check (estado in (
    'criada', 'pendente', 'a_processar', 'confirmada', 'falhada', 'expirada', 'cancelada'
  )),
  referencia_interna text not null unique,
  referencia_externa text,
  chave_idempotencia uuid not null unique,
  iniciado_em timestamptz not null default now(),
  confirmado_em timestamptz,
  falhado_em timestamptz,
  expirado_em timestamptz,
  cancelado_em timestamptz,
  codigo_erro text,
  mensagem_erro text,
  -- Apenas metadados seguros, nunca payload de gateway, cartões, PIN ou OTP bancário.
  metadados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint tentativas_pagamento_marcos_estado_consistentes check (
    (estado <> 'confirmada' or confirmado_em is not null)
    and (estado <> 'falhada' or falhado_em is not null)
    and (estado <> 'expirada' or expirado_em is not null)
    and (estado <> 'cancelada' or cancelado_em is not null)
  )
);

create table public.repasses_vendedor (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references public.vendedores(id) on delete restrict,
  pagamento_id uuid not null unique references public.pagamentos(id) on delete restrict,
  encomenda_id uuid not null unique references public.encomendas(id) on delete restrict,
  valor_centimos bigint not null check (valor_centimos >= 0),
  estado text not null default 'pendente' check (estado in (
    'pendente', 'disponivel', 'processando', 'concluido', 'falhado', 'cancelado'
  )),
  referencia text unique,
  disponivel_em timestamptz,
  processado_em timestamptz,
  falhado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint repasses_marcos_estado_consistentes check (
    (estado <> 'disponivel' or disponivel_em is not null)
    and (estado <> 'concluido' or processado_em is not null)
    and (estado <> 'falhado' or falhado_em is not null)
  )
);

create table public.eventos_pagamento (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid not null references public.pagamentos(id) on delete restrict,
  tentativa_pagamento_id uuid references public.tentativas_pagamento(id) on delete restrict,
  encomenda_id uuid not null references public.encomendas(id) on delete restrict,
  tipo_evento text not null check (tipo_evento in (
    'pagamento_criado', 'tentativa_criada', 'tentativa_iniciada', 'pagamento_confirmado',
    'pagamento_falhou', 'pagamento_expirou', 'pagamento_cancelado', 'reembolso_parcial',
    'reembolso_total', 'repasse_criado', 'repasse_disponivel', 'repasse_processando',
    'repasse_concluido', 'repasse_falhou', 'repasse_cancelado'
  )),
  estado_anterior text,
  estado_novo text not null,
  ator_tipo text not null check (ator_tipo in ('cliente', 'vendedor', 'admin', 'sistema', 'provedor')),
  utilizador_id uuid references auth.users(id) on delete set null,
  metadados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index pagamentos_cliente_criado_idx on public.pagamentos (cliente_id, criado_em desc);
create index pagamentos_vendedor_criado_idx on public.pagamentos (vendedor_id, criado_em desc);
create index pagamentos_estado_criado_idx on public.pagamentos (estado, criado_em desc);
create index tentativas_pagamento_pagamento_criado_idx on public.tentativas_pagamento (pagamento_id, criado_em desc);
create index tentativas_pagamento_estado_criado_idx on public.tentativas_pagamento (estado, criado_em desc);
create index repasses_vendedor_estado_idx on public.repasses_vendedor (vendedor_id, estado, criado_em desc);
create index eventos_pagamento_pagamento_criado_idx on public.eventos_pagamento (pagamento_id, criado_em);

create or replace function public.atualizar_atualizado_em_financeiro()
returns trigger language plpgsql set search_path = public as $$
begin new.atualizado_em = now(); return new; end;
$$;

create trigger atualizar_pagamento_em before update on public.pagamentos for each row execute function public.atualizar_atualizado_em_financeiro();
create trigger atualizar_tentativa_pagamento_em before update on public.tentativas_pagamento for each row execute function public.atualizar_atualizado_em_financeiro();
create trigger atualizar_repasse_em before update on public.repasses_vendedor for each row execute function public.atualizar_atualizado_em_financeiro();
create trigger atualizar_configuracao_financeira_em before update on public.configuracoes_financeiras for each row execute function public.atualizar_atualizado_em_financeiro();

create or replace function public.proteger_eventos_pagamento_append_only()
returns trigger language plpgsql set search_path = public as $$
begin raise exception 'Eventos financeiros são append-only.'; end;
$$;
create trigger impedir_alteracao_evento_pagamento before update or delete on public.eventos_pagamento for each row execute function public.proteger_eventos_pagamento_append_only();

create or replace function public.gerar_referencia_pagamento_interna()
returns text language sql volatile set search_path = public as $$
  select format('PGT-%s-%s', to_char(current_date, 'YYYY'), upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)));
$$;

create or replace function public.gerar_referencia_tentativa_pagamento_interna()
returns text language sql volatile set search_path = public as $$
  select format('TPT-%s-%s', to_char(current_date, 'YYYY'), upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)));
$$;

create or replace function public.criar_pagamento_encomenda(
  p_encomenda_id uuid,
  p_chave_idempotencia uuid
)
returns public.pagamentos
language plpgsql security definer set search_path = public as $$
declare
  v_encomenda public.encomendas%rowtype;
  v_existente public.pagamentos%rowtype;
  v_config public.configuracoes_financeiras%rowtype;
  v_pagamento public.pagamentos%rowtype;
  v_referencia text;
  v_tentativas integer := 0;
  v_comercio_centimos bigint;
  v_comissao_centimos bigint;
begin
  if auth.uid() is null then raise exception 'Sessão inválida. Inicie sessão antes de iniciar o pagamento.'; end if;
  if p_chave_idempotencia is null then raise exception 'É necessária uma chave de idempotência válida.'; end if;

  select * into v_encomenda from public.encomendas where id = p_encomenda_id and cliente_id = auth.uid() for update;
  if not found then raise exception 'Encomenda não encontrada ou sem permissão para iniciar pagamento.'; end if;
  if v_encomenda.estado in ('recusada', 'cancelada', 'concluida') then raise exception 'Esta encomenda não aceita novos pagamentos no estado atual.'; end if;

  select * into v_existente from public.pagamentos where chave_idempotencia_criacao = p_chave_idempotencia;
  if found then
    if v_existente.cliente_id <> auth.uid() or v_existente.encomenda_id <> p_encomenda_id then raise exception 'A chave de idempotência não pode ser reutilizada.'; end if;
    return v_existente;
  end if;
  select * into v_existente from public.pagamentos where encomenda_id = p_encomenda_id;
  if found then return v_existente; end if;

  select * into v_config from public.configuracoes_financeiras where chave = 'padrao' and ativo = true for share;
  if not found then raise exception 'A configuração financeira padrão não está disponível.'; end if;
  v_comercio_centimos := v_encomenda.subtotal_centimos - v_encomenda.desconto_centimos;
  v_comissao_centimos := (v_comercio_centimos * v_config.comissao_bps + 5000) / 10000;

  loop
    v_tentativas := v_tentativas + 1; v_referencia := public.gerar_referencia_pagamento_interna();
    begin
      insert into public.pagamentos (
        encomenda_id, cliente_id, vendedor_id, moeda, referencia_interna, chave_idempotencia_criacao,
        subtotal_centimos, desconto_centimos, entrega_centimos, taxa_processador_centimos,
        comissao_angrolink_centimos, valor_vendedor_centimos, valor_logistica_centimos,
        valor_total_centimos, total_cliente_centimos, comissao_bps_snapshot
      ) values (
        v_encomenda.id, v_encomenda.cliente_id, v_encomenda.vendedor_id, v_encomenda.moeda, v_referencia, p_chave_idempotencia,
        v_encomenda.subtotal_centimos, v_encomenda.desconto_centimos, v_encomenda.entrega_centimos, 0,
        v_comissao_centimos, v_comercio_centimos - v_comissao_centimos, v_encomenda.entrega_centimos,
        v_encomenda.total_centimos, v_encomenda.total_centimos, v_config.comissao_bps
      ) returning * into v_pagamento;
      exit;
    exception when unique_violation then
      select * into v_existente from public.pagamentos where encomenda_id = p_encomenda_id;
      if found then return v_existente; end if;
      if v_tentativas >= 5 then raise exception 'Não foi possível gerar referência interna de pagamento. Tente novamente.'; end if;
    end;
  end loop;

  insert into public.eventos_pagamento (pagamento_id, encomenda_id, tipo_evento, estado_novo, ator_tipo, utilizador_id)
  values (v_pagamento.id, v_pagamento.encomenda_id, 'pagamento_criado', v_pagamento.estado, 'cliente', auth.uid());
  return v_pagamento;
end;
$$;

create or replace function public.criar_tentativa_pagamento(
  p_pagamento_id uuid,
  p_metodo text,
  p_chave_idempotencia uuid
)
returns public.tentativas_pagamento
language plpgsql security definer set search_path = public as $$
declare
  v_pagamento public.pagamentos%rowtype;
  v_existente public.tentativas_pagamento%rowtype;
  v_tentativa public.tentativas_pagamento%rowtype;
  v_referencia text;
  v_tentativas integer := 0;
begin
  if auth.uid() is null then raise exception 'Sessão inválida. Inicie sessão antes de iniciar uma tentativa.'; end if;
  if p_chave_idempotencia is null then raise exception 'É necessária uma chave de idempotência válida.'; end if;
  if coalesce(btrim(p_metodo), '') not in ('online', 'pagamento_na_entrega', 'digital_na_entrega', 'pagamento_no_levantamento') then raise exception 'Método de pagamento inválido.'; end if;

  select * into v_pagamento from public.pagamentos where id = p_pagamento_id and cliente_id = auth.uid() for update;
  if not found then raise exception 'Pagamento não encontrado ou sem permissão.'; end if;
  if v_pagamento.estado in ('confirmado', 'reembolsado_parcialmente', 'reembolsado', 'cancelado') then raise exception 'Este pagamento não aceita novas tentativas.'; end if;

  select * into v_existente from public.tentativas_pagamento where chave_idempotencia = p_chave_idempotencia;
  if found then
    if v_existente.pagamento_id <> v_pagamento.id then raise exception 'A chave de idempotência não pode ser reutilizada.'; end if;
    return v_existente;
  end if;

  loop
    v_tentativas := v_tentativas + 1; v_referencia := public.gerar_referencia_tentativa_pagamento_interna();
    begin
      insert into public.tentativas_pagamento (pagamento_id, metodo, referencia_interna, chave_idempotencia)
      values (v_pagamento.id, btrim(p_metodo), v_referencia, p_chave_idempotencia)
      returning * into v_tentativa;
      exit;
    exception when unique_violation then
      select * into v_existente from public.tentativas_pagamento where chave_idempotencia = p_chave_idempotencia;
      if found and v_existente.pagamento_id = v_pagamento.id then return v_existente; end if;
      if v_tentativas >= 5 then raise exception 'Não foi possível gerar referência interna da tentativa. Tente novamente.'; end if;
    end;
  end loop;

  insert into public.eventos_pagamento (pagamento_id, tentativa_pagamento_id, encomenda_id, tipo_evento, estado_novo, ator_tipo, utilizador_id, metadados)
  values (v_pagamento.id, v_tentativa.id, v_pagamento.encomenda_id, 'tentativa_criada', v_tentativa.estado, 'cliente', auth.uid(), jsonb_build_object('metodo', v_tentativa.metodo));
  return v_tentativa;
end;
$$;

create or replace function public.listar_pagamentos_cliente()
returns table (id uuid, encomenda_id uuid, referencia_interna text, moeda char(3), estado text, total_cliente_centimos bigint, criado_em timestamptz, confirmado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.encomenda_id, p.referencia_interna, p.moeda, p.estado, p.total_cliente_centimos, p.criado_em, p.confirmado_em
  from public.pagamentos p where p.cliente_id = auth.uid() order by p.criado_em desc;
$$;

create or replace function public.listar_resumo_financeiro_vendedor()
returns table (pagamento_id uuid, encomenda_id uuid, referencia_interna text, moeda char(3), estado_pagamento text, valor_vendedor_centimos bigint, estado_repasse text, valor_repasse_centimos bigint, disponivel_em timestamptz, processado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.encomenda_id, p.referencia_interna, p.moeda, p.estado, p.valor_vendedor_centimos, r.estado, r.valor_centimos, r.disponivel_em, r.processado_em
  from public.pagamentos p join public.vendedores v on v.id = p.vendedor_id left join public.repasses_vendedor r on r.pagamento_id = p.id
  where v.user_id = auth.uid() order by p.criado_em desc;
$$;

alter table public.configuracoes_financeiras enable row level security;
alter table public.pagamentos enable row level security;
alter table public.tentativas_pagamento enable row level security;
alter table public.repasses_vendedor enable row level security;
alter table public.eventos_pagamento enable row level security;

-- Leitura direta exclusivamente administrativa. As RPCs devolvem a projeção mínima.
create policy configuracoes_financeiras_admin_leitura on public.configuracoes_financeiras for select to authenticated using (public.eh_admin());
create policy pagamentos_admin_leitura on public.pagamentos for select to authenticated using (public.eh_admin());
create policy tentativas_pagamento_admin_leitura on public.tentativas_pagamento for select to authenticated using (public.eh_admin());
create policy repasses_admin_leitura on public.repasses_vendedor for select to authenticated using (public.eh_admin());
create policy eventos_pagamento_admin_leitura on public.eventos_pagamento for select to authenticated using (public.eh_admin());

revoke all on table public.configuracoes_financeiras, public.pagamentos, public.tentativas_pagamento, public.repasses_vendedor, public.eventos_pagamento from public, anon, authenticated;
grant select on table public.configuracoes_financeiras, public.pagamentos, public.tentativas_pagamento, public.repasses_vendedor, public.eventos_pagamento to authenticated;

revoke all on function public.gerar_referencia_pagamento_interna() from public, anon, authenticated;
revoke all on function public.gerar_referencia_tentativa_pagamento_interna() from public, anon, authenticated;
revoke all on function public.criar_pagamento_encomenda(uuid, uuid) from public, anon;
revoke all on function public.criar_tentativa_pagamento(uuid, text, uuid) from public, anon;
revoke all on function public.listar_pagamentos_cliente() from public, anon;
revoke all on function public.listar_resumo_financeiro_vendedor() from public, anon;
grant execute on function public.criar_pagamento_encomenda(uuid, uuid) to authenticated;
grant execute on function public.criar_tentativa_pagamento(uuid, text, uuid) to authenticated;
grant execute on function public.listar_pagamentos_cliente() to authenticated;
grant execute on function public.listar_resumo_financeiro_vendedor() to authenticated;

commit;
