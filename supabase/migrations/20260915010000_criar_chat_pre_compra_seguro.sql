-- Chat pré-compra seguro: infraestrutura aditiva; não altera mensagens operacionais.
begin;

create table public.conversas_pre_compra (
  id uuid primary key default gen_random_uuid(),
  solicitante_user_id uuid not null references auth.users(id) on delete restrict,
  vendedor_id uuid not null references public.vendedores(id) on delete restrict,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  estado text not null default 'aberta' check (estado in ('aberta', 'somente_leitura')),
  encomenda_id uuid references public.encomendas(id) on delete restrict,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  encerrada_em timestamptz
);

-- Compras repetidas podem abrir uma conversa nova depois de a anterior ficar histórica.
create unique index conversas_pre_compra_aberta_unica_idx
  on public.conversas_pre_compra (solicitante_user_id, vendedor_id, produto_id)
  where estado = 'aberta';

create table public.mensagens_pre_compra (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas_pre_compra(id) on delete restrict,
  remetente_user_id uuid not null references auth.users(id) on delete restrict,
  corpo text not null check (char_length(btrim(corpo)) between 1 and 1000),
  chave_idempotencia uuid not null,
  criado_em timestamptz not null default now(),
  unique (conversa_id, remetente_user_id, chave_idempotencia)
);

create table public.leituras_mensagens_pre_compra (
  conversa_id uuid not null references public.conversas_pre_compra(id) on delete restrict,
  utilizador_id uuid not null references auth.users(id) on delete restrict,
  ultima_leitura_em timestamptz not null default now(),
  primary key (conversa_id, utilizador_id)
);

-- O log não guarda o número; apenas prova o acesso autorizado ao contacto.
create table public.acessos_telefone_encomenda (
  id uuid primary key default gen_random_uuid(),
  solicitante_user_id uuid not null references auth.users(id) on delete restrict,
  encomenda_id uuid not null references public.encomendas(id) on delete restrict,
  contraparte_user_id uuid not null references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now()
);

create index conversas_pre_compra_solicitante_caixa_idx on public.conversas_pre_compra (solicitante_user_id, atualizado_em desc, id desc);
create index conversas_pre_compra_solicitante_criado_idx on public.conversas_pre_compra (solicitante_user_id, criado_em desc);
create index conversas_pre_compra_vendedor_caixa_idx on public.conversas_pre_compra (vendedor_id, atualizado_em desc, id desc);
create index conversas_pre_compra_atividade_idx on public.conversas_pre_compra (atualizado_em desc, id desc);
create index mensagens_pre_compra_cursor_idx on public.mensagens_pre_compra (conversa_id, criado_em desc, id desc);
-- 10/minuto é deliberadamente por remetente e conversa; 100/24h tem o mesmo âmbito.
create index mensagens_pre_compra_limite_remetente_conversa_idx on public.mensagens_pre_compra (remetente_user_id, conversa_id, criado_em desc);
create index acessos_telefone_encomenda_auditoria_idx on public.acessos_telefone_encomenda (encomenda_id, criado_em desc);

alter table public.conversas_pre_compra enable row level security;
alter table public.mensagens_pre_compra enable row level security;
alter table public.leituras_mensagens_pre_compra enable row level security;
alter table public.acessos_telefone_encomenda enable row level security;

create or replace function public.utilizador_participa_conversa_pre_compra(
  p_conversa_id uuid
)
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select coalesce(exists (
    select 1 from public.conversas_pre_compra c
    join public.vendedores v on v.id = c.vendedor_id
    where c.id = p_conversa_id
      and auth.uid() is not null
      and not public.eh_admin()
      and (c.solicitante_user_id = auth.uid() or v.user_id = auth.uid())
  ), false)
$$;

create policy conversas_pre_compra_participantes_leem on public.conversas_pre_compra
for select to authenticated using (public.utilizador_participa_conversa_pre_compra(id));
create policy mensagens_pre_compra_participantes_leem on public.mensagens_pre_compra
for select to authenticated using (public.utilizador_participa_conversa_pre_compra(conversa_id));
create policy leituras_pre_compra_proprias_leem on public.leituras_mensagens_pre_compra
for select to authenticated using (utilizador_id = auth.uid() and public.utilizador_participa_conversa_pre_compra(conversa_id));

create or replace function public.validar_participacao_conversa_pre_compra(
  p_conversa_id uuid
)
returns public.conversas_pre_compra language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare v_conversa public.conversas_pre_compra%rowtype;
begin
  if auth.uid() is null or public.eh_admin() then
    raise exception 'Não foi possível aceder à conversa.';
  end if;
  select * into v_conversa from public.conversas_pre_compra where id = p_conversa_id;
  if not found or not public.utilizador_participa_conversa_pre_compra(p_conversa_id) then
    raise exception 'Não foi possível aceder à conversa.';
  end if;
  return v_conversa;
end $$;

create or replace function public.abrir_ou_obter_conversa_pre_compra(p_produto_id uuid)
returns table (id uuid, produto_id uuid, vendedor_id uuid, estado text, encomenda_id uuid, criado_em timestamptz, atualizado_em timestamptz, encerrada_em timestamptz)
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_conversa public.conversas_pre_compra%rowtype; v_produto record; v_total integer;
begin
  if auth.uid() is null or public.eh_admin() or p_produto_id is null then
    raise exception 'Não foi possível abrir esta conversa.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('pre-compra:abrir:' || auth.uid()::text, 0));
  select c.* into v_conversa from public.conversas_pre_compra c
  where c.solicitante_user_id = auth.uid()
    and c.produto_id = p_produto_id
    and c.estado = 'aberta';
  if found then
    return query select v_conversa.id,v_conversa.produto_id,v_conversa.vendedor_id,v_conversa.estado,v_conversa.encomenda_id,v_conversa.criado_em,v_conversa.atualizado_em,v_conversa.encerrada_em;
    return;
  end if;
  select p.id,p.vendedor_id,p.categoria_id,p.subcategoria_id,p.provincia,v.user_id
  into v_produto from public.produtos p join public.vendedores v on v.id=p.vendedor_id
  where p.id=p_produto_id and p.publicado=true and p.disponivel=true
    and v.status_aprovacao='aprovado' and coalesce(v.conta_ativa,false)=true
    and public.produto_eh_operacional_fase1(p.categoria_id,p.subcategoria_id,p.provincia,p.vendedor_id)
  for key share;
  if not found or v_produto.user_id is null or v_produto.user_id = auth.uid() then
    raise exception 'Não foi possível abrir esta conversa.';
  end if;
  select count(*) into v_total from public.conversas_pre_compra c
  where c.solicitante_user_id=auth.uid() and c.criado_em >= now()-interval '15 minutes';
  if v_total >= 5 then raise exception 'Não foi possível abrir esta conversa.'; end if;
  select count(*) into v_total from public.conversas_pre_compra c
  where c.solicitante_user_id=auth.uid() and c.criado_em >= now()-interval '24 hours';
  if v_total >= 20 then raise exception 'Não foi possível abrir esta conversa.'; end if;
  insert into public.conversas_pre_compra(solicitante_user_id,vendedor_id,produto_id)
  values(auth.uid(),v_produto.vendedor_id,p_produto_id) returning * into v_conversa;
  return query select v_conversa.id,v_conversa.produto_id,v_conversa.vendedor_id,v_conversa.estado,v_conversa.encomenda_id,v_conversa.criado_em,v_conversa.atualizado_em,v_conversa.encerrada_em;
end $$;

create or replace function public.listar_caixa_entrada_pre_compra(
  p_limite integer default 20, p_antes_de timestamptz default null, p_antes_id uuid default null
)
returns table (id uuid,produto_id uuid,vendedor_id uuid,estado text,encomenda_id uuid,criado_em timestamptz,atualizado_em timestamptz,encerrada_em timestamptz,produto_nome text,contraparte_nome text,ultima_mensagem_em timestamptz,ultima_mensagem_previa text,mensagens_nao_lidas bigint)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or public.eh_admin() or p_limite is null or p_limite not between 1 and 50 or (p_antes_de is null) <> (p_antes_id is null) then raise exception 'Não foi possível listar as conversas.'; end if;
  return query select c.id,c.produto_id,c.vendedor_id,c.estado,c.encomenda_id,c.criado_em,c.atualizado_em,c.encerrada_em,
    p.nome_produto,
    case when c.solicitante_user_id=auth.uid() then coalesce(nullif(btrim(v.nome_comercial),''),'Vendedor') else coalesce(nullif(btrim(cl.nome),''),'Comprador') end,
    ultima.criado_em,
    ultima.previa,
    coalesce(nao_lidas.total,0)::bigint
  from public.conversas_pre_compra c
  join public.vendedores v on v.id=c.vendedor_id
  join public.produtos p on p.id=c.produto_id
  left join public.clientes cl on cl.id=c.solicitante_user_id
  left join lateral (select m.criado_em,left(m.corpo,160) as previa from public.mensagens_pre_compra m where m.conversa_id=c.id order by m.criado_em desc,m.id desc limit 1) ultima on true
  left join lateral (select count(*)::bigint as total from public.mensagens_pre_compra m left join public.leituras_mensagens_pre_compra l on l.conversa_id=c.id and l.utilizador_id=auth.uid() where m.conversa_id=c.id and m.remetente_user_id is distinct from auth.uid() and m.criado_em>coalesce(l.ultima_leitura_em,'epoch'::timestamptz)) nao_lidas on true
  where (c.solicitante_user_id=auth.uid() or v.user_id=auth.uid())
    and (p_antes_de is null or (c.atualizado_em,c.id)<(p_antes_de,p_antes_id))
  order by c.atualizado_em desc,c.id desc limit p_limite;
end $$;

create or replace function public.obter_conversa_pre_compra(p_conversa_id uuid)
returns table (id uuid,produto_id uuid,vendedor_id uuid,estado text,encomenda_id uuid,criado_em timestamptz,atualizado_em timestamptz,encerrada_em timestamptz)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$ begin perform public.validar_participacao_conversa_pre_compra(p_conversa_id); return query select c.id,c.produto_id,c.vendedor_id,c.estado,c.encomenda_id,c.criado_em,c.atualizado_em,c.encerrada_em from public.conversas_pre_compra c where c.id=p_conversa_id; end $$;

create or replace function public.listar_mensagens_pre_compra(
  p_conversa_id uuid,p_limite integer default 30,p_antes_de timestamptz default null,p_antes_id uuid default null
)
returns table (id uuid,conversa_id uuid,remetente_user_id uuid,corpo text,criado_em timestamptz)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
begin
  perform public.validar_participacao_conversa_pre_compra(p_conversa_id);
  if p_limite is null or p_limite not between 1 and 100 or (p_antes_de is null) <> (p_antes_id is null) then raise exception 'Não foi possível listar as mensagens.'; end if;
  return query select m.id,m.conversa_id,m.remetente_user_id,m.corpo,m.criado_em from public.mensagens_pre_compra m
  where m.conversa_id=p_conversa_id and (p_antes_de is null or (m.criado_em,m.id)<(p_antes_de,p_antes_id))
  order by m.criado_em desc,m.id desc limit p_limite;
end $$;

create or replace function public.atualizar_atividade_conversa_pre_compra()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$ begin update public.conversas_pre_compra set atualizado_em=new.criado_em where id=new.conversa_id; return new; end $$;
create trigger mensagens_pre_compra_atualizam_conversa after insert on public.mensagens_pre_compra for each row execute function public.atualizar_atividade_conversa_pre_compra();

create or replace function public.notificar_mensagem_pre_compra()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_conversa public.conversas_pre_compra%rowtype; v_vendedor_user uuid; v_destinatario uuid; v_contexto text;
begin
  select * into v_conversa from public.conversas_pre_compra where id=new.conversa_id;
  select user_id into v_vendedor_user from public.vendedores where id=v_conversa.vendedor_id;
  if new.remetente_user_id=v_conversa.solicitante_user_id then v_destinatario:=v_vendedor_user; v_contexto:='venda'; else v_destinatario:=v_conversa.solicitante_user_id; v_contexto:='compra'; end if;
  if v_destinatario is not null and v_destinatario is distinct from new.remetente_user_id then
    perform public.criar_notificacao(v_destinatario,v_contexto,'mensagem_pre_compra','Nova mensagem','Recebeste uma nova mensagem.','conversa_pre_compra',new.conversa_id,'/dashboard/mensagens/pre-compra/'||new.conversa_id::text,'{}'::jsonb,'mensagem-pre-compra:'||new.id::text||':'||v_destinatario::text);
  end if;
  return new;
end $$;
create trigger mensagens_pre_compra_notificam after insert on public.mensagens_pre_compra for each row execute function public.notificar_mensagem_pre_compra();

create or replace function public.enviar_mensagem_pre_compra(p_conversa_id uuid,p_corpo text,p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_conversa public.conversas_pre_compra%rowtype; v_id uuid; v_total integer;
begin
  if auth.uid() is null or public.eh_admin() or p_idempotency_key is null or char_length(btrim(coalesce(p_corpo,''))) not between 1 and 1000 then raise exception 'Não foi possível enviar a mensagem.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pre-compra:enviar:'||auth.uid()::text,0));
  select id into v_id from public.mensagens_pre_compra where conversa_id=p_conversa_id and remetente_user_id=auth.uid() and chave_idempotencia=p_idempotency_key;
  if found then return v_id; end if;
  select * into v_conversa from public.conversas_pre_compra where id=p_conversa_id for update;
  if not found or not public.utilizador_participa_conversa_pre_compra(p_conversa_id) or v_conversa.estado<>'aberta' then raise exception 'Não foi possível enviar a mensagem.'; end if;
  if not exists (select 1 from public.produtos p join public.vendedores v on v.id=p.vendedor_id where p.id=v_conversa.produto_id and p.vendedor_id=v_conversa.vendedor_id and p.publicado and p.disponivel and v.status_aprovacao='aprovado' and coalesce(v.conta_ativa,false) and public.produto_eh_operacional_fase1(p.categoria_id,p.subcategoria_id,p.provincia,p.vendedor_id)) then raise exception 'Não foi possível enviar a mensagem.'; end if;
  select count(*) into v_total from public.mensagens_pre_compra m where m.remetente_user_id=auth.uid() and m.conversa_id=p_conversa_id and m.criado_em>=now()-interval '1 minute'; if v_total>=10 then raise exception 'Não foi possível enviar a mensagem.'; end if;
  select count(*) into v_total from public.mensagens_pre_compra where remetente_user_id=auth.uid() and conversa_id=p_conversa_id and criado_em>=now()-interval '24 hours'; if v_total>=100 then raise exception 'Não foi possível enviar a mensagem.'; end if;
  insert into public.mensagens_pre_compra(conversa_id,remetente_user_id,corpo,chave_idempotencia) values(p_conversa_id,auth.uid(),btrim(p_corpo),p_idempotency_key) returning id into v_id;
  return v_id;
end $$;

create or replace function public.marcar_conversa_pre_compra_como_lida(p_conversa_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public
as $$ begin perform public.validar_participacao_conversa_pre_compra(p_conversa_id); insert into public.leituras_mensagens_pre_compra(conversa_id,utilizador_id,ultima_leitura_em) values(p_conversa_id,auth.uid(),now()) on conflict(conversa_id,utilizador_id) do update set ultima_leitura_em=excluded.ultima_leitura_em; end $$;

-- Sem grant ao browser: Bloco B chama isto dentro do checkout transacional autorizado.
create or replace function public.vincular_conversa_pre_compra_encomenda(p_conversa_id uuid,p_encomenda_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_conversa public.conversas_pre_compra%rowtype; v_encomenda public.encomendas%rowtype;
begin
  select * into v_conversa from public.conversas_pre_compra where id=p_conversa_id for update;
  select * into v_encomenda from public.encomendas where id=p_encomenda_id for key share;
  if v_conversa.id is null or v_encomenda.id is null or v_conversa.solicitante_user_id is distinct from auth.uid() or not exists(select 1 from public.clientes c where c.id=v_encomenda.cliente_id and c.id=auth.uid()) or v_encomenda.vendedor_id is distinct from v_conversa.vendedor_id or not exists(select 1 from public.itens_encomenda i where i.encomenda_id=p_encomenda_id and i.produto_id=v_conversa.produto_id) then raise exception 'Não foi possível associar a conversa.'; end if;
  if v_conversa.encomenda_id is not null and v_conversa.encomenda_id is distinct from p_encomenda_id then raise exception 'Não foi possível associar a conversa.'; end if;
  if v_conversa.estado='somente_leitura' and v_conversa.encomenda_id=p_encomenda_id then return; end if;
  if v_conversa.estado <> 'aberta' then raise exception 'Não foi possível associar a conversa.'; end if;
  update public.conversas_pre_compra set estado='somente_leitura',encomenda_id=p_encomenda_id,encerrada_em=coalesce(encerrada_em,now()),atualizado_em=now() where id=p_conversa_id;
end $$;

create or replace function public.obter_telefone_contraparte_encomenda(p_encomenda_id uuid)
returns table (telefone text) language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_encomenda public.encomendas%rowtype; v_cliente_user uuid; v_vendedor_user uuid; v_telefone text; v_contraparte uuid; v_cliente_existe boolean; v_vendedor_existe boolean;
begin
  if auth.uid() is null or public.eh_admin() then raise exception 'Não foi possível obter o contacto desta encomenda.'; end if;
  select * into v_encomenda from public.encomendas where id=p_encomenda_id;
  if v_encomenda.id is null then raise exception 'Não foi possível obter o contacto desta encomenda.'; end if;
  select c.id, true into v_cliente_user,v_cliente_existe from public.clientes c where c.id=v_encomenda.cliente_id;
  select v.user_id, true into v_vendedor_user,v_vendedor_existe from public.vendedores v where v.id=v_encomenda.vendedor_id;
  if not coalesce(v_cliente_existe,false) or not coalesce(v_vendedor_existe,false) or v_encomenda.estado not in ('confirmada','em_preparacao','pronta_para_levantamento','levantada','recolhida','chegou_destino','concluida') or (v_encomenda.estado='concluida' and (v_encomenda.concluido_em is null or v_encomenda.concluido_em < now()-interval '7 days')) then raise exception 'Não foi possível obter o contacto desta encomenda.'; end if;
  if auth.uid()=v_cliente_user and v_vendedor_user is distinct from auth.uid() then select coalesce(nullif(btrim(v.telefone_whatsapp),''),nullif(btrim(v.whatsapp),'')) into v_telefone from public.vendedores v where v.id=v_encomenda.vendedor_id; v_contraparte:=v_vendedor_user;
  elsif auth.uid()=v_vendedor_user and v_cliente_user is distinct from auth.uid() then select c.telefone into v_telefone from public.clientes c where c.id=v_encomenda.cliente_id; v_contraparte:=v_cliente_user;
  else raise exception 'Não foi possível obter o contacto desta encomenda.'; end if;
  v_telefone := regexp_replace(btrim(coalesce(v_telefone,'')), '[^0-9+]', '', 'g');
  if v_telefone !~ '^[+]?[0-9]{7,15}$' then raise exception 'Não foi possível obter o contacto desta encomenda.'; end if;
  insert into public.acessos_telefone_encomenda(solicitante_user_id,encomenda_id,contraparte_user_id) values(auth.uid(),p_encomenda_id,v_contraparte);
  return query select v_telefone;
end $$;

revoke all on public.conversas_pre_compra,public.mensagens_pre_compra,public.leituras_mensagens_pre_compra,public.acessos_telefone_encomenda from public,anon,authenticated;
grant select on public.conversas_pre_compra,public.mensagens_pre_compra,public.leituras_mensagens_pre_compra to authenticated;
revoke all on function public.utilizador_participa_conversa_pre_compra(uuid),public.validar_participacao_conversa_pre_compra(uuid),public.atualizar_atividade_conversa_pre_compra(),public.notificar_mensagem_pre_compra(),public.vincular_conversa_pre_compra_encomenda(uuid,uuid) from public,anon,authenticated;
grant execute on function public.utilizador_participa_conversa_pre_compra(uuid) to authenticated;
revoke all on function public.abrir_ou_obter_conversa_pre_compra(uuid),public.listar_caixa_entrada_pre_compra(integer,timestamptz,uuid),public.obter_conversa_pre_compra(uuid),public.listar_mensagens_pre_compra(uuid,integer,timestamptz,uuid),public.enviar_mensagem_pre_compra(uuid,text,uuid),public.marcar_conversa_pre_compra_como_lida(uuid),public.obter_telefone_contraparte_encomenda(uuid) from public,anon;
grant execute on function public.abrir_ou_obter_conversa_pre_compra(uuid),public.listar_caixa_entrada_pre_compra(integer,timestamptz,uuid),public.obter_conversa_pre_compra(uuid),public.listar_mensagens_pre_compra(uuid,integer,timestamptz,uuid),public.enviar_mensagem_pre_compra(uuid,text,uuid),public.marcar_conversa_pre_compra_como_lida(uuid),public.obter_telefone_contraparte_encomenda(uuid) to authenticated;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mensagens_pre_compra') then alter publication supabase_realtime add table public.mensagens_pre_compra; end if;
end $$;

commit;
