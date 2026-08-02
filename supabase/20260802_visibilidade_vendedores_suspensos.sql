-- Garante que anúncios só são públicos quando o vendedor está aprovado e ativo.
-- O próprio vendedor e os administradores continuam a poder consultá-los no painel.

drop policy if exists catalogo_publico on public.produtos;
create policy catalogo_publico on public.produtos for select to anon, authenticated
  using (
    exists (
      select 1 from public.vendedores v
      where v.id = vendedor_id
        and v.status_aprovacao = 'aprovado'
        and v.conta_ativa is not false
    )
    or exists (
      select 1 from public.vendedores v
      where v.id = vendedor_id
        and (v.user_id = auth.uid() or public.eh_admin())
    )
  );

drop policy if exists servicos_publicos on public.servicos;
create policy servicos_publicos on public.servicos for select to anon, authenticated
  using (
    exists (
      select 1 from public.vendedores v
      where v.id = vendedor_id
        and v.status_aprovacao = 'aprovado'
        and v.conta_ativa is not false
    )
    or exists (
      select 1 from public.vendedores v
      where v.id = vendedor_id
        and (v.user_id = auth.uid() or public.eh_admin())
    )
  );
