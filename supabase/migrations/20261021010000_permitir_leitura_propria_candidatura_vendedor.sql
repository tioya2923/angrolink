begin;

create policy vendedores_leitura_propria
on public.vendedores
for select to authenticated
using (user_id = auth.uid());

commit;
