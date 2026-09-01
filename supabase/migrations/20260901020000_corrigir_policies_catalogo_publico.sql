begin;

create or replace function public.is_vendedor_publico_aprovado(vendedor_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vendedores v
    where v.id = vendedor_uuid
      and v.status_aprovacao = 'aprovado'
      and coalesce(v.conta_ativa, false) = true
  );
$$;

revoke all on function public.is_vendedor_publico_aprovado(uuid) from public;
grant execute on function public.is_vendedor_publico_aprovado(uuid) to anon, authenticated;

drop policy if exists "catalogo_publico" on public.produtos;
create policy "catalogo_publico"
  on public.produtos
  for select
  to anon, authenticated
  using (
    publicado = true
    and disponivel = true
    and public.is_vendedor_publico_aprovado(vendedor_id)
  );

drop policy if exists "servicos_publicos" on public.servicos;
create policy "servicos_publicos"
  on public.servicos
  for select
  to anon, authenticated
  using (
    publicado = true
    and disponivel = true
    and public.is_vendedor_publico_aprovado(vendedor_id)
  );

commit;
