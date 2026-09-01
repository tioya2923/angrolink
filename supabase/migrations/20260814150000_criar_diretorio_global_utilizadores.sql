-- ANGROLINK — Diretório Global de Utilizadores V1.
-- Projeção administrativa mínima: uma linha por conta Auth e várias capacidades.
-- Não expõe documentos, caminhos privados, dados financeiros ou segredos.
begin;

create or replace function public.listar_utilizadores_admin(
  p_papel text default null,
  p_estado text default null,
  p_provincia text default null,
  p_registo_recente boolean default null,
  p_pesquisa text default null,
  p_limite integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_pesquisa text := nullif(btrim(p_pesquisa), '');
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  if p_papel is not null and p_papel not in ('cliente', 'vendedor', 'parceiro_entrega', 'admin') then
    raise exception 'Filtro de papel inválido.';
  end if;

  if p_estado is not null and p_estado not in ('ativo', 'pendente', 'suspenso', 'rejeitado', 'inativo') then
    raise exception 'Filtro de estado inválido.';
  end if;

  return (
  with base as (
    select
      au.id as base_user_id,
      array_remove(array[
        case when c.id is not null then 'cliente' end,
        case when v.id is not null then 'vendedor' end,
        case when pe.id is not null then 'parceiro_entrega' end,
        case when a.user_id is not null then 'admin' end
      ], null)::text[] as base_papeis,
      coalesce(
        nullif(btrim(pr.nome), ''),
        nullif(btrim(c.nome), ''),
        nullif(btrim(v.nome_responsavel), ''),
        nullif(btrim(v.nome_comercial), ''),
        nullif(btrim(pe.nome_completo), ''),
        nullif(split_part(au.email, '@', 1), ''),
        'Utilizador sem nome'
      ) as base_nome,
      coalesce(c.foto_perfil, v.foto_perfil) as base_foto_url,
      coalesce(c.email, v.email, pe.email, au.email) as base_email,
      coalesce(c.telefone, v.telefone_whatsapp, v.whatsapp, pe.telefone) as base_telefone,
      coalesce(c.provincia, v.provincia, pe.provincia) as base_provincia,
      coalesce(c.municipio, v.municipio, pe.municipio) as base_municipio,
      au.created_at as base_criado_em,
      jsonb_build_object(
        'cliente', case when c.id is null then null when coalesce(c.conta_ativa, false) then 'ativo' else 'inativo' end,
        'vendedor', case when v.id is null then null when v.status_aprovacao = 'aprovado' and coalesce(v.conta_ativa, false) then 'ativo' when v.status_aprovacao = 'pendente' then 'pendente' when v.status_aprovacao = 'suspenso' then 'suspenso' when v.status_aprovacao = 'rejeitado' then 'rejeitado' else 'inativo' end,
        'parceiro_entrega', case when pe.id is null then null when pe.estado = 'aprovado' then 'ativo' when pe.estado in ('rascunho', 'documentos_pendentes', 'em_analise') then 'pendente' when pe.estado in ('suspenso', 'documentacao_expirada') then 'suspenso' when pe.estado = 'rejeitado' then 'rejeitado' else 'inativo' end,
        -- A pertença a administradores é a autorização administrativa real atual.
        'admin', case when a.user_id is null then null else 'ativo' end
      ) as base_estados_papeis,
      exists (
        select 1 from public.documentos_vendedor dv
        where dv.vendedor_id = v.id and dv.estado in ('pendente', 'em_analise', 'rejeitado', 'expirado')
      ) or exists (
        select 1 from public.documentos_parceiro_entrega dp
        where dp.parceiro_id = pe.id and dp.estado in ('pendente', 'rejeitado', 'expirado')
      ) as base_pendencia_documental,
      jsonb_build_object(
        'vendedor', exists (
          select 1 from public.documentos_vendedor dv
          where dv.vendedor_id = v.id and dv.estado in ('pendente', 'em_analise', 'rejeitado', 'expirado')
        ),
        'parceiro_entrega', exists (
          select 1 from public.documentos_parceiro_entrega dp
          where dp.parceiro_id = pe.id and dp.estado in ('pendente', 'rejeitado', 'expirado')
        )
      ) as base_pendencias_documentais_papeis,
      concat_ws(' ', c.nome, v.nome_responsavel, v.nome_comercial, pe.nome_completo,
        c.email, v.email, pe.email, au.email,
        c.telefone, v.telefone_whatsapp, v.whatsapp, pe.telefone) as base_pesquisa
    from auth.users au
    left join public.profiles pr on pr.id = au.id and pr.ativo and pr.apagado_em is null
    left join lateral (
      select * from public.clientes where id = au.id order by criado_em desc limit 1
    ) c on true
    left join lateral (
      select * from public.vendedores where user_id = au.id order by criado_em desc limit 1
    ) v on true
    left join lateral (
      select * from public.parceiros_entrega where user_id = au.id order by criado_em desc limit 1
    ) pe on true
    left join public.administradores a on a.user_id = au.id
    where c.id is not null or v.id is not null or pe.id is not null or a.user_id is not null
  ), filtrados_secundarios as (
    select * from base
    where (p_provincia is null or base_provincia = p_provincia)
      and (p_registo_recente is not true or base_criado_em >= now() - interval '30 days')
      and (v_pesquisa is null or lower(base_pesquisa) like '%' || lower(v_pesquisa) || '%')
  ), contagens_globais as (
    select
      count(*) as c_total,
      count(*) filter (where 'cliente' = any(base_papeis)) as c_clientes,
      count(*) filter (where 'vendedor' = any(base_papeis)) as c_vendedores,
      count(*) filter (where 'parceiro_entrega' = any(base_papeis)) as c_parceiros,
      count(*) filter (where 'admin' = any(base_papeis)) as c_admins
    from base
  ), filtrados as (
    select * from filtrados_secundarios
    where (p_papel is null or p_papel = any(base_papeis))
      and (
        p_estado is null
        or (p_papel is not null and base_estados_papeis ->> p_papel = p_estado)
        or (p_papel is null and exists (
          select 1 from jsonb_each_text(base_estados_papeis) estado_papel
          where estado_papel.value = p_estado
        ))
      )
  ), total_filtrado as (
    select count(*) as c_total_resultados from filtrados
  ), pagina as (
    select * from filtrados
    order by base_criado_em desc, base_user_id
    limit v_limite offset v_offset
  ), itens as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', base_user_id,
      'papeis', base_papeis,
      'nome_apresentacao', base_nome,
      'foto_url', base_foto_url,
      'estados_papeis', base_estados_papeis,
      'email', base_email,
      'telefone', base_telefone,
      'provincia', base_provincia,
      'municipio', base_municipio,
      'criado_em', base_criado_em,
      'tem_pendencia_documental', base_pendencia_documental,
      'pendencias_documentais_papeis', base_pendencias_documentais_papeis
    ) order by base_criado_em desc, base_user_id), '[]'::jsonb) as dados
    from pagina
  )
  select jsonb_build_object(
    'itens', i.dados,
    'paginacao', jsonb_build_object(
      'total_resultados', t.c_total_resultados,
      'limite', v_limite,
      'offset', v_offset
    ),
    'contagens', jsonb_build_object(
      'total_global', c.c_total,
      'clientes', c.c_clientes,
      'vendedores', c.c_vendedores,
      'parceiros_entrega', c.c_parceiros,
      'administradores', c.c_admins
    )
  )
  from itens i
  cross join contagens_globais c
  cross join total_filtrado t
  );
end;
$$;

revoke all on function public.listar_utilizadores_admin(text, text, text, boolean, text, integer, integer)
  from public, anon;
grant execute on function public.listar_utilizadores_admin(text, text, text, boolean, text, integer, integer)
  to authenticated;

commit;
