begin;

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
  v_user_id uuid := auth.uid(); v_contexto text := btrim(coalesce(p_contexto, '')); v_categoria text := btrim(coalesce(p_categoria, ''));
  v_comentario text := nullif(btrim(coalesce(p_comentario, '')), ''); v_encomenda public.encomendas%rowtype;
  v_atribuicao public.atribuicoes_entrega_encomenda%rowtype; v_vendedor_user_id uuid; v_parceiro_user_id uuid; v_feedback_id uuid;
  v_contextual boolean := p_encomenda_id is not null or p_atribuicao_entrega_id is not null;
begin
  if v_user_id is null then raise exception 'Sessão inválida.' using errcode = 'P0001'; end if;
  if v_contexto not in ('cliente', 'vendedor', 'parceiro_entrega') then raise exception 'Contexto de feedback inválido.' using errcode = 'P0001'; end if;
  if v_categoria not in ('compra', 'vendedor', 'entrega', 'pagamento', 'aplicacao', 'outro') then raise exception 'Categoria de feedback inválida.' using errcode = 'P0001'; end if;
  if p_nota is not null and p_nota not between 1 and 5 then raise exception 'A nota deve estar entre 1 e 5.' using errcode = 'P0001'; end if;
  if v_comentario is not null and char_length(v_comentario) > 1000 then raise exception 'O comentário não pode exceder 1000 caracteres.' using errcode = 'P0001'; end if;
  if p_nota is null and v_comentario is null then raise exception 'Indique uma nota ou um comentário.' using errcode = 'P0001'; end if;
  if not v_contextual then
    if v_categoria not in ('aplicacao', 'outro') then raise exception 'O feedback geral aceita apenas aplicação ou outro.' using errcode = 'P0001'; end if;
    if v_contexto = 'cliente' and not exists (select 1 from public.clientes where id = v_user_id) then raise exception 'Contexto de cliente indisponível.' using errcode = 'P0001'; end if;
    if v_contexto = 'vendedor' and not exists (select 1 from public.vendedores where user_id = v_user_id) then raise exception 'Contexto de vendedor indisponível.' using errcode = 'P0001'; end if;
    if v_contexto = 'parceiro_entrega' and not exists (select 1 from public.parceiros_entrega where user_id = v_user_id) then raise exception 'Contexto de parceiro de entrega indisponível.' using errcode = 'P0001'; end if;
  else
    if p_encomenda_id is null then raise exception 'O feedback contextual requer encomenda.' using errcode = 'P0001'; end if;
    select * into v_encomenda from public.encomendas where id = p_encomenda_id;
    if not found then raise exception 'Encomenda não encontrada.' using errcode = 'P0001'; end if;
    select user_id into v_vendedor_user_id from public.vendedores where id = v_encomenda.vendedor_id;
    if p_atribuicao_entrega_id is not null then
      select * into v_atribuicao from public.atribuicoes_entrega_encomenda where id = p_atribuicao_entrega_id;
      if not found then raise exception 'Atribuição de entrega não encontrada.' using errcode = 'P0001'; end if;
      if v_atribuicao.encomenda_id <> p_encomenda_id then raise exception 'A atribuição não pertence à encomenda indicada.' using errcode = 'P0001'; end if;
      select user_id into v_parceiro_user_id from public.parceiros_entrega where id = v_atribuicao.parceiro_entrega_id;
    end if;
    if v_encomenda.estado <> 'concluida' then raise exception 'O feedback contextual só está disponível após a conclusão.' using errcode = 'P0001'; end if;
    if v_contexto = 'cliente' and v_encomenda.cliente_id is distinct from v_user_id then raise exception 'Não pode enviar feedback sobre esta encomenda.' using errcode = 'P0001'; end if;
    if v_contexto = 'vendedor' and v_vendedor_user_id is distinct from v_user_id then raise exception 'Não pode enviar feedback sobre esta encomenda.' using errcode = 'P0001'; end if;
    if v_contexto = 'parceiro_entrega' then
      if p_atribuicao_entrega_id is null then raise exception 'O feedback do parceiro requer a atribuição correspondente.' using errcode = 'P0001'; end if;
      if v_parceiro_user_id is distinct from v_user_id then raise exception 'Não pode enviar feedback sobre esta entrega.' using errcode = 'P0001'; end if;
      if v_atribuicao.estado <> 'concluida' then raise exception 'O feedback do parceiro só está disponível após a conclusão da entrega.' using errcode = 'P0001'; end if;
    end if;
    if v_categoria = 'entrega' and p_atribuicao_entrega_id is null then raise exception 'O feedback de entrega requer a atribuição correspondente.' using errcode = 'P0001'; end if;
  end if;
  insert into public.feedback_piloto (utilizador_id, papel, encomenda_id, atribuicao_entrega_id, categoria, nota, comentario, contactar_utilizador)
  values (v_user_id, v_contexto, p_encomenda_id, p_atribuicao_entrega_id, v_categoria, p_nota, v_comentario, coalesce(p_contactar_utilizador, false)) returning id into v_feedback_id;
  return v_feedback_id;
end;
$$;

revoke all on function public.criar_feedback_piloto(text,text,smallint,text,boolean,uuid,uuid) from public, anon;
grant execute on function public.criar_feedback_piloto(text,text,smallint,text,boolean,uuid,uuid) to authenticated;

commit;
