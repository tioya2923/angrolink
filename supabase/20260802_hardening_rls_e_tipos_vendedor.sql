-- ANGROLINK — migração de segurança e normalização de domínio
-- Executar no SQL Editor do projeto Supabase, numa única transação.
-- Depois de executar, regenerar src/types/database.types.ts com `supabase gen types`.

begin;

-- A base anterior usa `tipo_vendedor_valido`; instalações mais recentes podem
-- já usar `vendedores_tipo_vendedor_check`. Ambas têm de sair antes da conversão.
alter table public.vendedores drop constraint if exists tipo_vendedor_valido;
alter table public.vendedores drop constraint if exists vendedores_tipo_vendedor_check;

-- 1) Um único vocabulário para tipo_vendedor.
update public.vendedores set tipo_vendedor = 'produtor' where tipo_vendedor = 'fazenda';
update public.vendedores set tipo_vendedor = 'revendedor' where tipo_vendedor = 'mercado';
update public.vendedores set tipo_vendedor = 'mini_mercado' where tipo_vendedor = 'loja';
update public.vendedores set tipo_vendedor = 'prestador_servico' where tipo_vendedor in ('taxista', 'moto_taxista');

alter table public.vendedores
  add constraint vendedores_tipo_vendedor_check check (
    tipo_vendedor is null or tipo_vendedor in (
      'ambulante', 'quitandeira', 'produtor',
      'revendedor', 'mini_mercado', 'supermercado', 'hipermercado',
      'grossista', 'prestador_servico'
    )
  );

-- 2) Administração é uma lista no servidor, nunca user_metadata editável pelo cliente.
create table if not exists public.administradores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);

insert into public.administradores (user_id)
select id from auth.users where email = 'admin@angrolink.ao'
on conflict (user_id) do nothing;

alter table public.administradores enable row level security;

create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.administradores where user_id = auth.uid());
$$;

revoke all on function public.eh_admin() from public;
grant execute on function public.eh_admin() to anon, authenticated;

drop policy if exists administradores_apenas_admin on public.administradores;
create policy administradores_apenas_admin on public.administradores
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- 3) O vendedor nunca pode autoaprovar-se, verificar-se ou atribuir destaque.
create or replace function public.proteger_campos_vendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.eh_admin() then
    if tg_op = 'INSERT' and (
      coalesce(new.status_aprovacao, 'pendente') <> 'pendente'
      or coalesce(new.verificado, false)
      or coalesce(new.pode_destacar, false)
      or coalesce(new.plano, 'gratuito') <> 'gratuito'
    ) then
      raise exception 'Campos administrativos só podem ser definidos por um administrador';
    end if;

    if tg_op = 'UPDATE' and (
      new.status_aprovacao is distinct from old.status_aprovacao
      or new.verificado is distinct from old.verificado
      or new.pode_destacar is distinct from old.pode_destacar
      or new.plano is distinct from old.plano
      or new.user_id is distinct from old.user_id
      or new.conta_ativa is distinct from old.conta_ativa
    ) then
      raise exception 'Campos administrativos não podem ser alterados pelo vendedor';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_campos_vendedor on public.vendedores;
create trigger proteger_campos_vendedor
before insert or update on public.vendedores
for each row execute function public.proteger_campos_vendedor();

-- 4) RLS. As políticas são substituídas de forma idempotente.
alter table public.clientes enable row level security;
alter table public.vendedores enable row level security;
alter table public.produtos enable row level security;
alter table public.servicos enable row level security;
alter table public.categorias enable row level security;
alter table public.favoritos enable row level security;
alter table public.historico_contactos enable row level security;
alter table public.historico_contactos_servicos enable row level security;
alter table public.historico_pesquisas enable row level security;
alter table public.visualizacoes_produtos enable row level security;
alter table public.visualizacoes_servicos enable row level security;

drop policy if exists clientes_proprios_ou_admin on public.clientes;
create policy clientes_proprios_ou_admin on public.clientes for all to authenticated
  using (id = auth.uid() or public.eh_admin())
  with check (id = auth.uid() or public.eh_admin());

drop policy if exists vendedores_leitura on public.vendedores;
create policy vendedores_leitura on public.vendedores for select to anon, authenticated
  using (status_aprovacao = 'aprovado' and conta_ativa is not false or user_id = auth.uid() or public.eh_admin());
drop policy if exists vendedores_criar_proprio on public.vendedores;
create policy vendedores_criar_proprio on public.vendedores for insert to authenticated
  with check (user_id = auth.uid() or public.eh_admin());
drop policy if exists vendedores_editar_proprio on public.vendedores;
create policy vendedores_editar_proprio on public.vendedores for update to authenticated
  using (user_id = auth.uid() or public.eh_admin())
  with check (user_id = auth.uid() or public.eh_admin());
drop policy if exists vendedores_eliminar_admin on public.vendedores;
create policy vendedores_eliminar_admin on public.vendedores for delete to authenticated using (public.eh_admin());

drop policy if exists catalogo_publico on public.produtos;
create policy catalogo_publico on public.produtos for select to anon, authenticated
  using ((publicado and disponivel) or exists (select 1 from public.vendedores v where v.id = vendedor_id and (v.user_id = auth.uid() or public.eh_admin())));
drop policy if exists produtos_gerir_proprios on public.produtos;
create policy produtos_gerir_proprios on public.produtos for all to authenticated
  using (public.eh_admin() or exists (select 1 from public.vendedores v where v.id = vendedor_id and v.user_id = auth.uid()))
  with check (public.eh_admin() or exists (select 1 from public.vendedores v where v.id = vendedor_id and v.user_id = auth.uid() and v.status_aprovacao = 'aprovado' and v.conta_ativa is not false));

drop policy if exists servicos_publicos on public.servicos;
create policy servicos_publicos on public.servicos for select to anon, authenticated
  using ((publicado and disponivel) or exists (select 1 from public.vendedores v where v.id = vendedor_id and (v.user_id = auth.uid() or public.eh_admin())));
drop policy if exists servicos_gerir_proprios on public.servicos;
create policy servicos_gerir_proprios on public.servicos for all to authenticated
  using (public.eh_admin() or exists (select 1 from public.vendedores v where v.id = vendedor_id and v.user_id = auth.uid()))
  with check (public.eh_admin() or exists (select 1 from public.vendedores v where v.id = vendedor_id and v.user_id = auth.uid() and v.status_aprovacao = 'aprovado' and v.conta_ativa is not false));

drop policy if exists categorias_leitura_publica on public.categorias;
create policy categorias_leitura_publica on public.categorias for select to anon, authenticated using (true);
drop policy if exists categorias_admin on public.categorias;
create policy categorias_admin on public.categorias for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists favoritos_proprios on public.favoritos;
create policy favoritos_proprios on public.favoritos for all to authenticated
  using (utilizador_id = auth.uid() or public.eh_admin())
  with check (utilizador_id = auth.uid() or public.eh_admin());

drop policy if exists historico_contactos_participantes on public.historico_contactos;
create policy historico_contactos_participantes on public.historico_contactos for select to authenticated
  using (cliente_id = auth.uid() or public.eh_admin() or exists (select 1 from public.vendedores v where v.id = vendedor_id and v.user_id = auth.uid()));
drop policy if exists historico_contactos_criar_cliente on public.historico_contactos;
create policy historico_contactos_criar_cliente on public.historico_contactos for insert to authenticated
  with check (cliente_id = auth.uid() or public.eh_admin());

drop policy if exists historico_contactos_servicos_participantes on public.historico_contactos_servicos;
create policy historico_contactos_servicos_participantes on public.historico_contactos_servicos for select to authenticated
  using (cliente_id = auth.uid() or public.eh_admin() or exists (select 1 from public.vendedores v where v.id = vendedor_id and v.user_id = auth.uid()));
drop policy if exists historico_contactos_servicos_criar_cliente on public.historico_contactos_servicos;
create policy historico_contactos_servicos_criar_cliente on public.historico_contactos_servicos for insert to authenticated
  with check (cliente_id = auth.uid() or public.eh_admin());

drop policy if exists historico_pesquisas_proprio on public.historico_pesquisas;
create policy historico_pesquisas_proprio on public.historico_pesquisas for all to authenticated
  using (cliente_id = auth.uid() or public.eh_admin()) with check (cliente_id = auth.uid() or public.eh_admin());
drop policy if exists visualizacoes_produtos_proprias on public.visualizacoes_produtos;
create policy visualizacoes_produtos_proprias on public.visualizacoes_produtos for all to authenticated
  using (cliente_id = auth.uid() or public.eh_admin()) with check (cliente_id = auth.uid() or public.eh_admin());
drop policy if exists visualizacoes_servicos_proprias on public.visualizacoes_servicos;
create policy visualizacoes_servicos_proprias on public.visualizacoes_servicos for all to authenticated
  using (cliente_id = auth.uid() or public.eh_admin()) with check (cliente_id = auth.uid() or public.eh_admin());

commit;
