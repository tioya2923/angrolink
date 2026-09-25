-- Alertas privados para todos os administradores quando uma candidatura fica pronta para análise.
begin;

alter table public.notificacoes
  drop constraint if exists notificacoes_contexto_check;

alter table public.notificacoes
  add constraint notificacoes_contexto_check
  check (contexto in ('compra', 'venda', 'entrega', 'admin'));

-- Documentos chegam em pedidos independentes. Esta tabela privada representa
-- uma revisão da candidatura, sem usar o timestamp de um documento como
-- identidade do alerta. A transação de abertura agrupa inserções em lote.
create table public.candidaturas_vendedor_revisoes (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references public.vendedores(id) on delete cascade,
  numero integer not null check (numero > 0),
  transacao_submissao bigint not null,
  transacao_pronta bigint,
  criada_em timestamptz not null default now(),
  pronta_em timestamptz,
  unique (vendedor_id, numero)
);

alter table public.candidaturas_vendedor_revisoes enable row level security;
revoke all on table public.candidaturas_vendedor_revisoes from public, anon, authenticated;

-- Mantém a assinatura e a idempotência da função canónica; apenas permite o
-- novo contexto administrativo que a constraint acima introduz.
create or replace function public.criar_notificacao(
  p_utilizador_id uuid,
  p_contexto text,
  p_tipo text,
  p_titulo text,
  p_mensagem text,
  p_entidade_tipo text default null,
  p_entidade_id uuid default null,
  p_url_destino text default null,
  p_metadata jsonb default null,
  p_chave text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_utilizador_id is null then
    raise exception 'Destinatário da notificação é obrigatório.';
  end if;

  if p_contexto not in ('compra', 'venda', 'entrega', 'admin') then
    raise exception 'Contexto de notificação inválido.';
  end if;

  if p_url_destino is not null
    and (left(p_url_destino, 1) <> '/' or left(p_url_destino, 2) = '//') then
    raise exception 'A ligação da notificação deve ser um caminho interno.';
  end if;

  insert into public.notificacoes (
    utilizador_id, contexto, tipo, titulo, mensagem,
    entidade_tipo, entidade_id, url_destino, metadata, chave_idempotencia
  ) values (
    p_utilizador_id, p_contexto, p_tipo, p_titulo, p_mensagem,
    p_entidade_tipo, p_entidade_id, p_url_destino,
    coalesce(p_metadata, '{}'::jsonb), p_chave
  )
  on conflict (chave_idempotencia) where chave_idempotencia is not null do nothing
  returning id into v_id;

  if v_id is null and p_chave is not null then
    select id into v_id
    from public.notificacoes
    where chave_idempotencia = p_chave;
  end if;

  return v_id;
end;
$$;

create or replace function public.notificar_administradores_candidatura_pronta(
  p_tipo text,
  p_entidade_tipo text,
  p_entidade_id uuid,
  p_url_destino text,
  p_chave_evento text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin public.administradores%rowtype;
  v_titulo text;
  v_mensagem text;
begin
  if p_tipo = 'candidatura_vendedor_pronta'
    and p_entidade_tipo = 'vendedor'
    and p_url_destino = '/dashboard/pedidos-vendedores' then
    v_titulo := 'Nova candidatura de vendedor';
    v_mensagem := 'Uma candidatura de vendedor está pronta para análise.';
  elsif p_tipo = 'candidatura_parceiro_entrega_pronta'
    and p_entidade_tipo = 'parceiro_entrega'
    and p_url_destino = '/dashboard/pedidos-entregadores' then
    v_titulo := 'Nova candidatura de entregador';
    v_mensagem := 'Uma candidatura de parceiro de entrega está pronta para análise.';
  else
    raise exception 'Evento administrativo de candidatura inválido.';
  end if;

  for v_admin in select a.* from public.administradores a loop
    perform public.criar_notificacao(
      v_admin.user_id,
      'admin',
      p_tipo,
      v_titulo,
      v_mensagem,
      p_entidade_tipo,
      p_entidade_id,
      p_url_destino,
      '{}'::jsonb,
      p_chave_evento || ':admin:' || v_admin.user_id::text
    );
  end loop;
end;
$$;

create or replace function public.notificar_candidatura_vendedor_pronta()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_vendedor public.vendedores%rowtype;
  v_revisao public.candidaturas_vendedor_revisoes%rowtype;
  v_documentos_obrigatorios text[];
begin
  if new.estado is distinct from 'pendente'
    or (tg_op = 'UPDATE' and old.estado = 'pendente') then
    return new;
  end if;

  select * into v_vendedor
  from public.vendedores v
  where v.id = new.vendedor_id
  for update;

  if not found or v_vendedor.status_aprovacao not in ('pendente', 'rejeitado') then
    return new;
  end if;

  v_documentos_obrigatorios := public.documentos_obrigatorios_vendedor_fase1(v_vendedor.tipo_vendedor);
  if coalesce(cardinality(v_documentos_obrigatorios), 0) = 0 then
    return new;
  end if;

  select * into v_revisao
  from public.candidaturas_vendedor_revisoes r
  where r.vendedor_id = v_vendedor.id
  order by r.numero desc
  limit 1
  for update;

  if not found then
    insert into public.candidaturas_vendedor_revisoes (vendedor_id, numero, transacao_submissao)
    values (v_vendedor.id, 1, txid_current())
    returning * into v_revisao;
  elsif tg_op = 'UPDATE'
    and old.estado = 'rejeitado'
    and new.estado = 'pendente'
    and v_revisao.pronta_em is not null
    and v_revisao.transacao_pronta is distinct from txid_current() then
    insert into public.candidaturas_vendedor_revisoes (vendedor_id, numero, transacao_submissao)
    values (v_vendedor.id, v_revisao.numero + 1, txid_current())
    returning * into v_revisao;
  end if;

  if exists (
    select 1
    from unnest(v_documentos_obrigatorios) requisito(tipo_documento)
    where not exists (
      select 1
      from public.documentos_vendedor d
      where d.vendedor_id = v_vendedor.id
        and d.tipo_documento = requisito.tipo_documento
        and d.estado in ('pendente', 'em_analise', 'aprovado')
        and nullif(btrim(d.frente_path), '') is not null
        and nullif(btrim(d.verso_path), '') is not null
    )
  ) then
    return new;
  end if;

  if v_revisao.pronta_em is not null then
    return new;
  end if;

  update public.candidaturas_vendedor_revisoes
  set pronta_em = now(),
      transacao_pronta = txid_current()
  where id = v_revisao.id;

  perform public.notificar_administradores_candidatura_pronta(
    'candidatura_vendedor_pronta',
    'vendedor',
    v_vendedor.id,
    '/dashboard/pedidos-vendedores',
    'admin:candidatura-vendedor:' || v_vendedor.id::text || ':revisao:' || v_revisao.numero::text
  );
  return new;
end;
$$;

drop trigger if exists criar_notificacao_candidatura_vendedor_pronta on public.documentos_vendedor;
create trigger criar_notificacao_candidatura_vendedor_pronta
after insert or update on public.documentos_vendedor
for each row execute function public.notificar_candidatura_vendedor_pronta();

create or replace function public.notificar_candidatura_parceiro_entrega_pronta()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.estado not in ('rascunho', 'documentos_pendentes', 'documentacao_expirada')
    or new.estado is distinct from 'em_analise' then
    return new;
  end if;

  perform public.notificar_administradores_candidatura_pronta(
    'candidatura_parceiro_entrega_pronta',
    'parceiro_entrega',
    new.id,
    '/dashboard/pedidos-entregadores',
    'admin:candidatura-parceiro:' || new.id::text || ':' || new.atualizado_em::text
  );
  return new;
end;
$$;

drop trigger if exists criar_notificacao_candidatura_parceiro_pronta on public.parceiros_entrega;
create trigger criar_notificacao_candidatura_parceiro_pronta
after update of estado on public.parceiros_entrega
for each row execute function public.notificar_candidatura_parceiro_entrega_pronta();

revoke all on function public.notificar_administradores_candidatura_pronta(text, text, uuid, text, text), public.notificar_candidatura_vendedor_pronta(), public.notificar_candidatura_parceiro_entrega_pronta() from public, anon, authenticated;

commit;
