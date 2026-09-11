-- ANGROLINK — Bloco 4C: canais operacionais privados por atribuição.
begin;

alter table public.atribuicoes_entrega_encomenda
  add constraint atribuicoes_entrega_encomenda_id_encomenda_key unique (id, encomenda_id);

alter table public.mensagens_encomenda
  add column canal text,
  add column atribuicao_entrega_id uuid;
update public.mensagens_encomenda set canal = 'comprador_vendedor' where canal is null;
alter table public.mensagens_encomenda
  alter column canal set not null,
  add constraint mensagens_encomenda_canal_check check (canal in ('comprador_vendedor','vendedor_entregador','comprador_entregador')),
  add constraint mensagens_encomenda_contexto_check check ((canal = 'comprador_vendedor' and atribuicao_entrega_id is null) or (canal in ('vendedor_entregador','comprador_entregador') and atribuicao_entrega_id is not null)),
  add constraint mensagens_encomenda_atribuicao_encomenda_fkey foreign key (atribuicao_entrega_id, encomenda_id) references public.atribuicoes_entrega_encomenda(id, encomenda_id) on delete restrict;
create index mensagens_encomenda_atribuicao_criado_idx on public.mensagens_encomenda(atribuicao_entrega_id, criado_em desc, id desc) where atribuicao_entrega_id is not null;

alter table public.leituras_mensagens_encomenda add column id uuid default gen_random_uuid(), add column canal text, add column atribuicao_entrega_id uuid;
update public.leituras_mensagens_encomenda set canal = 'comprador_vendedor' where canal is null;
alter table public.leituras_mensagens_encomenda alter column id set not null, alter column canal set not null;
alter table public.leituras_mensagens_encomenda drop constraint leituras_mensagens_encomenda_pkey;
alter table public.leituras_mensagens_encomenda add primary key (id),
  add constraint leituras_mensagens_encomenda_canal_check check (canal in ('comprador_vendedor','vendedor_entregador','comprador_entregador')),
  add constraint leituras_mensagens_encomenda_contexto_check check ((canal = 'comprador_vendedor' and atribuicao_entrega_id is null) or (canal in ('vendedor_entregador','comprador_entregador') and atribuicao_entrega_id is not null)),
  add constraint leituras_mensagens_encomenda_atribuicao_encomenda_fkey foreign key (atribuicao_entrega_id, encomenda_id) references public.atribuicoes_entrega_encomenda(id, encomenda_id) on delete restrict;
create unique index leituras_mensagens_encomenda_comercial_unica_idx on public.leituras_mensagens_encomenda(encomenda_id,canal,utilizador_id) where atribuicao_entrega_id is null;
create unique index leituras_mensagens_encomenda_logistica_unica_idx on public.leituras_mensagens_encomenda(encomenda_id,canal,atribuicao_entrega_id,utilizador_id) where atribuicao_entrega_id is not null;

drop policy mensagens_encomenda_leitura_participantes on public.mensagens_encomenda;
drop policy leituras_mensagens_encomenda_leitura_propria on public.leituras_mensagens_encomenda;
drop function public.utilizador_participa_encomenda_mensagens(uuid,uuid);
create or replace function public.utilizador_participa_encomenda_mensagens(p_encomenda_id uuid,p_canal text,p_atribuicao_entrega_id uuid,p_utilizador_id uuid,p_para_envio boolean default false)
returns boolean language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare e public.encomendas%rowtype; vendedor_user uuid; parceiro_user uuid; estado_atribuicao text; aceite_atribuicao_em timestamptz; recolhida_atribuicao_em timestamptz;
begin
 if auth.uid() is null or p_utilizador_id is distinct from auth.uid() then return false; end if;
 select * into e from public.encomendas where id=p_encomenda_id; if not found then return false; end if;
 select user_id into vendedor_user from public.vendedores where id=e.vendedor_id;
 if p_canal='comprador_vendedor' then
   return coalesce(p_atribuicao_entrega_id is null and ((e.cliente_id is not null and p_utilizador_id=e.cliente_id) or (vendedor_user is not null and p_utilizador_id=vendedor_user)) and (not coalesce(p_para_envio,false) or (e.estado is distinct from 'concluida' and e.estado is distinct from 'cancelada' and e.estado is distinct from 'recusada')),false);
 end if;
 if (p_canal is distinct from 'vendedor_entregador' and p_canal is distinct from 'comprador_entregador') or p_atribuicao_entrega_id is null then return false; end if;
 select p.user_id,a.estado,a.aceite_em,a.recolhida_em into parceiro_user,estado_atribuicao,aceite_atribuicao_em,recolhida_atribuicao_em from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id where a.id=p_atribuicao_entrega_id and a.encomenda_id=e.id;
 if not found then return false; end if;
 if p_canal='vendedor_entregador' then
   if not ((vendedor_user is not null and p_utilizador_id=vendedor_user) or (parceiro_user is not null and p_utilizador_id=parceiro_user)) then return false; end if;
   return coalesce(case when coalesce(p_para_envio,false) then estado_atribuicao in ('aceite','chegou_origem','recolhida','chegou_destino') else estado_atribuicao in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') or (estado_atribuicao='cancelada' and aceite_atribuicao_em is not null) end,false);
 end if;
 if p_canal='comprador_entregador' then
   if not ((e.cliente_id is not null and p_utilizador_id=e.cliente_id) or (parceiro_user is not null and p_utilizador_id=parceiro_user)) then return false; end if;
   return coalesce(case when coalesce(p_para_envio,false) then estado_atribuicao in ('recolhida','chegou_destino') else estado_atribuicao in ('recolhida','chegou_destino','concluida') or (estado_atribuicao='cancelada' and recolhida_atribuicao_em is not null) end,false);
 end if;
 return false;
end $$;

create policy mensagens_encomenda_leitura_participantes on public.mensagens_encomenda for select to authenticated using (public.utilizador_participa_encomenda_mensagens(encomenda_id,canal,atribuicao_entrega_id,auth.uid(),false));
create policy leituras_mensagens_encomenda_leitura_propria on public.leituras_mensagens_encomenda for select to authenticated using (utilizador_id=auth.uid() and public.utilizador_participa_encomenda_mensagens(encomenda_id,canal,atribuicao_entrega_id,auth.uid(),false));

-- Mantém as quatro RPCs compatíveis: os dois novos parâmetros têm defaults.
drop function public.listar_mensagens_encomenda(uuid,integer,timestamptz,uuid);
drop function public.enviar_mensagem_encomenda(uuid,text);
drop function public.marcar_mensagens_encomenda_como_lidas(uuid);
drop function public.obter_resumo_mensagens_encomenda(uuid);
create or replace function public.listar_mensagens_encomenda(p_encomenda_id uuid,p_limite integer default 40,p_antes_de timestamptz default null,p_antes_id uuid default null,p_canal text default 'comprador_vendedor',p_atribuicao_entrega_id uuid default null)
returns table(mensagem_id uuid,encomenda_id uuid,remetente_user_id uuid,corpo text,criado_em timestamptz) language plpgsql stable security definer set search_path=pg_catalog,public as $$ begin
 if not public.utilizador_participa_encomenda_mensagens(p_encomenda_id,p_canal,p_atribuicao_entrega_id,auth.uid(),false) then raise exception 'Sem permissão para consultar as mensagens desta encomenda.'; end if;
 if (p_antes_de is null)<>(p_antes_id is null) then raise exception 'Cursor de mensagens inválido.'; end if;
 return query select m.id,m.encomenda_id,m.remetente_user_id,m.corpo,m.criado_em from public.mensagens_encomenda m where m.encomenda_id=p_encomenda_id and m.canal=p_canal and m.atribuicao_entrega_id is not distinct from p_atribuicao_entrega_id and (p_antes_de is null or (m.criado_em,m.id)<(p_antes_de,p_antes_id)) order by m.criado_em desc,m.id desc limit least(greatest(coalesce(p_limite,40),1),50); end $$;
create or replace function public.enviar_mensagem_encomenda(p_encomenda_id uuid,p_corpo text,p_canal text default 'comprador_vendedor',p_atribuicao_entrega_id uuid default null) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$ declare corpo_limpo text:=btrim(coalesce(p_corpo,'')); id_mensagem uuid; begin
 if not public.utilizador_participa_encomenda_mensagens(p_encomenda_id,p_canal,p_atribuicao_entrega_id,auth.uid(),true) then raise exception 'Sem permissão para enviar mensagens nesta encomenda.'; end if; if char_length(corpo_limpo) not between 1 and 1000 then raise exception 'A mensagem deve ter entre 1 e 1000 caracteres.'; end if;
 insert into public.mensagens_encomenda(encomenda_id,remetente_user_id,corpo,canal,atribuicao_entrega_id) values(p_encomenda_id,auth.uid(),corpo_limpo,p_canal,p_atribuicao_entrega_id) returning id into id_mensagem; return id_mensagem; end $$;
create or replace function public.marcar_mensagens_encomenda_como_lidas(p_encomenda_id uuid,p_canal text default 'comprador_vendedor',p_atribuicao_entrega_id uuid default null) returns void language plpgsql security definer set search_path=pg_catalog,public as $$ begin
 if not public.utilizador_participa_encomenda_mensagens(p_encomenda_id,p_canal,p_atribuicao_entrega_id,auth.uid(),false) then raise exception 'Sem permissão para marcar as mensagens desta encomenda.'; end if;
 if p_atribuicao_entrega_id is null then insert into public.leituras_mensagens_encomenda(encomenda_id,utilizador_id,ultima_leitura_em,canal) values(p_encomenda_id,auth.uid(),now(),p_canal) on conflict (encomenda_id,canal,utilizador_id) where atribuicao_entrega_id is null do update set ultima_leitura_em=excluded.ultima_leitura_em;
 else insert into public.leituras_mensagens_encomenda(encomenda_id,utilizador_id,ultima_leitura_em,canal,atribuicao_entrega_id) values(p_encomenda_id,auth.uid(),now(),p_canal,p_atribuicao_entrega_id) on conflict (encomenda_id,canal,atribuicao_entrega_id,utilizador_id) where atribuicao_entrega_id is not null do update set ultima_leitura_em=excluded.ultima_leitura_em; end if; end $$;
create or replace function public.obter_resumo_mensagens_encomenda(p_encomenda_id uuid,p_canal text default 'comprador_vendedor',p_atribuicao_entrega_id uuid default null) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$ declare lida timestamptz; begin
 if not public.utilizador_participa_encomenda_mensagens(p_encomenda_id,p_canal,p_atribuicao_entrega_id,auth.uid(),false) then raise exception 'Sem permissão para consultar as mensagens desta encomenda.'; end if;
 select ultima_leitura_em into lida from public.leituras_mensagens_encomenda where encomenda_id=p_encomenda_id and canal=p_canal and atribuicao_entrega_id is not distinct from p_atribuicao_entrega_id and utilizador_id=auth.uid(); return (select jsonb_build_object('total_mensagens',count(*),'nao_lidas',count(*) filter(where remetente_user_id<>auth.uid() and (lida is null or criado_em>lida)),'ultima_leitura_em',lida) from public.mensagens_encomenda where encomenda_id=p_encomenda_id and canal=p_canal and atribuicao_entrega_id is not distinct from p_atribuicao_entrega_id); end $$;

create or replace function public.notificar_mensagem_encomenda() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.encomendas%rowtype; vendedor_user uuid; parceiro_user uuid; destino uuid; contexto text; url text;
begin
 select * into e from public.encomendas where id=new.encomenda_id; if not found then return new; end if;
 select user_id into vendedor_user from public.vendedores where id=e.vendedor_id;
 if new.canal='comprador_vendedor' then destino:=case when new.remetente_user_id=e.cliente_id then vendedor_user when new.remetente_user_id=vendedor_user then e.cliente_id end; contexto:=case when destino=vendedor_user then 'venda' else 'compra' end; url:=case when destino=e.cliente_id and exists(select 1 from public.vendedores where user_id=destino) then '/dashboard/compras/'||e.id else '/dashboard/encomendas/'||e.id end;
 else select p.user_id into parceiro_user from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id where a.id=new.atribuicao_entrega_id and a.encomenda_id=e.id; if new.canal='vendedor_entregador' then destino:=case when new.remetente_user_id=vendedor_user then parceiro_user when new.remetente_user_id=parceiro_user then vendedor_user end; contexto:=case when destino=parceiro_user then 'entrega' else 'venda' end; url:=case when destino=parceiro_user then '/dashboard/tarefas/'||new.atribuicao_entrega_id else '/dashboard/encomendas/'||e.id end;
 elsif new.canal='comprador_entregador' then destino:=case when new.remetente_user_id=e.cliente_id then parceiro_user when new.remetente_user_id=parceiro_user then e.cliente_id end; contexto:=case when destino=parceiro_user then 'entrega' else 'compra' end; url:=case when destino=parceiro_user then '/dashboard/tarefas/'||new.atribuicao_entrega_id when exists(select 1 from public.vendedores where user_id=destino) then '/dashboard/compras/'||e.id else '/dashboard/encomendas/'||e.id end; end if; end if;
 if destino is not null and destino<>new.remetente_user_id then perform public.criar_notificacao(destino,contexto,'mensagem_encomenda','Nova mensagem','Nova mensagem numa encomenda.','encomenda',e.id,url,'{}'::jsonb,'mensagem:'||new.id||':'||destino); end if; return new;
exception when others then raise warning 'Não foi possível criar a notificação da mensagem %: %',new.id,sqlerrm; return new; end $$;
revoke all on function public.utilizador_participa_encomenda_mensagens(uuid,text,uuid,uuid,boolean),public.listar_mensagens_encomenda(uuid,integer,timestamptz,uuid,text,uuid),public.enviar_mensagem_encomenda(uuid,text,text,uuid),public.marcar_mensagens_encomenda_como_lidas(uuid,text,uuid),public.obter_resumo_mensagens_encomenda(uuid,text,uuid),public.notificar_mensagem_encomenda() from public,anon;
grant execute on function public.utilizador_participa_encomenda_mensagens(uuid,text,uuid,uuid,boolean),public.listar_mensagens_encomenda(uuid,integer,timestamptz,uuid,text,uuid),public.enviar_mensagem_encomenda(uuid,text,text,uuid),public.marcar_mensagens_encomenda_como_lidas(uuid,text,uuid),public.obter_resumo_mensagens_encomenda(uuid,text,uuid) to authenticated;
commit;
