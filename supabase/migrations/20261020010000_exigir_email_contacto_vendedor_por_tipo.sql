begin;

-- Email de contacto é um dado de domínio, separado de email_login e de Auth.
-- Apenas negócios formalizados precisam dele nesta fase.
create or replace function public.tipo_vendedor_exige_email_contacto(p_tipo_vendedor text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_tipo_vendedor in ('supermercado', 'hipermercado', 'grossista');
$$;

create or replace function public.email_contacto_vendedor_valido(p_email text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select nullif(btrim(p_email), '') is not null
    and lower(btrim(p_email)) ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    and lower(btrim(p_email)) !~ '@telefone[.]angrolink$';
$$;

create or replace function public.validar_email_contacto_vendedor_por_tipo()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if nullif(btrim(new.email), '') is not null then
    new.email := lower(btrim(new.email));

    if not public.email_contacto_vendedor_valido(new.email) then
      raise exception 'Indique um email de contacto válido; o endereço interno de telefone não pode ser usado.';
    end if;
  elsif public.tipo_vendedor_exige_email_contacto(new.tipo_vendedor) then
    raise exception 'Este tipo de vendedor exige um email de contacto válido.';
  end if;

  return new;
end;
$$;

drop trigger if exists validar_email_contacto_vendedor_por_tipo on public.vendedores;
create trigger validar_email_contacto_vendedor_por_tipo
before insert or update of email, tipo_vendedor on public.vendedores
for each row execute function public.validar_email_contacto_vendedor_por_tipo();

-- Documentos iniciam ou retomam uma candidatura. Não bloqueamos edições
-- comuns de perfis históricos: apenas uma nova submissão/reenvio pendente.
create or replace function public.validar_email_contacto_submissao_documento_vendedor()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_tipo_vendedor text;
  v_email text;
begin
  if new.estado is distinct from 'pendente'
    or (
      tg_op = 'UPDATE'
      and old.estado = 'pendente'
      and old.frente_path is not distinct from new.frente_path
      and old.verso_path is not distinct from new.verso_path
    ) then
    return new;
  end if;

  select v.tipo_vendedor, v.email
    into v_tipo_vendedor, v_email
    from public.vendedores v
   where v.id = new.vendedor_id;

  if public.tipo_vendedor_exige_email_contacto(v_tipo_vendedor)
    and not public.email_contacto_vendedor_valido(v_email) then
    raise exception 'Adicione um email de contacto válido ao perfil antes de enviar documentos para análise.';
  end if;

  return new;
end;
$$;

drop trigger if exists validar_email_contacto_submissao_documento_vendedor on public.documentos_vendedor;
create trigger validar_email_contacto_submissao_documento_vendedor
before insert or update of estado, frente_path, verso_path on public.documentos_vendedor
for each row execute function public.validar_email_contacto_submissao_documento_vendedor();

-- Mantém a RPC administrativa existente e acrescenta a última barreira antes
-- de aprovar uma candidatura empresarial histórica sem contacto válido.
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
    if public.tipo_vendedor_exige_email_contacto(v_vendedor.tipo_vendedor)
      and not public.email_contacto_vendedor_valido(v_vendedor.email) then
      raise exception 'Não é possível aprovar este vendedor sem um email de contacto válido.';
    end if;

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

revoke all on function public.tipo_vendedor_exige_email_contacto(text), public.email_contacto_vendedor_valido(text), public.validar_email_contacto_vendedor_por_tipo(), public.validar_email_contacto_submissao_documento_vendedor() from public, anon, authenticated;
revoke all on function public.atualizar_estado_vendedor_admin(uuid, text, text) from public, anon;
grant execute on function public.atualizar_estado_vendedor_admin(uuid, text, text) to authenticated;

commit;
