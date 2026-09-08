begin;

-- Fundação isolada para prestadores profissionais. O domínio legado de
-- vendedores continua a ser a autoridade dos serviços já existentes.
create table public.prestadores_servico (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id),
  tipo_prestador text,
  nome_publico text not null,
  descricao text,
  telefone_whatsapp text,
  email text,
  provincia text,
  municipio text,
  foto_url text,
  status_aprovacao text not null default 'pendente',
  conta_ativa boolean not null default true,
  verificado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint prestadores_servico_tipo_check
    check (tipo_prestador is null or tipo_prestador in ('pessoa', 'empresa')),
  constraint prestadores_servico_status_check
    check (status_aprovacao in ('pendente', 'aprovado', 'rejeitado', 'suspenso'))
);

create table public.categorias_servico (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  descricao text,
  icone text,
  ordem integer not null default 0,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint categorias_servico_slug_check
    check (slug = lower(btrim(slug)) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

alter table public.servicos
  add column prestador_id uuid null references public.prestadores_servico(id),
  add column categoria_id uuid null references public.categorias_servico(id);

create index prestadores_servico_publicos_idx
  on public.prestadores_servico (provincia, municipio, id)
  where status_aprovacao = 'aprovado' and conta_ativa = true;

create index servicos_prestador_id_idx on public.servicos (prestador_id);
create index servicos_categoria_id_idx on public.servicos (categoria_id);

insert into public.categorias_servico (nome, slug, ordem) values
  ('Preparação de terreno', 'preparacao-de-terreno', 10),
  ('Mão de obra agrícola', 'mao-de-obra-agricola', 20),
  ('Assistência técnica', 'assistencia-tecnica', 30),
  ('Consultoria agrícola', 'consultoria-agricola', 40),
  ('Análise de solo', 'analise-de-solo', 50),
  ('Veterinária', 'veterinaria', 60),
  ('Aluguer de equipamentos', 'aluguer-de-equipamentos', 70),
  ('Manutenção e reparação', 'manutencao-e-reparacao', 80),
  ('Irrigação', 'irrigacao', 90),
  ('Formação e workshops', 'formacao-e-workshops', 100),
  ('Outros serviços profissionais', 'outros-servicos-profissionais', 110)
on conflict (slug) do nothing;

create or replace function public.proteger_prestador_servico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.eh_admin() then
    if tg_op = 'insert' and (
      new.user_id is distinct from auth.uid()
      or new.status_aprovacao <> 'pendente'
      or new.conta_ativa is not true
      or new.verificado is not false
    ) then
      raise exception 'Campos administrativos de prestador só podem ser definidos por um administrador.';
    end if;

    if tg_op = 'update' and (
      new.user_id is distinct from old.user_id
      or new.status_aprovacao is distinct from old.status_aprovacao
      or new.conta_ativa is distinct from old.conta_ativa
      or new.verificado is distinct from old.verificado
    ) then
      raise exception 'Campos administrativos de prestador só podem ser alterados por um administrador.';
    end if;
  end if;

  if tg_op = 'insert' then
    new.criado_em := now();
  end if;

  new.atualizado_em := now();
  return new;
end;
$$;

create or replace function public.atualizar_atualizado_em_categoria_servico()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger proteger_prestador_servico
before insert or update on public.prestadores_servico
for each row execute function public.proteger_prestador_servico();

create trigger atualizar_categoria_servico_em
before update on public.categorias_servico
for each row execute function public.atualizar_atualizado_em_categoria_servico();

alter table public.prestadores_servico enable row level security;
alter table public.categorias_servico enable row level security;

create policy prestadores_servico_ler_proprio
on public.prestadores_servico
for select to authenticated
using (user_id = auth.uid());

create policy prestadores_servico_criar_proprio
on public.prestadores_servico
for insert to authenticated
with check (user_id = auth.uid());

create policy prestadores_servico_atualizar_proprio
on public.prestadores_servico
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy prestadores_servico_admin_gerir
on public.prestadores_servico
for all to authenticated
using (public.eh_admin())
with check (public.eh_admin());

create policy categorias_servico_ler_ativas
on public.categorias_servico
for select to anon, authenticated
using (ativa = true);

create policy categorias_servico_admin_gerir
on public.categorias_servico
for all to authenticated
using (public.eh_admin())
with check (public.eh_admin());

revoke all on table public.prestadores_servico from public, anon, authenticated;
grant select, insert, update on table public.prestadores_servico to authenticated;

revoke all on table public.categorias_servico from public, anon, authenticated;
grant select on table public.categorias_servico to anon;
grant select, insert, update, delete on table public.categorias_servico to authenticated;

create or replace function public.obter_meu_prestador_servico()
returns table(
  id uuid,
  user_id uuid,
  tipo_prestador text,
  nome_publico text,
  descricao text,
  telefone_whatsapp text,
  email text,
  provincia text,
  municipio text,
  foto_url text,
  status_aprovacao text,
  conta_ativa boolean,
  verificado boolean,
  criado_em timestamptz,
  atualizado_em timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.user_id, p.tipo_prestador, p.nome_publico, p.descricao,
    p.telefone_whatsapp, p.email, p.provincia, p.municipio, p.foto_url,
    p.status_aprovacao, p.conta_ativa, p.verificado, p.criado_em, p.atualizado_em
  from public.prestadores_servico p
  where p.user_id = auth.uid();
$$;

create or replace function public.listar_prestadores_servicos_publicos(
  p_prestador_ids uuid[] default null
)
returns table(
  id uuid,
  tipo_prestador text,
  nome_publico text,
  descricao text,
  telefone_whatsapp text,
  provincia text,
  municipio text,
  foto_url text,
  verificado boolean,
  criado_em timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.tipo_prestador, p.nome_publico, p.descricao,
    p.telefone_whatsapp, p.provincia, p.municipio, p.foto_url,
    p.verificado, p.criado_em
  from public.prestadores_servico p
  where p.status_aprovacao = 'aprovado'
    and p.conta_ativa = true
    and (p_prestador_ids is null or p.id = any(p_prestador_ids))
  order by p.nome_publico, p.id;
$$;

create or replace function public.listar_prestadores_servico_admin()
returns table(
  id uuid,
  user_id uuid,
  tipo_prestador text,
  nome_publico text,
  descricao text,
  telefone_whatsapp text,
  email text,
  provincia text,
  municipio text,
  foto_url text,
  status_aprovacao text,
  conta_ativa boolean,
  verificado boolean,
  criado_em timestamptz,
  atualizado_em timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  return query
  select
    p.id, p.user_id, p.tipo_prestador, p.nome_publico, p.descricao,
    p.telefone_whatsapp, p.email, p.provincia, p.municipio, p.foto_url,
    p.status_aprovacao, p.conta_ativa, p.verificado, p.criado_em, p.atualizado_em
  from public.prestadores_servico p
  order by p.criado_em desc, p.id;
end;
$$;

create or replace function public.atualizar_estado_prestador_servico_admin(
  p_prestador_id uuid,
  p_estado text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  if p_estado not in ('pendente', 'aprovado', 'rejeitado', 'suspenso') then
    raise exception 'Estado de prestador inválido.';
  end if;

  update public.prestadores_servico
  set
    status_aprovacao = p_estado,
    verificado = case when p_estado in ('rejeitado', 'suspenso') then false else verificado end,
    atualizado_em = now()
  where id = p_prestador_id;

  if not found then
    raise exception 'Prestador não encontrado.';
  end if;
end;
$$;

create or replace function public.atualizar_verificacao_prestador_servico_admin(
  p_prestador_id uuid,
  p_verificado boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  if p_verificado and not exists (
    select 1
    from public.prestadores_servico
    where id = p_prestador_id
      and status_aprovacao = 'aprovado'
      and conta_ativa = true
  ) then
    raise exception 'Apenas prestadores aprovados e ativos podem ser verificados.';
  end if;

  update public.prestadores_servico
  set verificado = p_verificado, atualizado_em = now()
  where id = p_prestador_id;

  if not found then
    raise exception 'Prestador não encontrado.';
  end if;
end;
$$;

revoke all on function public.proteger_prestador_servico(), public.atualizar_atualizado_em_categoria_servico() from public, anon, authenticated;
revoke all on function public.obter_meu_prestador_servico(), public.listar_prestadores_servico_admin(), public.atualizar_estado_prestador_servico_admin(uuid, text), public.atualizar_verificacao_prestador_servico_admin(uuid, boolean) from public, anon;
grant execute on function public.obter_meu_prestador_servico(), public.listar_prestadores_servico_admin(), public.atualizar_estado_prestador_servico_admin(uuid, text), public.atualizar_verificacao_prestador_servico_admin(uuid, boolean) to authenticated;

revoke all on function public.listar_prestadores_servicos_publicos(uuid[]) from public, anon, authenticated;
grant execute on function public.listar_prestadores_servicos_publicos(uuid[]) to anon, authenticated;

commit;
