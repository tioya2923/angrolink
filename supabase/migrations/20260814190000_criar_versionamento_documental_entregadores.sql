-- ANGROLINK — Versionamento documental de parceiros de entrega V1.
-- Mantém documentos_parceiro_entrega como cabeçalho lógico durante a transição.
begin;

create table if not exists public.versoes_documento_parceiro_entrega (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos_parceiro_entrega(id) on delete restrict,
  parceiro_id uuid not null references public.parceiros_entrega(id) on delete restrict,
  veiculo_id uuid references public.veiculos_entrega(id) on delete restrict,
  numero_versao integer not null check (numero_versao > 0),
  frente_path text not null,
  verso_path text not null,
  numero_documento_snapshot text,
  validade_snapshot date,
  estado text not null check (estado in ('pendente','aprovado','rejeitado','expirado')),
  analisado_por uuid references auth.users(id),
  analisado_em timestamptz,
  motivo_rejeicao text,
  substituido_em timestamptz,
  criado_em timestamptz not null default now(),
  constraint versoes_documento_parceiro_numero_unico unique (documento_id, numero_versao)
);

alter table public.documentos_parceiro_entrega add column if not exists versao_atual_id uuid;
alter table public.documentos_parceiro_entrega drop constraint if exists documentos_parceiro_versao_atual_fkey;
alter table public.documentos_parceiro_entrega add constraint documentos_parceiro_versao_atual_fkey
  foreign key (versao_atual_id) references public.versoes_documento_parceiro_entrega(id) on delete restrict;

create table if not exists public.eventos_documento_parceiro_entrega (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos_parceiro_entrega(id) on delete restrict,
  versao_id uuid references public.versoes_documento_parceiro_entrega(id) on delete restrict,
  parceiro_id uuid not null references public.parceiros_entrega(id) on delete restrict,
  ator_tipo text not null check (ator_tipo in ('parceiro','admin','sistema')),
  utilizador_id uuid references auth.users(id) on delete set null,
  evento text not null check (evento in ('enviado','submetido','aprovado','rejeitado','expirado','reenviado','substituido')),
  estado_anterior text,
  estado_novo text,
  motivo text,
  criado_em timestamptz not null default now()
);

create index if not exists versoes_documento_parceiro_atual_idx on public.versoes_documento_parceiro_entrega(documento_id, numero_versao desc);
create index if not exists eventos_documento_parceiro_historico_idx on public.eventos_documento_parceiro_entrega(parceiro_id, criado_em desc);

-- Cada documento legado passa a ter uma versão 1, sem mover ficheiros no Storage.
insert into public.versoes_documento_parceiro_entrega (
  documento_id, parceiro_id, veiculo_id, numero_versao, frente_path, verso_path,
  numero_documento_snapshot, validade_snapshot, estado, analisado_por, analisado_em,
  motivo_rejeicao, criado_em
)
select d.id, d.parceiro_id, d.veiculo_id, 1, d.frente_path, d.verso_path,
  d.numero_documento, d.validade, d.estado, d.analisado_por, d.analisado_em,
  d.motivo_rejeicao, d.criado_em
from public.documentos_parceiro_entrega d
where not exists (select 1 from public.versoes_documento_parceiro_entrega v where v.documento_id=d.id)
on conflict (documento_id, numero_versao) do nothing;

update public.documentos_parceiro_entrega d
set versao_atual_id=v.id
from public.versoes_documento_parceiro_entrega v
where v.documento_id=d.id and d.versao_atual_id is null and v.numero_versao=1;

create or replace function public.proteger_versao_documento_parceiro()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op in ('UPDATE','DELETE') and not public.eh_admin()
    and current_setting('angrolink.sincronizar_documento',true) is distinct from 'true' then
    raise exception 'As versões documentais só podem ser alteradas pelo fluxo controlado.';
  end if;
  if tg_op='UPDATE' and (
    new.documento_id is distinct from old.documento_id or new.parceiro_id is distinct from old.parceiro_id or
    new.veiculo_id is distinct from old.veiculo_id or new.numero_versao is distinct from old.numero_versao or
    new.frente_path is distinct from old.frente_path or new.verso_path is distinct from old.verso_path or
    new.numero_documento_snapshot is distinct from old.numero_documento_snapshot or new.validade_snapshot is distinct from old.validade_snapshot
  ) then raise exception 'Os dados físicos de uma versão documental são imutáveis.'; end if;
  if tg_op='DELETE' then raise exception 'As versões documentais não podem ser eliminadas.'; end if;
  return new;
end; $$;
drop trigger if exists proteger_versao_documento_parceiro on public.versoes_documento_parceiro_entrega;
create trigger proteger_versao_documento_parceiro before update or delete on public.versoes_documento_parceiro_entrega for each row execute function public.proteger_versao_documento_parceiro();

create or replace function public.proteger_eventos_documento_parceiro()
returns trigger language plpgsql security definer set search_path=public as $$ begin raise exception 'Os eventos documentais são append-only.'; end; $$;
drop trigger if exists proteger_eventos_documento_parceiro on public.eventos_documento_parceiro_entrega;
create trigger proteger_eventos_documento_parceiro before update or delete on public.eventos_documento_parceiro_entrega for each row execute function public.proteger_eventos_documento_parceiro();

-- O cadastro legado continua a inserir o cabeçalho; este trigger cria a primeira versão.
create or replace function public.criar_versao_inicial_documento_parceiro()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  insert into public.versoes_documento_parceiro_entrega(documento_id,parceiro_id,veiculo_id,numero_versao,frente_path,verso_path,numero_documento_snapshot,validade_snapshot,estado,analisado_por,analisado_em,motivo_rejeicao)
  values(new.id,new.parceiro_id,new.veiculo_id,1,new.frente_path,new.verso_path,new.numero_documento,new.validade,new.estado,new.analisado_por,new.analisado_em,new.motivo_rejeicao) returning id into v_id;
  update public.documentos_parceiro_entrega set versao_atual_id=v_id where id=new.id;
  insert into public.eventos_documento_parceiro_entrega(documento_id,versao_id,parceiro_id,ator_tipo,utilizador_id,evento,estado_novo)
  values(new.id,v_id,new.parceiro_id,'sistema',auth.uid(),'enviado',new.estado);
  return new;
end; $$;
drop trigger if exists criar_versao_inicial_documento_parceiro on public.documentos_parceiro_entrega;
create trigger criar_versao_inicial_documento_parceiro after insert on public.documentos_parceiro_entrega for each row execute function public.criar_versao_inicial_documento_parceiro();

-- Compatibilidade: análise existente no cabeçalho reflete-se apenas na versão atual.
create or replace function public.sincronizar_analise_versao_documento_parceiro()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  -- O reenvio já regista a substituição e a nova versão explicitamente. Não
  -- deve gerar um terceiro evento genérico de "submetido" no mesmo acto.
  if current_setting('angrolink.reenviar_versao_documento', true) is distinct from 'true'
    and new.versao_atual_id is not null
    and (new.estado is distinct from old.estado or new.analisado_por is distinct from old.analisado_por or new.analisado_em is distinct from old.analisado_em or new.motivo_rejeicao is distinct from old.motivo_rejeicao) then
    perform set_config('angrolink.sincronizar_documento','true',true);
    update public.versoes_documento_parceiro_entrega set estado=new.estado,analisado_por=new.analisado_por,analisado_em=new.analisado_em,motivo_rejeicao=new.motivo_rejeicao where id=new.versao_atual_id;
    insert into public.eventos_documento_parceiro_entrega(documento_id,versao_id,parceiro_id,ator_tipo,utilizador_id,evento,estado_anterior,estado_novo,motivo)
    values(new.id,new.versao_atual_id,new.parceiro_id,case when public.eh_admin() then 'admin' else 'sistema' end,auth.uid(),case when new.estado='aprovado' then 'aprovado' when new.estado='rejeitado' then 'rejeitado' when new.estado='expirado' then 'expirado' else 'submetido' end,old.estado,new.estado,new.motivo_rejeicao);
  end if; return new;
end; $$;
drop trigger if exists sincronizar_analise_versao_documento_parceiro on public.documentos_parceiro_entrega;
create trigger sincronizar_analise_versao_documento_parceiro after update on public.documentos_parceiro_entrega for each row execute function public.sincronizar_analise_versao_documento_parceiro();

-- O trigger existente reconhece a transição controlada para análise. Inclui
-- documentação expirada, que é o estado canónico antes da renovação.
create or replace function public.proteger_estado_parceiro_entrega()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_table_name <> 'parceiros_entrega' then return new; end if;

  if tg_op='UPDATE'
    and current_setting('angrolink.submeter_parceiro',true)='true'
    and old.estado in ('rascunho','documentos_pendentes','rejeitado','documentacao_expirada')
    and new.estado='em_analise'
    and new.disponibilidade=false then
    return new;
  end if;

  if not public.eh_admin() then
    if tg_op='INSERT' and (new.estado<>'rascunho' or new.disponibilidade) then
      raise exception 'O parceiro não pode aprovar-se ou ficar disponível no cadastro';
    end if;
    if tg_op='UPDATE' and (
      new.user_id is distinct from old.user_id or new.estado is distinct from old.estado or
      new.motivo_rejeicao is distinct from old.motivo_rejeicao or
      new.motivo_suspensao is distinct from old.motivo_suspensao or
      new.aprovado_em is distinct from old.aprovado_em
    ) then
      raise exception 'O estado administrativo do parceiro só pode ser alterado por administrador';
    end if;
  end if;
  return new;
end; $$;

-- Sem valores por defeito: a assinatura moderna só resolve com cinco argumentos.
create or replace function public.reenviar_documento_parceiro(p_documento_id uuid,p_frente_path text,p_verso_path text,p_numero_documento text,p_validade date)
returns void language plpgsql security definer set search_path=public as $$
declare d public.documentos_parceiro_entrega%rowtype; v_nova uuid; v_numero integer; v_numero_documento text; v_validade date;
begin
  select d0.* into d from public.documentos_parceiro_entrega d0 join public.parceiros_entrega p on p.id=d0.parceiro_id where d0.id=p_documento_id and p.user_id=auth.uid() and d0.estado in ('rejeitado','expirado') for update;
  if not found then raise exception 'Documento rejeitado ou expirado não encontrado.'; end if;
  if d.estado='expirado' and d.validade is not null and p_validade is null then
    raise exception 'Indique a nova validade para renovar este documento expirado.';
  end if;
  if d.estado='expirado' and d.validade is not null and p_validade <= greatest(d.validade,current_date) then
    raise exception 'A nova validade deve ser posterior à validade expirada e a hoje.';
  end if;
  v_numero_documento:=coalesce(nullif(btrim(p_numero_documento),''),d.numero_documento);
  v_validade:=coalesce(p_validade,d.validade);
  select coalesce(max(numero_versao),0)+1 into v_numero from public.versoes_documento_parceiro_entrega where documento_id=d.id;
  perform set_config('angrolink.sincronizar_documento','true',true);
  update public.versoes_documento_parceiro_entrega set substituido_em=now() where id=d.versao_atual_id;
  insert into public.eventos_documento_parceiro_entrega(documento_id,versao_id,parceiro_id,ator_tipo,utilizador_id,evento,estado_anterior,estado_novo)
  values(d.id,d.versao_atual_id,d.parceiro_id,'parceiro',auth.uid(),'substituido',d.estado,d.estado);
  insert into public.versoes_documento_parceiro_entrega(documento_id,parceiro_id,veiculo_id,numero_versao,frente_path,verso_path,numero_documento_snapshot,validade_snapshot,estado)
  values(d.id,d.parceiro_id,d.veiculo_id,v_numero,p_frente_path,p_verso_path,v_numero_documento,v_validade,'pendente') returning id into v_nova;
  perform set_config('angrolink.reenviar_documento','true',true);
  perform set_config('angrolink.reenviar_versao_documento','true',true);
  update public.documentos_parceiro_entrega set frente_path=p_frente_path,verso_path=p_verso_path,numero_documento=v_numero_documento,validade=v_validade,versao_atual_id=v_nova,estado='pendente',motivo_rejeicao=null,analisado_por=null,analisado_em=null where id=d.id;
  insert into public.eventos_documento_parceiro_entrega(documento_id,versao_id,parceiro_id,ator_tipo,utilizador_id,evento,estado_anterior,estado_novo) values(d.id,v_nova,d.parceiro_id,'parceiro',auth.uid(),'reenviado',d.estado,'pendente');
  perform set_config('angrolink.submeter_parceiro','true',true);
  update public.parceiros_entrega set estado='em_analise',disponibilidade=false
  where id=d.parceiro_id and estado in ('documentos_pendentes','documentacao_expirada');
end; $$;

-- Mantém o contrato utilizado pelo frontend atual APENAS para documentos
-- rejeitados. Ele não transmite uma nova validade; por isso um documento
-- expirado cuja validade exista deve usar a assinatura de cinco parâmetros.
create or replace function public.reenviar_documento_parceiro(p_documento_id uuid,p_frente_path text,p_verso_path text)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform public.reenviar_documento_parceiro(p_documento_id,p_frente_path,p_verso_path,null,null);
end; $$;

create or replace function public.listar_historico_documental_entregador_admin(p_parceiro_id uuid,p_limite integer default 25,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare l integer:=least(greatest(coalesce(p_limite,25),1),100); o integer:=greatest(coalesce(p_offset,0),0);
begin if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
return (with b as (select e.* from public.eventos_documento_parceiro_entrega e where e.parceiro_id=p_parceiro_id),p as(select * from b order by criado_em desc,id limit l offset o) select jsonb_build_object('itens',coalesce((select jsonb_agg(jsonb_build_object('evento_id',id,'documento_id',documento_id,'versao_id',versao_id,'ator_tipo',ator_tipo,'utilizador_id',utilizador_id,'evento',evento,'estado_anterior',estado_anterior,'estado_novo',estado_novo,'motivo',motivo,'criado_em',criado_em) order by criado_em desc,id) from p),'[]'::jsonb),'paginacao',jsonb_build_object('total_resultados',(select count(*) from b),'limite',l,'offset',o))); end; $$;

alter table public.versoes_documento_parceiro_entrega enable row level security;
alter table public.eventos_documento_parceiro_entrega enable row level security;
drop policy if exists versoes_documento_parceiro_leitura on public.versoes_documento_parceiro_entrega;
drop policy if exists eventos_documento_parceiro_leitura on public.eventos_documento_parceiro_entrega;
create policy versoes_documento_parceiro_leitura on public.versoes_documento_parceiro_entrega for select to authenticated using (public.eh_admin() or exists(select 1 from public.parceiros_entrega p where p.id=parceiro_id and p.user_id=auth.uid()));
create policy eventos_documento_parceiro_leitura on public.eventos_documento_parceiro_entrega for select to authenticated using (public.eh_admin() or exists(select 1 from public.parceiros_entrega p where p.id=parceiro_id and p.user_id=auth.uid()));
revoke all on table public.versoes_documento_parceiro_entrega,public.eventos_documento_parceiro_entrega from public,anon,authenticated;
-- Paths de Storage são privados. Nem parceiro nem administrador recebem
-- SELECT direto: leituras futuras usam projeções/RPCs sem paths físicos.
revoke all on function public.listar_historico_documental_entregador_admin(uuid,integer,integer) from public,anon;
grant execute on function public.listar_historico_documental_entregador_admin(uuid,integer,integer) to authenticated;
revoke all on function public.reenviar_documento_parceiro(uuid,text,text,text,date) from public,anon;
grant execute on function public.reenviar_documento_parceiro(uuid,text,text,text,date) to authenticated;
revoke all on function public.reenviar_documento_parceiro(uuid,text,text) from public,anon;
grant execute on function public.reenviar_documento_parceiro(uuid,text,text) to authenticated;
commit;
