begin;

-- Uma interaÃ§Ã£o comercial sÃ³ Ã© elegÃ­vel quando nÃ£o parte do dono do
-- produto nem de um administrador. MantÃ©m anÃ³nimos e clientes comuns no
-- comportamento existente, sem confiar nos guards de React.
create or replace function public.interacao_comercial_produto_permitida(
  p_produto_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_dono_user_id uuid;
begin
  if p_produto_id is null then
    return false;
  end if;

  if auth.uid() is null then
    return true;
  end if;

  if public.eh_admin() then
    return false;
  end if;

  select v.user_id
    into v_dono_user_id
  from public.produtos p
  join public.vendedores v on v.id = p.vendedor_id
  where p.id = p_produto_id;

  return v_dono_user_id is distinct from auth.uid();
end;
$$;

create or replace function public.incrementar_visualizacao_produto(
  produto_id_param uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.interacao_comercial_produto_permitida(produto_id_param) then
    return;
  end if;

  update public.produtos
  set visualizacoes = coalesce(visualizacoes, 0) + 1
  where id = produto_id_param;
end;
$$;

create or replace function public.incrementar_clique_whatsapp_produto(
  produto_id_param uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.interacao_comercial_produto_permitida(produto_id_param) then
    return;
  end if;

  update public.produtos
  set cliques_whatsapp = coalesce(cliques_whatsapp, 0) + 1
  where id = produto_id_param;
end;
$$;

-- As tabelas de apoio alimentam histÃ³rico e auditoria de actividade. O
-- cancelamento silencioso preserva a UX do contacto/abertura, mas impede que
-- uma chamada directa crie actividade comercial falsa.
create or replace function public.proteger_registo_interacao_comercial_produto()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.interacao_comercial_produto_permitida(new.produto_id) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_visualizacao_comercial_produto on public.visualizacoes_produtos;
create trigger proteger_visualizacao_comercial_produto
before insert on public.visualizacoes_produtos
for each row execute function public.proteger_registo_interacao_comercial_produto();

drop trigger if exists proteger_contacto_comercial_produto on public.historico_contactos;
create trigger proteger_contacto_comercial_produto
before insert on public.historico_contactos
for each row execute function public.proteger_registo_interacao_comercial_produto();

revoke all on function public.interacao_comercial_produto_permitida(uuid), public.proteger_registo_interacao_comercial_produto() from public, anon, authenticated;
revoke all on function public.incrementar_visualizacao_produto(uuid), public.incrementar_clique_whatsapp_produto(uuid) from public, anon, authenticated;
grant execute on function public.incrementar_visualizacao_produto(uuid), public.incrementar_clique_whatsapp_produto(uuid) to anon, authenticated;

commit;
