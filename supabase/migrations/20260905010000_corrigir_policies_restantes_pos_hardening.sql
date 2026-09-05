-- Corrige as policies restantes que ainda consultavam
-- public.vendedores diretamente depois do hardening.

drop policy if exists
  "disputas_encomenda_leitura_vendedor"
  on public.disputas_encomenda;

create policy "disputas_encomenda_leitura_vendedor"
on public.disputas_encomenda
for select
to authenticated
using (
  public.vendedor_eh_dono(vendedor_id)
);


drop policy if exists
  "Vendedor pode ver historico dos seus produtos"
  on public.historico_contactos;

create policy "Vendedor pode ver historico dos seus produtos"
on public.historico_contactos
for select
to authenticated
using (
  public.vendedor_eh_dono(vendedor_id)
);


drop policy if exists
  "historico_contactos_participantes"
  on public.historico_contactos;

create policy "historico_contactos_participantes"
on public.historico_contactos
for select
to authenticated
using (
  cliente_id = auth.uid()
  or public.eh_admin()
  or public.vendedor_eh_dono(vendedor_id)
);


drop policy if exists
  "Vendedor pode ver historico dos seus servicos"
  on public.historico_contactos_servicos;

create policy "Vendedor pode ver historico dos seus servicos"
on public.historico_contactos_servicos
for select
to authenticated
using (
  public.vendedor_eh_dono(vendedor_id)
);


drop policy if exists
  "historico_contactos_servicos_participantes"
  on public.historico_contactos_servicos;

create policy "historico_contactos_servicos_participantes"
on public.historico_contactos_servicos
for select
to authenticated
using (
  cliente_id = auth.uid()
  or public.eh_admin()
  or public.vendedor_eh_dono(vendedor_id)
);