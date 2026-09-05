-- Corrige policies operacionais de encomendas que ainda consultavam
-- public.vendedores diretamente depois do hardening.
--
-- O acesso amplo SELECT a public.vendedores para authenticated permanece fechado.
-- A verificação de propriedade do vendedor passa pelo helper SECURITY DEFINER
-- public.vendedor_eh_dono(uuid).

drop policy if exists
  "encomendas_leitura_cliente_vendedor_admin"
  on public.encomendas;

create policy "encomendas_leitura_cliente_vendedor_admin"
on public.encomendas
for select
to authenticated
using (
  cliente_id = auth.uid()
  or public.vendedor_eh_dono(vendedor_id)
  or public.eh_admin()
);


drop policy if exists
  "enderecos_entrega_encomenda_leitura_participantes"
  on public.enderecos_entrega_encomenda;

create policy "enderecos_entrega_encomenda_leitura_participantes"
on public.enderecos_entrega_encomenda
for select
to authenticated
using (
  exists (
    select 1
    from public.encomendas e
    where e.id = enderecos_entrega_encomenda.encomenda_id
      and (
        e.cliente_id = auth.uid()
        or public.vendedor_eh_dono(e.vendedor_id)
        or public.eh_admin()
      )
  )
);


drop policy if exists
  "eventos_encomenda_leitura_cliente_vendedor_admin"
  on public.eventos_encomenda;

create policy "eventos_encomenda_leitura_cliente_vendedor_admin"
on public.eventos_encomenda
for select
to authenticated
using (
  exists (
    select 1
    from public.encomendas e
    where e.id = eventos_encomenda.encomenda_id
      and (
        e.cliente_id = auth.uid()
        or public.vendedor_eh_dono(e.vendedor_id)
        or public.eh_admin()
      )
  )
);


drop policy if exists
  "itens_encomenda_leitura_cliente_vendedor_admin"
  on public.itens_encomenda;

create policy "itens_encomenda_leitura_cliente_vendedor_admin"
on public.itens_encomenda
for select
to authenticated
using (
  exists (
    select 1
    from public.encomendas e
    where e.id = itens_encomenda.encomenda_id
      and (
        e.cliente_id = auth.uid()
        or public.vendedor_eh_dono(e.vendedor_id)
        or public.eh_admin()
      )
  )
);