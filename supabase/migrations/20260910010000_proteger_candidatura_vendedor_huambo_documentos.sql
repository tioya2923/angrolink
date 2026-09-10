begin;

-- Fonte server-side mínima dos documentos exigidos para aprovação por tipo
-- de vendedor durante a Fase 1.
create or replace function public.documentos_obrigatorios_vendedor_fase1(
  p_tipo_vendedor text
)
returns text[]
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
    when p_tipo_vendedor in (
      'ambulante',
      'quitandeira',
      'produtor',
      'mini_mercado',
      'revendedor',
      'prestador_servico'
    ) then array['bi']::text[]

    when p_tipo_vendedor in (
      'supermercado',
      'grossista'
    ) then array['bi', 'nif', 'alvara']::text[]

    when p_tipo_vendedor = 'hipermercado'
      then array['bi', 'nif', 'alvara', 'registo_comercial']::text[]

    else null::text[]
  end;
$$;

revoke all on function public.documentos_obrigatorios_vendedor_fase1(text)
  from public, anon, authenticated;


-- Novas candidaturas de vendedor da Fase 1 só podem ser criadas no Huambo.
-- O trigger é apenas INSERT para não bloquear a manutenção de registos
-- históricos já existentes noutras províncias.
create or replace function public.validar_candidatura_vendedor_huambo()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_provincia_codigo text;
begin
  select territorio.provincia_codigo
    into v_provincia_codigo
    from public.resolver_territorio_angola(new.provincia, new.municipio) territorio
   limit 1;

  if v_provincia_codigo is distinct from 'HBO' then
    raise exception 'Nesta fase, o cadastro de vendedores está disponível apenas no Huambo.';
  end if;

  return new;
end;
$$;

revoke all on function public.validar_candidatura_vendedor_huambo()
  from public, anon, authenticated;

drop trigger if exists validar_candidatura_vendedor_huambo
  on public.vendedores;

create trigger validar_candidatura_vendedor_huambo
before insert on public.vendedores
for each row
execute function public.validar_candidatura_vendedor_huambo();


-- Mantém a mesma RPC administrativa e reforça as invariantes antes da
-- transição para aprovado.
create or replace function public.atualizar_estado_vendedor_admin(
  p_vendedor_id uuid,
  p_estado text,
  p_motivo_rejeicao text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_vendedor public.vendedores%rowtype;
  v_provincia_codigo text;
  v_documentos_obrigatorios text[];
begin
  if not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  if p_estado not in ('pendente', 'aprovado', 'rejeitado', 'suspenso') then
    raise exception 'Estado de vendedor inválido.';
  end if;

  if p_estado = 'rejeitado'
     and nullif(btrim(p_motivo_rejeicao), '') is null then
    raise exception 'Indique o motivo da rejeição.';
  end if;

  select *
    into v_vendedor
    from public.vendedores
   where id = p_vendedor_id
   for update;

  if not found then
    raise exception 'Vendedor não encontrado.';
  end if;

  if p_estado = 'aprovado' then
    select territorio.provincia_codigo
      into v_provincia_codigo
      from public.resolver_territorio_angola(
        v_vendedor.provincia,
        v_vendedor.municipio
      ) territorio
     limit 1;

    if v_provincia_codigo is distinct from 'HBO' then
      raise exception 'Nesta fase, apenas vendedores do Huambo podem ser aprovados.';
    end if;

    v_documentos_obrigatorios :=
      public.documentos_obrigatorios_vendedor_fase1(
        v_vendedor.tipo_vendedor
      );

    if coalesce(cardinality(v_documentos_obrigatorios), 0) = 0 then
      raise exception 'Tipo de vendedor inválido para aprovação.';
    end if;

    if exists (
      select 1
        from unnest(v_documentos_obrigatorios) requisito(tipo_documento)
       where not exists (
         select 1
           from public.documentos_vendedor d
          where d.vendedor_id = p_vendedor_id
            and d.tipo_documento = requisito.tipo_documento
            and d.estado = 'aprovado'
            and nullif(btrim(d.frente_path), '') is not null
            and nullif(btrim(d.verso_path), '') is not null
       )
    ) then
      raise exception 'Não é possível aprovar o vendedor enquanto existirem documentos obrigatórios pendentes ou em falta.';
    end if;
  end if;

  update public.vendedores
     set status_aprovacao = p_estado,
         aprovado_em = case
           when p_estado = 'aprovado' then now()
           else aprovado_em
         end,
         aprovado_por = case
           when p_estado = 'aprovado' then auth.uid()
           else aprovado_por
         end,
         motivo_rejeicao = case
           when p_estado = 'rejeitado'
             then btrim(p_motivo_rejeicao)
           else null
         end,
         verificado = case
           when p_estado in ('rejeitado', 'suspenso') then false
           else verificado
         end,
         pode_destacar = case
           when p_estado in ('rejeitado', 'suspenso') then false
           else pode_destacar
         end,
         atualizado_em = now()
   where id = p_vendedor_id;

  if not found then
    raise exception 'Vendedor não encontrado.';
  end if;
end;
$$;

revoke all on function public.atualizar_estado_vendedor_admin(uuid, text, text)
  from public, anon;

grant execute on function public.atualizar_estado_vendedor_admin(uuid, text, text)
  to authenticated;

commit;
