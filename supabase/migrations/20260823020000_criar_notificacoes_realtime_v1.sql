-- ANGROLINK — notificações privadas e Realtime V1.
-- A escrita é exclusivamente server-side; o browser apenas lê as suas próprias linhas.
begin;

create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  utilizador_id uuid not null references auth.users(id) on delete cascade,
  contexto text not null check (contexto in ('compra', 'venda', 'entrega')),
  tipo text not null,
  titulo text not null,
  mensagem text not null,
  entidade_tipo text,
  entidade_id uuid,
  url_destino text check (
    url_destino is null
    or (left(url_destino, 1) = '/' and left(url_destino, 2) <> '//')
  ),
  lida boolean not null default false,
  lida_em timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  chave_idempotencia text,
  criado_em timestamptz not null default now()
);

create unique index notificacoes_chave_unica_idx
  on public.notificacoes (chave_idempotencia)
  where chave_idempotencia is not null;

create index notificacoes_utilizador_criado_idx
  on public.notificacoes (utilizador_id, criado_em desc);

alter table public.notificacoes enable row level security;

create policy notificacoes_leitura_propria
on public.notificacoes
for select
to authenticated
using (utilizador_id = auth.uid());

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

  if p_contexto not in ('compra', 'venda', 'entrega') then
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

create or replace function public.listar_notificacoes(
  p_limite integer default 20,
  p_antes_de timestamptz default null
)
returns setof public.notificacoes
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  return query
  select n.*
  from public.notificacoes n
  where n.utilizador_id = auth.uid()
    and (p_antes_de is null or n.criado_em < p_antes_de)
  order by n.criado_em desc
  limit least(greatest(coalesce(p_limite, 20), 1), 100);
end;
$$;

create or replace function public.contar_notificacoes_nao_lidas()
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  return (
    select count(*)
    from public.notificacoes n
    where n.utilizador_id = auth.uid()
      and not n.lida
  );
end;
$$;

create or replace function public.marcar_notificacao_como_lida(p_notificacao_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  update public.notificacoes
  set lida = true,
      lida_em = coalesce(lida_em, now())
  where id = p_notificacao_id
    and utilizador_id = auth.uid();
end;
$$;

create or replace function public.marcar_todas_notificacoes_como_lidas()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  update public.notificacoes
  set lida = true,
      lida_em = coalesce(lida_em, now())
  where utilizador_id = auth.uid()
    and not lida;
end;
$$;

create or replace function public.notificar_evento_encomenda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encomenda public.encomendas%rowtype;
  v_destinatario_id uuid;
  v_atribuicao_id uuid;
  v_url_comprador text;
begin
  -- Notificações não são parte da transação comercial: qualquer falha é isolada.
  begin
    select * into v_encomenda
    from public.encomendas
    where id = new.encomenda_id;

    if not found then
      raise warning 'Notificação ignorada: encomenda do evento % não encontrada.', new.id;
      return new;
    end if;

    if new.tipo_evento = 'encomenda_criada' then
      select v.user_id into v_destinatario_id
      from public.vendedores v
      where v.id = v_encomenda.vendedor_id;

      if v_destinatario_id is null then
        raise warning 'Notificação de nova encomenda ignorada: vendedor sem utilizador para o evento %.', new.id;
        return new;
      end if;

      perform public.criar_notificacao(
        v_destinatario_id, 'venda', 'nova_encomenda',
        'Nova encomenda recebida', 'Recebeste uma nova encomenda.',
        'encomenda', v_encomenda.id, '/dashboard/encomendas/' || v_encomenda.id,
        '{}'::jsonb, 'encomenda:' || new.id || ':vendedor'
      );
    elsif new.tipo_evento in ('vendedor_confirmou', 'vendedor_recusou', 'pronta_para_levantamento', 'entregador_aceitou') then
      if new.tipo_evento = 'entregador_aceitou'
        and v_encomenda.modalidade_recebimento <> 'entrega' then
        raise warning 'Notificação de aceite de entrega ignorada: evento % não pertence a uma entrega.', new.id;
        return new;
      end if;

      v_destinatario_id := v_encomenda.cliente_id;
      if v_destinatario_id is null then
        raise warning 'Notificação ao comprador ignorada: destinatário ausente para o evento %.', new.id;
        return new;
      end if;

      if exists (
        select 1
        from public.vendedores v
        where v.user_id = v_destinatario_id
      ) then
        v_url_comprador := '/dashboard/compras/' || v_encomenda.id;
      else
        v_url_comprador := '/dashboard/encomendas/' || v_encomenda.id;
      end if;

      if new.tipo_evento = 'vendedor_confirmou' then
        perform public.criar_notificacao(
          v_destinatario_id, 'compra', new.tipo_evento,
          'Encomenda confirmada', 'O vendedor confirmou a tua encomenda.',
          'encomenda', v_encomenda.id, v_url_comprador,
          '{}'::jsonb, 'encomenda:' || new.id || ':cliente'
        );
      elsif new.tipo_evento = 'vendedor_recusou' then
        perform public.criar_notificacao(
          v_destinatario_id, 'compra', new.tipo_evento,
          'Encomenda recusada', 'O vendedor não conseguiu aceitar a tua encomenda.',
          'encomenda', v_encomenda.id, v_url_comprador,
          '{}'::jsonb, 'encomenda:' || new.id || ':cliente'
        );
      elsif new.tipo_evento = 'pronta_para_levantamento' then
        perform public.criar_notificacao(
          v_destinatario_id, 'compra', new.tipo_evento,
          'Encomenda pronta', 'A tua encomenda está pronta para levantamento.',
          'encomenda', v_encomenda.id, v_url_comprador,
          '{}'::jsonb, 'encomenda:' || new.id || ':cliente'
        );
      else
        perform public.criar_notificacao(
          v_destinatario_id, 'compra', new.tipo_evento,
          'Entregador confirmado', 'O entregador aceitou a tua entrega.',
          'encomenda', v_encomenda.id, v_url_comprador,
          '{}'::jsonb, 'encomenda:' || new.id || ':cliente'
        );
      end if;
    elsif new.tipo_evento = 'entregador_atribuido' then
      begin
        v_atribuicao_id := nullif(new.metadados ->> 'atribuicao_id', '')::uuid;
      exception when invalid_text_representation then
        raise warning 'Notificação de entrega ignorada: atribuição inválida no evento %.', new.id;
        return new;
      end;

      if v_atribuicao_id is null then
        raise warning 'Notificação de entrega ignorada: atribuição ausente no evento %.', new.id;
        return new;
      end if;

      select p.user_id into v_destinatario_id
      from public.atribuicoes_entrega_encomenda a
      join public.parceiros_entrega p on p.id = a.parceiro_entrega_id
      where a.id = v_atribuicao_id;

      if v_destinatario_id is null then
        raise warning 'Notificação de entrega ignorada: parceiro sem utilizador para o evento %.', new.id;
        return new;
      end if;

      perform public.criar_notificacao(
        v_destinatario_id, 'entrega', 'nova_tarefa',
        'Nova entrega atribuída', 'Tens uma nova tarefa de entrega para analisar.',
        'atribuicao_entrega', v_atribuicao_id, '/dashboard/tarefas/' || v_atribuicao_id,
        '{}'::jsonb, 'encomenda:' || new.id || ':entregador'
      );
    end if;
  exception when others then
    raise warning 'Não foi possível criar a notificação do evento %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists criar_notificacao_evento_encomenda on public.eventos_encomenda;
create trigger criar_notificacao_evento_encomenda
after insert on public.eventos_encomenda
for each row
execute function public.notificar_evento_encomenda();

revoke all on table public.notificacoes from public, anon, authenticated;
grant select on table public.notificacoes to authenticated;

revoke all on function public.criar_notificacao(uuid, text, text, text, text, text, uuid, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.notificar_evento_encomenda() from public, anon, authenticated;
revoke all on function public.listar_notificacoes(integer, timestamptz), public.contar_notificacoes_nao_lidas(), public.marcar_notificacao_como_lida(uuid), public.marcar_todas_notificacoes_como_lidas() from public, anon;
grant execute on function public.listar_notificacoes(integer, timestamptz), public.contar_notificacoes_nao_lidas(), public.marcar_notificacao_como_lida(uuid), public.marcar_todas_notificacoes_como_lidas() to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notificacoes'
  ) then
    alter publication supabase_realtime add table public.notificacoes;
  end if;
end;
$$;

commit;
