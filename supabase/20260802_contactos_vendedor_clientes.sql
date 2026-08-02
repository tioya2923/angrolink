-- Permite a um vendedor ver apenas os dados de clientes que o contactaram.
-- Executar no SQL Editor do Supabase.

drop policy if exists clientes_contactos_do_vendedor on public.clientes;

create policy clientes_contactos_do_vendedor
on public.clientes
for select
to authenticated
using (
  id = auth.uid()
  or public.eh_admin()
  or exists (
    select 1
    from public.historico_contactos h
    join public.vendedores v on v.id = h.vendedor_id
    where h.cliente_id = clientes.id
      and v.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.historico_contactos_servicos h
    join public.vendedores v on v.id = h.vendedor_id
    where h.cliente_id = clientes.id
      and v.user_id = auth.uid()
  )
);
