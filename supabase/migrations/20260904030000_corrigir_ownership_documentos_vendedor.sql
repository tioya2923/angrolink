begin;

create or replace function public.vendedor_pertence_ao_utilizador_autenticado(p_vendedor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.vendedores v
      where v.id = p_vendedor_id
        and v.user_id = auth.uid()
    );
$$;

revoke all on function public.vendedor_pertence_ao_utilizador_autenticado(uuid) from public, anon;
grant execute on function public.vendedor_pertence_ao_utilizador_autenticado(uuid) to authenticated;

drop policy if exists documentos_vendedor_leitura_propria_admin on public.documentos_vendedor;
create policy documentos_vendedor_leitura_propria_admin
on public.documentos_vendedor for select to authenticated
using (
  public.eh_admin()
  or public.vendedor_pertence_ao_utilizador_autenticado(vendedor_id)
);

drop policy if exists documentos_vendedor_criar_proprio on public.documentos_vendedor;
create policy documentos_vendedor_criar_proprio
on public.documentos_vendedor for insert to authenticated
with check (
  public.eh_admin()
  or public.vendedor_pertence_ao_utilizador_autenticado(vendedor_id)
);

drop policy if exists documentos_vendedor_atualizar_proprio_admin on public.documentos_vendedor;
create policy documentos_vendedor_atualizar_proprio_admin
on public.documentos_vendedor for update to authenticated
using (
  public.eh_admin()
  or (
    estado = 'rejeitado'
    and public.vendedor_pertence_ao_utilizador_autenticado(vendedor_id)
  )
)
with check (
  public.eh_admin()
  or public.vendedor_pertence_ao_utilizador_autenticado(vendedor_id)
);

commit;
