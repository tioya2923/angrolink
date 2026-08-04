-- ANGROLINK — fundação para Parceiros de Entregas.
-- Pré-requisito: a migração de segurança que cria public.eh_admin().
-- Esta migração não altera clientes, vendedores, produtos ou serviços existentes.

begin;

create table if not exists public.parceiros_entrega (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nome_completo text not null,
  email text,
  telefone text not null,
  provincia text not null,
  municipio text not null,
  bairro text,
  zona_base text,
  foto_perfil_url text,
  contacto_emergencia text not null,
  termos_aceites_em timestamptz not null default now(),
  estado text not null default 'rascunho' check (estado in (
    'rascunho', 'documentos_pendentes', 'em_analise', 'aprovado',
    'rejeitado', 'suspenso', 'documentacao_expirada'
  )),
  disponibilidade boolean not null default false,
  motivo_rejeicao text,
  motivo_suspensao text,
  aprovado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint parceiro_disponivel_aprovado check (not disponibilidade or estado = 'aprovado')
);

create table if not exists public.veiculos_entrega (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros_entrega(id) on delete cascade,
  tipo_veiculo text not null check (tipo_veiculo in ('mota', 'carro', 'carrinha', 'camiao')),
  marca text not null,
  modelo text not null,
  cor text not null,
  ano smallint,
  matricula text not null unique,
  tipo_carrocaria text,
  capacidade_kg numeric(10,2) not null check (capacidade_kg > 0),
  capacidade_volume_m3 numeric(10,3),
  possui_caixa_carga boolean not null default false,
  aceita_paletes boolean not null default false,
  possui_refrigeracao boolean not null default false,
  foto_veiculo_path text,
  estado_verificacao text not null default 'pendente' check (estado_verificacao in ('pendente', 'aprovado', 'rejeitado', 'expirado')),
  motivo_rejeicao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.areas_cobertura_entrega (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros_entrega(id) on delete cascade,
  provincia text not null,
  municipio text not null,
  bairro text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (parceiro_id, provincia, municipio, bairro)
);

create table if not exists public.documentos_parceiro_entrega (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros_entrega(id) on delete cascade,
  veiculo_id uuid references public.veiculos_entrega(id) on delete cascade,
  tipo_documento text not null check (tipo_documento in (
    'bi', 'carta_conducao', 'livrete_veiculo', 'seguro_automovel',
    'inspecao_tecnica', 'licenca_transporte_mercadorias', 'nif',
    'certidao_comercial', 'alvara_comercial'
  )),
  numero_documento text,
  validade date,
  frente_path text not null,
  verso_path text not null,
  estado text not null default 'pendente' check (estado in ('pendente', 'aprovado', 'rejeitado', 'expirado')),
  motivo_rejeicao text,
  analisado_por uuid references auth.users(id),
  analisado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (parceiro_id, veiculo_id, tipo_documento)
);

create index if not exists veiculos_entrega_parceiro_idx on public.veiculos_entrega(parceiro_id);
create index if not exists areas_cobertura_entrega_zona_idx on public.areas_cobertura_entrega(provincia, municipio) where ativo;
create index if not exists documentos_parceiro_estado_idx on public.documentos_parceiro_entrega(parceiro_id, estado);
create unique index if not exists documentos_parceiro_pessoal_unico_idx
  on public.documentos_parceiro_entrega(parceiro_id, tipo_documento)
  where veiculo_id is null;
create unique index if not exists documentos_parceiro_veiculo_unico_idx
  on public.documentos_parceiro_entrega(parceiro_id, veiculo_id, tipo_documento)
  where veiculo_id is not null;

create or replace function public.atualizar_atualizado_em_parceiros_entrega()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists atualizar_parceiro_entrega_em on public.parceiros_entrega;
create trigger atualizar_parceiro_entrega_em before update on public.parceiros_entrega
for each row execute function public.atualizar_atualizado_em_parceiros_entrega();

drop trigger if exists atualizar_veiculo_entrega_em on public.veiculos_entrega;
create trigger atualizar_veiculo_entrega_em before update on public.veiculos_entrega
for each row execute function public.atualizar_atualizado_em_parceiros_entrega();

drop trigger if exists atualizar_documento_parceiro_em on public.documentos_parceiro_entrega;
create trigger atualizar_documento_parceiro_em before update on public.documentos_parceiro_entrega
for each row execute function public.atualizar_atualizado_em_parceiros_entrega();

-- Um parceiro nunca se aprova, suspende ou marca documentos como válidos.
create or replace function public.proteger_estado_parceiro_entrega()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then
    if tg_op = 'INSERT' and (new.estado <> 'rascunho' or new.disponibilidade) then
      raise exception 'O parceiro não pode aprovar-se ou ficar disponível no cadastro';
    end if;
    if tg_op = 'UPDATE' and (
      new.user_id is distinct from old.user_id or
      new.estado is distinct from old.estado or
      new.motivo_rejeicao is distinct from old.motivo_rejeicao or
      new.motivo_suspensao is distinct from old.motivo_suspensao or
      new.aprovado_em is distinct from old.aprovado_em
    ) then
      raise exception 'O estado administrativo do parceiro só pode ser alterado por administrador';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_estado_parceiro_entrega on public.parceiros_entrega;
create trigger proteger_estado_parceiro_entrega before insert or update on public.parceiros_entrega
for each row execute function public.proteger_estado_parceiro_entrega();

create or replace function public.proteger_verificacao_logistica()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then
    if tg_table_name = 'veiculos_entrega' and (
      (tg_op = 'INSERT' and new.estado_verificacao <> 'pendente') or
      (tg_op = 'UPDATE' and (new.estado_verificacao is distinct from old.estado_verificacao or new.motivo_rejeicao is distinct from old.motivo_rejeicao))
    ) then
      raise exception 'A verificação do veículo só pode ser alterada por administrador';
    end if;
    if tg_table_name = 'documentos_parceiro_entrega' and (
      (tg_op = 'INSERT' and new.estado <> 'pendente') or
      (tg_op = 'UPDATE' and (new.estado is distinct from old.estado or new.motivo_rejeicao is distinct from old.motivo_rejeicao or new.analisado_por is distinct from old.analisado_por or new.analisado_em is distinct from old.analisado_em))
    ) then
      raise exception 'A verificação do documento só pode ser alterada por administrador';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.validar_veiculo_do_documento_parceiro()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.veiculo_id is not null and not exists (
    select 1 from public.veiculos_entrega v
    where v.id = new.veiculo_id and v.parceiro_id = new.parceiro_id
  ) then
    raise exception 'O veículo indicado não pertence ao parceiro';
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_verificacao_veiculo on public.veiculos_entrega;
create trigger proteger_verificacao_veiculo before insert or update on public.veiculos_entrega
for each row execute function public.proteger_verificacao_logistica();

drop trigger if exists proteger_verificacao_documento on public.documentos_parceiro_entrega;
create trigger proteger_verificacao_documento before insert or update on public.documentos_parceiro_entrega
for each row execute function public.proteger_verificacao_logistica();

drop trigger if exists validar_veiculo_documento_parceiro on public.documentos_parceiro_entrega;
create trigger validar_veiculo_documento_parceiro before insert or update on public.documentos_parceiro_entrega
for each row execute function public.validar_veiculo_do_documento_parceiro();

alter table public.parceiros_entrega enable row level security;
alter table public.veiculos_entrega enable row level security;
alter table public.areas_cobertura_entrega enable row level security;
alter table public.documentos_parceiro_entrega enable row level security;

drop policy if exists parceiros_entrega_dono_ou_admin on public.parceiros_entrega;
create policy parceiros_entrega_dono_ou_admin on public.parceiros_entrega for all to authenticated
using (user_id = auth.uid() or public.eh_admin())
with check (user_id = auth.uid() or public.eh_admin());

drop policy if exists veiculos_entrega_dono_ou_admin on public.veiculos_entrega;
create policy veiculos_entrega_dono_ou_admin on public.veiculos_entrega for all to authenticated
using (public.eh_admin() or exists (select 1 from public.parceiros_entrega p where p.id = parceiro_id and p.user_id = auth.uid()))
with check (public.eh_admin() or exists (select 1 from public.parceiros_entrega p where p.id = parceiro_id and p.user_id = auth.uid()));

drop policy if exists areas_entrega_dono_ou_admin on public.areas_cobertura_entrega;
create policy areas_entrega_dono_ou_admin on public.areas_cobertura_entrega for all to authenticated
using (public.eh_admin() or exists (select 1 from public.parceiros_entrega p where p.id = parceiro_id and p.user_id = auth.uid()))
with check (public.eh_admin() or exists (select 1 from public.parceiros_entrega p where p.id = parceiro_id and p.user_id = auth.uid()));

drop policy if exists documentos_parceiro_dono_ou_admin on public.documentos_parceiro_entrega;
create policy documentos_parceiro_dono_ou_admin on public.documentos_parceiro_entrega for all to authenticated
using (public.eh_admin() or exists (select 1 from public.parceiros_entrega p where p.id = parceiro_id and p.user_id = auth.uid()))
with check (public.eh_admin() or exists (select 1 from public.parceiros_entrega p where p.id = parceiro_id and p.user_id = auth.uid()));

-- Fotografias de documentos ficam num bucket privado e nunca recebem URL pública.
insert into storage.buckets (id, name, public)
values ('documentos-parceiros', 'documentos-parceiros', false)
on conflict (id) do update set public = false;

drop policy if exists documentos_parceiros_upload_proprio on storage.objects;
create policy documentos_parceiros_upload_proprio on storage.objects for insert to authenticated
with check (bucket_id = 'documentos-parceiros' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists documentos_parceiros_leitura_propria_admin on storage.objects;
create policy documentos_parceiros_leitura_propria_admin on storage.objects for select to authenticated
using (bucket_id = 'documentos-parceiros' and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin()));

drop policy if exists documentos_parceiros_atualizar_proprio on storage.objects;
create policy documentos_parceiros_atualizar_proprio on storage.objects for update to authenticated
using (bucket_id = 'documentos-parceiros' and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin()))
with check (bucket_id = 'documentos-parceiros' and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin()));

drop policy if exists documentos_parceiros_eliminar_proprio on storage.objects;
create policy documentos_parceiros_eliminar_proprio on storage.objects for delete to authenticated
using (bucket_id = 'documentos-parceiros' and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin()));

commit;
