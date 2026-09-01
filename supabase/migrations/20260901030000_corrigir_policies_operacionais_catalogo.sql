begin;

-- Estas funções isolam a leitura de vendedores das policies RLS de catálogo.
-- A autorização operacional continua a ser avaliada no servidor, sem grants
-- SELECT adicionais sobre public.vendedores.
create or replace function public.vendedor_eh_dono(vendedor_uuid uuid)
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
      and v.user_id = auth.uid()
  );
$$;

create or replace function public.vendedor_eh_dono_aprovado(vendedor_uuid uuid)
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
      and v.user_id = auth.uid()
      and v.status_aprovacao = 'aprovado'
  );
$$;

revoke all on function public.vendedor_eh_dono(uuid) from public;
revoke all on function public.vendedor_eh_dono_aprovado(uuid) from public;
grant execute on function public.vendedor_eh_dono(uuid) to authenticated;
grant execute on function public.vendedor_eh_dono_aprovado(uuid) to authenticated;

drop policy if exists "produtos_gerir_proprios" on public.produtos;
create policy "produtos_gerir_proprios"
  on public.produtos
  to authenticated
  using (public.eh_admin() or public.vendedor_eh_dono(vendedor_id))
  with check (public.eh_admin() or public.vendedor_eh_dono(vendedor_id));

drop policy if exists "servicos_gerir_proprios" on public.servicos;
create policy "servicos_gerir_proprios"
  on public.servicos
  to authenticated
  using (public.eh_admin() or public.vendedor_eh_dono(vendedor_id))
  with check (public.eh_admin() or public.vendedor_eh_dono(vendedor_id));

drop policy if exists "vendedor aprovado pode atualizar seus produtos" on public.produtos;
create policy "vendedor aprovado pode atualizar seus produtos"
  on public.produtos
  for update
  to authenticated
  using (public.vendedor_eh_dono_aprovado(vendedor_id))
  with check (public.vendedor_eh_dono_aprovado(vendedor_id));

drop policy if exists "vendedor aprovado pode atualizar seus servicos" on public.servicos;
create policy "vendedor aprovado pode atualizar seus servicos"
  on public.servicos
  for update
  to authenticated
  using (public.vendedor_eh_dono_aprovado(vendedor_id))
  with check (public.vendedor_eh_dono_aprovado(vendedor_id));

drop policy if exists "vendedor aprovado pode criar produto" on public.produtos;
create policy "vendedor aprovado pode criar produto"
  on public.produtos
  for insert
  to authenticated
  with check (public.vendedor_eh_dono_aprovado(vendedor_id));

drop policy if exists "vendedor aprovado pode criar servico" on public.servicos;
create policy "vendedor aprovado pode criar servico"
  on public.servicos
  for insert
  to authenticated
  with check (public.vendedor_eh_dono_aprovado(vendedor_id));

drop policy if exists "vendedor aprovado pode eliminar seus produtos" on public.produtos;
create policy "vendedor aprovado pode eliminar seus produtos"
  on public.produtos
  for delete
  to authenticated
  using (public.vendedor_eh_dono_aprovado(vendedor_id));

drop policy if exists "vendedor aprovado pode eliminar seus servicos" on public.servicos;
create policy "vendedor aprovado pode eliminar seus servicos"
  on public.servicos
  for delete
  to authenticated
  using (public.vendedor_eh_dono_aprovado(vendedor_id));

drop policy if exists "vendedor pode ver seus produtos" on public.produtos;
create policy "vendedor pode ver seus produtos"
  on public.produtos
  for select
  to authenticated
  using (public.vendedor_eh_dono(vendedor_id));

drop policy if exists "vendedor pode ver seus servicos" on public.servicos;
create policy "vendedor pode ver seus servicos"
  on public.servicos
  for select
  to authenticated
  using (public.vendedor_eh_dono(vendedor_id));

commit;
