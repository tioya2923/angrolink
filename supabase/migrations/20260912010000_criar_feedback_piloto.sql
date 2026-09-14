begin;

create table public.feedback_piloto (
  id uuid primary key default gen_random_uuid(),
  utilizador_id uuid not null references auth.users(id),
  papel text not null check (papel in ('cliente', 'vendedor', 'parceiro_entrega')),
  encomenda_id uuid references public.encomendas(id),
  atribuicao_entrega_id uuid references public.atribuicoes_entrega_encomenda(id),
  categoria text not null check (categoria in ('compra', 'vendedor', 'entrega', 'pagamento', 'aplicacao', 'outro')),
  nota smallint check (nota is null or nota between 1 and 5),
  comentario text check (comentario is null or (btrim(comentario) <> '' and char_length(btrim(comentario)) <= 1000)),
  contactar_utilizador boolean not null default false,
  estado text not null default 'novo' check (estado in ('novo', 'em_analise', 'resolvido')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por uuid references auth.users(id),
  constraint feedback_piloto_nota_ou_comentario_check check (nota is not null or (comentario is not null and btrim(comentario) <> '')),
  constraint feedback_piloto_resolucao_check check (
    (estado = 'resolvido' and resolvido_em is not null and resolvido_por is not null)
    or (estado <> 'resolvido' and resolvido_em is null and resolvido_por is null)
  )
);

create index feedback_piloto_estado_criado_em_idx on public.feedback_piloto (estado, criado_em desc);
create index feedback_piloto_papel_categoria_criado_em_idx on public.feedback_piloto (papel, categoria, criado_em desc);
create index feedback_piloto_utilizador_id_idx on public.feedback_piloto (utilizador_id);
create index feedback_piloto_encomenda_id_idx on public.feedback_piloto (encomenda_id) where encomenda_id is not null;

alter table public.feedback_piloto enable row level security;
revoke all on table public.feedback_piloto from public, anon, authenticated;

create or replace function public.criar_feedback_piloto(
  p_contexto text,
  p_categoria text,
  p_nota smallint default null,
  p_comentario text default null,
  p_contactar_utilizador boolean default false,
  p_encomenda_id uuid default null,
  p_atribuicao_entrega_id uuid default null
) returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_user_id uuid := auth.uid();
  v_contexto text := btrim(coalesce(p_contexto, ''));
  v_categoria text := btrim(coalesce(p_categoria, ''));
  v_comentario text := nullif(btrim(coalesce(p_comentario, '')), '');
  v_encomenda public.encomendas%rowtype;
  v_atribuicao public.atribuicoes_entrega_encomenda%rowtype;
  v_vendedor_user_id uuid;
  v_parceiro_user_id uuid;
  v_feedback_id uuid;
begin
  if v_user_id is null then raise exception 'Sessão inválida.' using errcode = 'P0001'; end if;
  if v_contexto not in ('cliente', 'vendedor', 'parceiro_entrega') then raise exception 'Contexto de feedback inválido.' using errcode = 'P0001'; end if;
  if v_categoria not in ('compra', 'vendedor', 'entrega', 'pagamento', 'aplicacao', 'outro') then raise exception 'Categoria de feedback inválida.' using errcode = 'P0001'; end if;
  if p_nota is not null and p_nota not between 1 and 5 then raise exception 'A nota deve estar entre 1 e 5.' using errcode = 'P0001'; end if;
  if v_comentario is not null and char_length(v_comentario) > 1000 then raise exception 'O comentário não pode exceder 1000 caracteres.' using errcode = 'P0001'; end if;
  if p_nota is null and v_comentario is null then raise exception 'Indique uma nota ou um comentário.' using errcode = 'P0001'; end if;

  if p_encomenda_id is not null then
    select * into v_encomenda from public.encomendas where id = p_encomenda_id;
    if not found then raise exception 'Encomenda não encontrada.' using errcode = 'P0001'; end if;
    select user_id into v_vendedor_user_id from public.vendedores where id = v_encomenda.vendedor_id;
  end if;
  if p_atribuicao_entrega_id is not null then
    select * into v_atribuicao from public.atribuicoes_entrega_encomenda where id = p_atribuicao_entrega_id;
    if not found then raise exception 'Atribuição de entrega não encontrada.' using errcode = 'P0001'; end if;
    select user_id into v_parceiro_user_id from public.parceiros_entrega where id = v_atribuicao.parceiro_id;
    if p_encomenda_id is not null and v_atribuicao.encomenda_id <> p_encomenda_id then raise exception 'A atribuição não pertence à encomenda indicada.' using errcode = 'P0001'; end if;
    if p_encomenda_id is null then select * into v_encomenda from public.encomendas where id = v_atribuicao.encomenda_id; end if;
  end if;

  if v_contexto = 'cliente' then
    if p_encomenda_id is not null and v_encomenda.cliente_id <> v_user_id then raise exception 'Não pode enviar feedback sobre esta encomenda.' using errcode = 'P0001'; end if;
    if p_encomenda_id is null and not exists (select 1 from public.clientes where id = v_user_id) then raise exception 'Contexto de cliente indisponível.' using errcode = 'P0001'; end if;
  elsif v_contexto = 'vendedor' then
    if p_encomenda_id is not null and v_vendedor_user_id is distinct from v_user_id then raise exception 'Não pode enviar feedback sobre esta encomenda.' using errcode = 'P0001'; end if;
    if p_encomenda_id is null and not exists (select 1 from public.vendedores where user_id = v_user_id) then raise exception 'Contexto de vendedor indisponível.' using errcode = 'P0001'; end if;
  else
    if p_atribuicao_entrega_id is not null and v_parceiro_user_id is distinct from v_user_id then raise exception 'Não pode enviar feedback sobre esta entrega.' using errcode = 'P0001'; end if;
    if p_atribuicao_entrega_id is null and not exists (select 1 from public.parceiros_entrega where user_id = v_user_id) then raise exception 'Contexto de parceiro de entrega indisponível.' using errcode = 'P0001'; end if;
  end if;

  if v_categoria in ('compra', 'vendedor', 'entrega', 'pagamento') then
    if p_encomenda_id is null then raise exception 'Este feedback deve estar associado a uma encomenda.' using errcode = 'P0001'; end if;
    if v_encomenda.estado <> 'concluida' then raise exception 'O feedback operacional só está disponível após a conclusão.' using errcode = 'P0001'; end if;
    if v_categoria = 'entrega' and p_atribuicao_entrega_id is null then raise exception 'O feedback de entrega requer a atribuição correspondente.' using errcode = 'P0001'; end if;
  end if;

  insert into public.feedback_piloto (utilizador_id, papel, encomenda_id, atribuicao_entrega_id, categoria, nota, comentario, contactar_utilizador)
  values (v_user_id, v_contexto, p_encomenda_id, p_atribuicao_entrega_id, v_categoria, p_nota, v_comentario, coalesce(p_contactar_utilizador, false)) returning id into v_feedback_id;
  return v_feedback_id;
end;
$$;

create or replace function public.listar_feedback_piloto_admin(
  p_papel text default null, p_categoria text default null, p_nota smallint default null, p_estado text default null,
  p_limite integer default 20, p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_limite integer := greatest(1, least(coalesce(p_limite, 20), 100)); v_offset integer := greatest(0, coalesce(p_offset, 0)); v_total integer; v_itens jsonb;
begin
  if not public.eh_admin() then raise exception 'Acesso administrativo necessário.' using errcode = 'P0001'; end if;
  if p_papel is not null and p_papel not in ('cliente','vendedor','parceiro_entrega') then raise exception 'Filtro de papel inválido.' using errcode = 'P0001'; end if;
  if p_categoria is not null and p_categoria not in ('compra','vendedor','entrega','pagamento','aplicacao','outro') then raise exception 'Filtro de categoria inválido.' using errcode = 'P0001'; end if;
  if p_estado is not null and p_estado not in ('novo','em_analise','resolvido') then raise exception 'Filtro de estado inválido.' using errcode = 'P0001'; end if;
  select count(*) into v_total from public.feedback_piloto f where (p_papel is null or f.papel=p_papel) and (p_categoria is null or f.categoria=p_categoria) and (p_nota is null or f.nota=p_nota) and (p_estado is null or f.estado=p_estado);
  select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'papel',f.papel,'categoria',f.categoria,'nota',f.nota,'comentario',f.comentario,'contactar_utilizador',f.contactar_utilizador,'estado',f.estado,'encomenda_id',f.encomenda_id,'atribuicao_entrega_id',f.atribuicao_entrega_id,'criado_em',f.criado_em,'atualizado_em',f.atualizado_em,'resolvido_em',f.resolvido_em) order by f.criado_em desc,f.id desc),'[]'::jsonb) into v_itens from (select * from public.feedback_piloto f where (p_papel is null or f.papel=p_papel) and (p_categoria is null or f.categoria=p_categoria) and (p_nota is null or f.nota=p_nota) and (p_estado is null or f.estado=p_estado) order by f.criado_em desc,id desc limit v_limite offset v_offset) f;
  return jsonb_build_object('itens',v_itens,'paginacao',jsonb_build_object('total_resultados',v_total,'limite',v_limite,'offset',v_offset));
end;
$$;

create or replace function public.atualizar_estado_feedback_piloto_admin(p_feedback_id uuid, p_estado text)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not public.eh_admin() then raise exception 'Acesso administrativo necessário.' using errcode = 'P0001'; end if;
  if p_estado not in ('novo','em_analise','resolvido') then raise exception 'Estado de feedback inválido.' using errcode = 'P0001'; end if;
  update public.feedback_piloto set estado=p_estado, atualizado_em=now(), resolvido_em=case when p_estado='resolvido' then coalesce(resolvido_em,now()) else null end, resolvido_por=case when p_estado='resolvido' then coalesce(resolvido_por,auth.uid()) else null end where id=p_feedback_id;
  if not found then raise exception 'Feedback não encontrado.' using errcode = 'P0001'; end if;
end;
$$;

revoke all on function public.criar_feedback_piloto(text,text,smallint,text,boolean,uuid,uuid), public.listar_feedback_piloto_admin(text,text,smallint,text,integer,integer), public.atualizar_estado_feedback_piloto_admin(uuid,text) from public, anon;
grant execute on function public.criar_feedback_piloto(text,text,smallint,text,boolean,uuid,uuid), public.listar_feedback_piloto_admin(text,text,smallint,text,integer,integer), public.atualizar_estado_feedback_piloto_admin(uuid,text) to authenticated;

commit;
