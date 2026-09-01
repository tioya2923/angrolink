-- ANGROLINK — intervenção administrativa mínima para exceções de entrega.
-- Depende do fecho operacional de entrega Fase 1 (20260828120000).
begin;

alter table public.eventos_encomenda drop constraint if exists eventos_encomenda_tipo_evento_check;
alter table public.eventos_encomenda add constraint eventos_encomenda_tipo_evento_check check (tipo_evento in (
  'encomenda_criada', 'vendedor_confirmou', 'vendedor_recusou', 'preparacao_iniciada',
  'pronta_para_levantamento', 'levantamento_confirmado', 'encomenda_concluida',
  'cliente_cancelou', 'codigo_levantamento_gerado', 'codigo_levantamento_regenerado',
  'tentativa_levantamento_falhou', 'problema_reportado', 'entregador_atribuido',
  'entregador_aceitou', 'entregador_recusou', 'entregador_chegou_origem',
  'encomenda_recolhida', 'entregador_chegou_destino', 'codigo_entrega_gerado',
  'codigo_entrega_regenerado', 'tentativa_entrega_falhou', 'entrega_confirmada',
  'atribuicao_liberada_admin', 'incidente_operacional_aberto',
  'incidente_operacional_resolvido'
));

create table public.idempotencia_intervencao_entrega_admin (
  id uuid primary key default gen_random_uuid(),
  administrador_id uuid not null references auth.users(id) on delete restrict,
  operacao text not null check (operacao in ('libertar_atribuicao', 'abrir_incidente', 'resolver_incidente')),
  chave_idempotencia uuid not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  atribuicao_id uuid references public.atribuicoes_entrega_encomenda(id) on delete restrict,
  incidente_id uuid,
  criada_em timestamptz not null default now(),
  concluida_em timestamptz,
  unique (administrador_id, operacao, chave_idempotencia)
);

create table public.incidentes_operacionais_entrega (
  id uuid primary key default gen_random_uuid(),
  encomenda_id uuid not null references public.encomendas(id) on delete restrict,
  atribuicao_id uuid not null references public.atribuicoes_entrega_encomenda(id) on delete restrict,
  tipo text not null check (tipo in ('entregador_indisponivel', 'vendedor_indisponivel', 'cliente_indisponivel', 'problema_veiculo', 'problema_pagamento', 'problema_otp', 'outro')),
  motivo text not null check (char_length(btrim(motivo)) between 3 and 500),
  estado text not null default 'aberto' check (estado in ('aberto', 'resolvido')),
  criado_por uuid not null references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now(),
  resolvido_por uuid references auth.users(id) on delete restrict,
  resolvido_em timestamptz,
  observacao_resolucao text,
  atualizado_em timestamptz not null default now(),
  constraint incidente_resolucao_consistente check (
    (estado = 'aberto' and resolvido_por is null and resolvido_em is null and observacao_resolucao is null)
    or (estado = 'resolvido' and resolvido_por is not null and resolvido_em is not null and char_length(btrim(observacao_resolucao)) between 3 and 500)
  )
);

alter table public.idempotencia_intervencao_entrega_admin
  add constraint idempotencia_intervencao_incidente_fk
  foreign key (incidente_id) references public.incidentes_operacionais_entrega(id) on delete restrict;

create unique index incidentes_operacionais_entrega_um_aberto_por_atribuicao_idx
  on public.incidentes_operacionais_entrega (atribuicao_id) where estado = 'aberto';
create index incidentes_operacionais_entrega_encomenda_criado_idx
  on public.incidentes_operacionais_entrega (encomenda_id, criado_em desc);

create or replace function public.atualizar_atualizado_em_incidente_operacional_entrega()
returns trigger language plpgsql set search_path = public as $$
begin new.atualizado_em = now(); return new; end;
$$;
create trigger atualizar_incidente_operacional_entrega_em before update on public.incidentes_operacionais_entrega
for each row execute function public.atualizar_atualizado_em_incidente_operacional_entrega();

alter table public.idempotencia_intervencao_entrega_admin enable row level security;
alter table public.incidentes_operacionais_entrega enable row level security;
revoke all on table public.idempotencia_intervencao_entrega_admin, public.incidentes_operacionais_entrega from public, anon, authenticated;

create or replace function public.hash_intervencao_entrega_admin(p_payload jsonb)
returns text language sql immutable set search_path = public as $$
  select encode(extensions.digest(convert_to(p_payload::text, 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function public.libertar_atribuicao_entrega_admin(
  p_atribuicao_id uuid, p_motivo text, p_chave_idempotencia uuid
) returns public.atribuicoes_entrega_encomenda
language plpgsql security definer set search_path = public as $$
declare
  v_motivo text := nullif(btrim(p_motivo), ''); v_hash text;
  v_idempotencia public.idempotencia_intervencao_entrega_admin%rowtype;
  v_atribuicao public.atribuicoes_entrega_encomenda%rowtype; v_encomenda public.encomendas%rowtype;
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if p_atribuicao_id is null or p_chave_idempotencia is null or v_motivo is null or char_length(v_motivo) not between 3 and 500 then
    raise exception 'Indique um motivo entre 3 e 500 caracteres.';
  end if;
  v_hash := public.hash_intervencao_entrega_admin(jsonb_build_object('atribuicao_id', p_atribuicao_id, 'motivo', v_motivo));
  insert into public.idempotencia_intervencao_entrega_admin(administrador_id,operacao,chave_idempotencia,payload_hash)
  values(auth.uid(),'libertar_atribuicao',p_chave_idempotencia,v_hash)
  on conflict (administrador_id,operacao,chave_idempotencia) do nothing;
  select * into v_idempotencia from public.idempotencia_intervencao_entrega_admin
  where administrador_id=auth.uid() and operacao='libertar_atribuicao' and chave_idempotencia=p_chave_idempotencia for update;
  if v_idempotencia.payload_hash <> v_hash then raise exception 'A chave de idempotência já foi usada com dados diferentes.'; end if;
  if v_idempotencia.atribuicao_id is not null then
    select * into v_atribuicao from public.atribuicoes_entrega_encomenda where id=v_idempotencia.atribuicao_id;
    return v_atribuicao;
  end if;
  select * into v_atribuicao from public.atribuicoes_entrega_encomenda where id=p_atribuicao_id for update;
  if not found then raise exception 'Atribuição não encontrada.'; end if;
  select * into v_encomenda from public.encomendas where id=v_atribuicao.encomenda_id for update;
  if v_encomenda.modalidade_recebimento <> 'entrega' or v_encomenda.estado <> 'pronta_para_levantamento' then raise exception 'Esta encomenda já não pode ter a atribuição libertada.'; end if;
  if v_atribuicao.estado not in ('atribuida','aceite','chegou_origem') or v_atribuicao.recolhida_em is not null then
    raise exception 'Não é possível libertar esta tarefa porque a mercadoria já foi recolhida ou a atribuição não está ativa.';
  end if;
  update public.atribuicoes_entrega_encomenda set estado='cancelada',cancelado_em=now(),motivo_cancelamento=v_motivo
  where id=v_atribuicao.id returning * into v_atribuicao;
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados)
  values(v_encomenda.id,'atribuicao_liberada_admin',v_encomenda.estado,v_encomenda.estado,'admin',auth.uid(),jsonb_build_object('atribuicao_id',v_atribuicao.id,'motivo',v_motivo));
  update public.idempotencia_intervencao_entrega_admin set atribuicao_id=v_atribuicao.id,concluida_em=now() where id=v_idempotencia.id;
  return v_atribuicao;
end;
$$;

create or replace function public.registar_incidente_operacional_entrega_admin(
  p_atribuicao_id uuid, p_tipo text, p_motivo text, p_chave_idempotencia uuid
) returns public.incidentes_operacionais_entrega
language plpgsql security definer set search_path = public as $$
declare v_tipo text:=nullif(btrim(p_tipo),''); v_motivo text:=nullif(btrim(p_motivo),''); v_hash text;
  v_idempotencia public.idempotencia_intervencao_entrega_admin%rowtype; v_atribuicao public.atribuicoes_entrega_encomenda%rowtype; v_encomenda public.encomendas%rowtype; v_incidente public.incidentes_operacionais_entrega%rowtype;
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if p_atribuicao_id is null or p_chave_idempotencia is null or v_tipo not in ('entregador_indisponivel','vendedor_indisponivel','cliente_indisponivel','problema_veiculo','problema_pagamento','problema_otp','outro') or v_motivo is null or char_length(v_motivo) not between 3 and 500 then raise exception 'Indique um tipo e um motivo entre 3 e 500 caracteres.'; end if;
  v_hash:=public.hash_intervencao_entrega_admin(jsonb_build_object('atribuicao_id',p_atribuicao_id,'tipo',v_tipo,'motivo',v_motivo));
  insert into public.idempotencia_intervencao_entrega_admin(administrador_id,operacao,chave_idempotencia,payload_hash) values(auth.uid(),'abrir_incidente',p_chave_idempotencia,v_hash) on conflict (administrador_id,operacao,chave_idempotencia) do nothing;
  select * into v_idempotencia from public.idempotencia_intervencao_entrega_admin where administrador_id=auth.uid() and operacao='abrir_incidente' and chave_idempotencia=p_chave_idempotencia for update;
  if v_idempotencia.payload_hash<>v_hash then raise exception 'A chave de idempotência já foi usada com dados diferentes.'; end if;
  if v_idempotencia.incidente_id is not null then select * into v_incidente from public.incidentes_operacionais_entrega where id=v_idempotencia.incidente_id; return v_incidente; end if;
  select * into v_atribuicao from public.atribuicoes_entrega_encomenda where id=p_atribuicao_id for update; if not found then raise exception 'Atribuição não encontrada.'; end if;
  select * into v_encomenda from public.encomendas where id=v_atribuicao.encomenda_id for update;
  if v_encomenda.modalidade_recebimento<>'entrega' or v_atribuicao.estado not in ('recolhida','chegou_destino') or v_encomenda.estado not in ('recolhida','chegou_destino') then raise exception 'Um incidente operacional só pode ser registado depois da recolha.'; end if;
  select * into v_incidente from public.incidentes_operacionais_entrega where atribuicao_id=v_atribuicao.id and estado='aberto' for update;
  if found then raise exception 'Já existe um incidente operacional aberto para esta tarefa.'; end if;
  insert into public.incidentes_operacionais_entrega(encomenda_id,atribuicao_id,tipo,motivo,criado_por) values(v_encomenda.id,v_atribuicao.id,v_tipo,v_motivo,auth.uid()) returning * into v_incidente;
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(v_encomenda.id,'incidente_operacional_aberto',v_encomenda.estado,v_encomenda.estado,'admin',auth.uid(),jsonb_build_object('atribuicao_id',v_atribuicao.id,'incidente_id',v_incidente.id,'tipo',v_tipo));
  update public.idempotencia_intervencao_entrega_admin set atribuicao_id=v_atribuicao.id,incidente_id=v_incidente.id,concluida_em=now() where id=v_idempotencia.id;
  return v_incidente;
end;
$$;

create or replace function public.resolver_incidente_operacional_entrega_admin(
  p_incidente_id uuid, p_observacao text, p_chave_idempotencia uuid
) returns public.incidentes_operacionais_entrega
language plpgsql security definer set search_path = public as $$
declare v_observacao text:=nullif(btrim(p_observacao),''); v_hash text; v_idempotencia public.idempotencia_intervencao_entrega_admin%rowtype; v_incidente public.incidentes_operacionais_entrega%rowtype;
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if p_incidente_id is null or p_chave_idempotencia is null or v_observacao is null or char_length(v_observacao) not between 3 and 500 then raise exception 'Indique uma observação entre 3 e 500 caracteres.'; end if;
  v_hash:=public.hash_intervencao_entrega_admin(jsonb_build_object('incidente_id',p_incidente_id,'observacao',v_observacao));
  insert into public.idempotencia_intervencao_entrega_admin(administrador_id,operacao,chave_idempotencia,payload_hash) values(auth.uid(),'resolver_incidente',p_chave_idempotencia,v_hash) on conflict (administrador_id,operacao,chave_idempotencia) do nothing;
  select * into v_idempotencia from public.idempotencia_intervencao_entrega_admin where administrador_id=auth.uid() and operacao='resolver_incidente' and chave_idempotencia=p_chave_idempotencia for update;
  if v_idempotencia.payload_hash<>v_hash then raise exception 'A chave de idempotência já foi usada com dados diferentes.'; end if;
  if v_idempotencia.incidente_id is not null then select * into v_incidente from public.incidentes_operacionais_entrega where id=v_idempotencia.incidente_id; return v_incidente; end if;
  select * into v_incidente from public.incidentes_operacionais_entrega where id=p_incidente_id for update; if not found then raise exception 'Incidente operacional não encontrado.'; end if;
  if v_incidente.estado='resolvido' then raise exception 'Este incidente operacional já foi resolvido.'; end if;
  update public.incidentes_operacionais_entrega set estado='resolvido',resolvido_por=auth.uid(),resolvido_em=now(),observacao_resolucao=v_observacao where id=v_incidente.id returning * into v_incidente;
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(v_incidente.encomenda_id,'incidente_operacional_resolvido',null,null,'admin',auth.uid(),jsonb_build_object('atribuicao_id',v_incidente.atribuicao_id,'incidente_id',v_incidente.id));
  update public.idempotencia_intervencao_entrega_admin set atribuicao_id=v_incidente.atribuicao_id,incidente_id=v_incidente.id,concluida_em=now() where id=v_idempotencia.id;
  return v_incidente;
end;
$$;

create or replace function public.obter_incidente_operacional_entrega_admin(p_encomenda_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_resultado jsonb;
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  select jsonb_build_object('id',i.id,'atribuicao_id',i.atribuicao_id,'tipo',i.tipo,'motivo',i.motivo,'estado',i.estado,'criado_em',i.criado_em,'resolvido_em',i.resolvido_em,'observacao_resolucao',i.observacao_resolucao)
  into v_resultado from public.incidentes_operacionais_entrega i where i.encomenda_id=p_encomenda_id order by i.criado_em desc,i.id desc limit 1;
  return coalesce(v_resultado,'{}'::jsonb);
end;
$$;

create or replace function public.notificar_intervencao_admin_entrega()
returns trigger language plpgsql security definer set search_path=public as $$
declare e public.encomendas%rowtype; a public.atribuicoes_entrega_encomenda%rowtype; destino uuid; atribuicao uuid:=nullif(new.metadados->>'atribuicao_id','')::uuid; url_compra text;
begin
    select * into e from public.encomendas where id=new.encomenda_id; if not found then raise exception 'Encomenda da intervenção não encontrada.'; end if;
    select case when exists(select 1 from public.vendedores v where v.user_id=e.cliente_id) then '/dashboard/compras/'||e.id else '/dashboard/encomendas/'||e.id end into url_compra;
    select * into a from public.atribuicoes_entrega_encomenda where id=atribuicao;
    if new.tipo_evento='atribuicao_liberada_admin' then
      select p.user_id into destino from public.parceiros_entrega p where p.id=a.parceiro_entrega_id; if destino is not null then perform public.criar_notificacao(destino,'entrega','atribuicao_liberada_admin','Tarefa retirada','A tarefa foi retirada pela operação ANGROLINK.','atribuicao_entrega',a.id,'/dashboard/tarefas/'||a.id,'{}'::jsonb,'intervencao:'||new.id||':entregador'); end if;
      if e.cliente_id is not null then perform public.criar_notificacao(e.cliente_id,'compra','entrega_reorganizada','Entrega em reorganização','Estamos a reorganizar a entrega da tua encomenda.','encomenda',e.id,url_compra,'{}'::jsonb,'intervencao:'||new.id||':cliente'); end if;
      select user_id into destino from public.vendedores where id=e.vendedor_id; if destino is not null then perform public.criar_notificacao(destino,'venda','entrega_reorganizada','Entrega em reorganização','Estamos a reorganizar a entrega desta encomenda.','encomenda',e.id,'/dashboard/encomendas/'||e.id,'{}'::jsonb,'intervencao:'||new.id||':vendedor'); end if;
    elsif new.tipo_evento='incidente_operacional_aberto' then
      if e.cliente_id is not null then perform public.criar_notificacao(e.cliente_id,'compra','incidente_entrega','Entrega acompanhada','A entrega está a ser acompanhada pela equipa ANGROLINK.','encomenda',e.id,url_compra,'{}'::jsonb,'intervencao:'||new.id||':cliente'); end if;
      select user_id into destino from public.vendedores where id=e.vendedor_id; if destino is not null then perform public.criar_notificacao(destino,'venda','incidente_entrega','Entrega acompanhada','A entrega está a ser acompanhada pela equipa ANGROLINK.','encomenda',e.id,'/dashboard/encomendas/'||e.id,'{}'::jsonb,'intervencao:'||new.id||':vendedor'); end if;
      select p.user_id into destino from public.parceiros_entrega p where p.id=a.parceiro_entrega_id; if destino is not null then perform public.criar_notificacao(destino,'entrega','incidente_entrega','Ocorrência sinalizada','A operação ANGROLINK registou uma ocorrência nesta tarefa.','atribuicao_entrega',a.id,'/dashboard/tarefas/'||a.id,'{}'::jsonb,'intervencao:'||new.id||':entregador'); end if;
    end if;
  return new;
end;
$$;
create trigger criar_notificacao_intervencao_admin_entrega after insert on public.eventos_encomenda for each row when (new.tipo_evento in ('atribuicao_liberada_admin','incidente_operacional_aberto')) execute function public.notificar_intervencao_admin_entrega();

-- Helpers de trigger/hash não são uma superfície RPC do browser.
revoke all on function public.hash_intervencao_entrega_admin(jsonb), public.atualizar_atualizado_em_incidente_operacional_entrega(), public.notificar_intervencao_admin_entrega() from public, anon, authenticated;
revoke all on function public.libertar_atribuicao_entrega_admin(uuid,text,uuid), public.registar_incidente_operacional_entrega_admin(uuid,text,text,uuid), public.resolver_incidente_operacional_entrega_admin(uuid,text,uuid), public.obter_incidente_operacional_entrega_admin(uuid) from public, anon;
grant execute on function public.libertar_atribuicao_entrega_admin(uuid,text,uuid), public.registar_incidente_operacional_entrega_admin(uuid,text,text,uuid), public.resolver_incidente_operacional_entrega_admin(uuid,text,uuid), public.obter_incidente_operacional_entrega_admin(uuid) to authenticated;

commit;
