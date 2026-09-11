-- ANGROLINK — Bloco 4B: mensagens operacionais privadas por encomenda.
-- A encomenda é a thread. Admin e parceiro de entrega não são participantes.
begin;

create table public.mensagens_encomenda (
  id uuid primary key default gen_random_uuid(),
  encomenda_id uuid not null references public.encomendas(id) on delete restrict,
  remetente_user_id uuid not null references auth.users(id) on delete restrict,
  corpo text not null,
  criado_em timestamptz not null default now(),
  constraint mensagens_encomenda_corpo_valido_check
    check (char_length(btrim(corpo)) between 1 and 1000)
);

create index mensagens_encomenda_encomenda_criado_idx
  on public.mensagens_encomenda (encomenda_id, criado_em desc, id desc);

create table public.leituras_mensagens_encomenda (
  encomenda_id uuid not null references public.encomendas(id) on delete restrict,
  utilizador_id uuid not null references auth.users(id) on delete restrict,
  ultima_leitura_em timestamptz not null,
  primary key (encomenda_id, utilizador_id)
);

create or replace function public.utilizador_participa_encomenda_mensagens(
  p_encomenda_id uuid,
  p_utilizador_id uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or p_utilizador_id is distinct from auth.uid() then
    return false;
  end if;

  return exists (
    select 1
    from public.encomendas e
    left join public.vendedores v on v.id = e.vendedor_id
    where e.id = p_encomenda_id
      and (e.cliente_id = p_utilizador_id or v.user_id = p_utilizador_id)
  );
end;
$$;

create or replace function public.listar_mensagens_encomenda(
  p_encomenda_id uuid,
  p_limite integer default 40,
  p_antes_de timestamptz default null,
  p_antes_id uuid default null
) returns table (
  mensagem_id uuid,
  encomenda_id uuid,
  remetente_user_id uuid,
  corpo text,
  criado_em timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare v_limite integer := least(greatest(coalesce(p_limite, 40), 1), 50);
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  if not public.utilizador_participa_encomenda_mensagens(p_encomenda_id, auth.uid()) then
    raise exception 'Sem permissão para consultar as mensagens desta encomenda.';
  end if;
  if (p_antes_de is null) <> (p_antes_id is null) then
    raise exception 'Cursor de mensagens inválido.';
  end if;

  return query
  select m.id, m.encomenda_id, m.remetente_user_id, m.corpo, m.criado_em
  from public.mensagens_encomenda m
  where m.encomenda_id = p_encomenda_id
    and (
      p_antes_de is null
      or (m.criado_em, m.id) < (p_antes_de, p_antes_id)
    )
  order by m.criado_em desc, m.id desc
  limit v_limite;
end;
$$;

create or replace function public.enviar_mensagem_encomenda(
  p_encomenda_id uuid,
  p_corpo text
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_encomenda public.encomendas%rowtype; v_corpo text := btrim(coalesce(p_corpo, '')); v_mensagem_id uuid;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  if not public.utilizador_participa_encomenda_mensagens(p_encomenda_id, auth.uid()) then
    raise exception 'Sem permissão para enviar mensagens nesta encomenda.';
  end if;
  if char_length(v_corpo) = 0 then raise exception 'A mensagem não pode estar vazia.'; end if;
  if char_length(v_corpo) > 1000 then raise exception 'A mensagem não pode exceder 1000 caracteres.'; end if;

  select * into v_encomenda from public.encomendas where id = p_encomenda_id for update;
  if not found then raise exception 'Encomenda não encontrada.'; end if;
  if v_encomenda.estado in ('concluida', 'cancelada', 'recusada') then
    raise exception 'Esta encomenda está encerrada e não aceita novas mensagens.';
  end if;

  insert into public.mensagens_encomenda (encomenda_id, remetente_user_id, corpo)
  values (v_encomenda.id, auth.uid(), v_corpo)
  returning id into v_mensagem_id;
  return v_mensagem_id;
end;
$$;

create or replace function public.marcar_mensagens_encomenda_como_lidas(
  p_encomenda_id uuid
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  if not public.utilizador_participa_encomenda_mensagens(p_encomenda_id, auth.uid()) then
    raise exception 'Sem permissão para marcar as mensagens desta encomenda.';
  end if;
  insert into public.leituras_mensagens_encomenda (encomenda_id, utilizador_id, ultima_leitura_em)
  values (p_encomenda_id, auth.uid(), now())
  on conflict (encomenda_id, utilizador_id) do update
    set ultima_leitura_em = excluded.ultima_leitura_em;
end;
$$;

create or replace function public.obter_resumo_mensagens_encomenda(
  p_encomenda_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare v_ultima_leitura timestamptz;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  if not public.utilizador_participa_encomenda_mensagens(p_encomenda_id, auth.uid()) then
    raise exception 'Sem permissão para consultar as mensagens desta encomenda.';
  end if;
  select l.ultima_leitura_em into v_ultima_leitura
  from public.leituras_mensagens_encomenda l
  where l.encomenda_id = p_encomenda_id and l.utilizador_id = auth.uid();

  return (
    select jsonb_build_object(
      'total_mensagens', count(*),
      'nao_lidas', count(*) filter (where m.remetente_user_id <> auth.uid() and (v_ultima_leitura is null or m.criado_em > v_ultima_leitura)),
      'ultima_leitura_em', v_ultima_leitura
    )
    from public.mensagens_encomenda m
    where m.encomenda_id = p_encomenda_id
  );
end;
$$;

create or replace function public.notificar_mensagem_encomenda()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_encomenda public.encomendas%rowtype; v_vendedor_user_id uuid; v_destinatario uuid; v_contexto text; v_url text;
begin
  select e.* into v_encomenda
  from public.encomendas e
  where e.id = new.encomenda_id;
  if not found then return new; end if;

  select v.user_id into v_vendedor_user_id
  from public.vendedores v
  where v.id = v_encomenda.vendedor_id;
  if not found or v_vendedor_user_id is null then return new; end if;

  if new.remetente_user_id = v_encomenda.cliente_id then
    v_destinatario := v_vendedor_user_id;
    v_contexto := 'venda';
    v_url := '/dashboard/encomendas/' || v_encomenda.id;
  elsif new.remetente_user_id = v_vendedor_user_id then
    v_destinatario := v_encomenda.cliente_id;
    v_contexto := 'compra';
    if exists (select 1 from public.vendedores v where v.user_id = v_destinatario) then
      v_url := '/dashboard/compras/' || v_encomenda.id;
    else
      v_url := '/dashboard/encomendas/' || v_encomenda.id;
    end if;
  else
    return new;
  end if;

  if v_destinatario is not null and v_destinatario <> new.remetente_user_id then
    perform public.criar_notificacao(v_destinatario, v_contexto, 'mensagem_encomenda', 'Nova mensagem', 'Nova mensagem numa encomenda.', 'encomenda', v_encomenda.id, v_url, '{}'::jsonb, 'mensagem:' || new.id || ':' || v_destinatario);
  end if;
  return new;
exception when others then
  raise warning 'Não foi possível criar a notificação da mensagem %: %', new.id, sqlerrm;
  return new;
end;
$$;

alter table public.mensagens_encomenda enable row level security;
alter table public.leituras_mensagens_encomenda enable row level security;
revoke all on table public.mensagens_encomenda, public.leituras_mensagens_encomenda from public, anon, authenticated;
grant select on public.mensagens_encomenda, public.leituras_mensagens_encomenda to authenticated;

create policy mensagens_encomenda_leitura_participantes on public.mensagens_encomenda
  for select to authenticated
  using (public.utilizador_participa_encomenda_mensagens(encomenda_id, auth.uid()));
create policy leituras_mensagens_encomenda_leitura_propria on public.leituras_mensagens_encomenda
  for select to authenticated
  using (utilizador_id = auth.uid() and public.utilizador_participa_encomenda_mensagens(encomenda_id, auth.uid()));

create trigger criar_notificacao_mensagem_encomenda
  after insert on public.mensagens_encomenda
  for each row execute function public.notificar_mensagem_encomenda();

revoke all on function public.utilizador_participa_encomenda_mensagens(uuid, uuid), public.listar_mensagens_encomenda(uuid, integer, timestamptz, uuid), public.enviar_mensagem_encomenda(uuid, text), public.marcar_mensagens_encomenda_como_lidas(uuid), public.obter_resumo_mensagens_encomenda(uuid), public.notificar_mensagem_encomenda() from public, anon;
grant execute on function public.utilizador_participa_encomenda_mensagens(uuid, uuid), public.listar_mensagens_encomenda(uuid, integer, timestamptz, uuid), public.enviar_mensagem_encomenda(uuid, text), public.marcar_mensagens_encomenda_como_lidas(uuid), public.obter_resumo_mensagens_encomenda(uuid) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'A publicação supabase_realtime não existe.';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mensagens_encomenda') then
    alter publication supabase_realtime add table public.mensagens_encomenda;
  end if;
end;
$$;

commit;
