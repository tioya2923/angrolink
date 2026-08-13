-- ANGROLINK — documentos privados de vendedores.
-- Aditivo: preserva `vendedores.documentos` e os ficheiros antigos. Os novos
-- documentos passam a usar uma tabela, bucket e políticas privados.

begin;

create table if not exists public.documentos_vendedor (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references public.vendedores(id) on delete cascade,
  tipo_documento text not null check (tipo_documento in (
    'bi', 'nif', 'alvara', 'registo_comercial', 'cartao_vendedor',
    'comprovativo_banca', 'carta_conducao', 'certificado_moto_taxi',
    'livrete_veiculo', 'seguro_automovel', 'titulo_terra'
  )),
  frente_path text not null,
  verso_path text,
  numero_documento text,
  validade date,
  dados_adicionais jsonb not null default '{}'::jsonb,
  -- Instantâneo da política no momento do envio. Uma futura aprovação deve
  -- exigir somente os documentos obrigatórios do perfil, nunca todos os
  -- documentos opcionais que o vendedor decidiu anexar.
  obrigatorio_para_aprovacao boolean not null default false,
  estado text not null default 'pendente' check (estado in (
    'pendente', 'em_analise', 'aprovado', 'rejeitado', 'expirado'
  )),
  motivo_rejeicao text,
  analisado_por uuid references auth.users(id),
  analisado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (vendedor_id, tipo_documento)
);

alter table public.documentos_vendedor
  add column if not exists obrigatorio_para_aprovacao boolean not null default false;

create index if not exists documentos_vendedor_vendedor_estado_idx
  on public.documentos_vendedor(vendedor_id, estado);

create table if not exists public.documentos_vendedor_eventos (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos_vendedor(id) on delete cascade,
  vendedor_id uuid not null references public.vendedores(id) on delete cascade,
  evento text not null check (evento in ('criado', 'atualizado', 'reenviado', 'analisado')),
  estado_anterior text,
  estado_novo text,
  motivo_rejeicao text,
  detalhes jsonb not null default '{}'::jsonb,
  realizado_por uuid references auth.users(id),
  criado_em timestamptz not null default now()
);

alter table public.documentos_vendedor_eventos
  add column if not exists detalhes jsonb not null default '{}'::jsonb;

create index if not exists documentos_vendedor_eventos_documento_idx
  on public.documentos_vendedor_eventos(documento_id, criado_em desc);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.documentos_vendedor;
    exception
      when duplicate_object then null;
      when duplicate_table then null;
    end;
  end if;
end;
$$;

alter table public.documentos_vendedor replica identity full;

create or replace function public.atualizar_atualizado_em_documentos_vendedor()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists atualizar_documento_vendedor_em on public.documentos_vendedor;
create trigger atualizar_documento_vendedor_em
before update on public.documentos_vendedor
for each row execute function public.atualizar_atualizado_em_documentos_vendedor();

create or replace function public.proteger_analise_documento_vendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.eh_admin() then
    if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
      if new.estado = 'rejeitado' and coalesce(btrim(new.motivo_rejeicao), '') = '' then
        raise exception 'Indique o motivo da rejeição do documento.';
      end if;
      if new.estado in ('aprovado', 'rejeitado', 'expirado') then
        new.analisado_por = auth.uid();
        new.analisado_em = now();
      end if;
    end if;
    return new;
  end if;

  if split_part(new.frente_path, '/', 1) <> auth.uid()::text
    or (
      new.verso_path is not null
      and split_part(new.verso_path, '/', 1) <> auth.uid()::text
    ) then
    raise exception 'Os ficheiros do documento devem pertencer ao utilizador autenticado.';
  end if;

  if tg_op = 'INSERT' then
    if new.estado <> 'pendente'
      or new.obrigatorio_para_aprovacao <> false
      or new.motivo_rejeicao is not null
      or new.analisado_por is not null
      or new.analisado_em is not null then
      raise exception 'A análise do documento só pode ser definida por administrador.';
    end if;
    return new;
  end if;

  -- O vendedor não edita documentos em análise, aprovados, pendentes ou
  -- expirados. O único fluxo permitido é reenviar uma rejeição para nova
  -- análise, preservando os objetos antigos no Storage.
  if old.estado <> 'rejeitado' or new.estado <> 'pendente' then
    raise exception 'O documento só pode ser alterado ao reenviar uma versão rejeitada.';
  end if;

  -- Whitelist: somente ficheiros e metadados do novo envio, o estado e os
  -- campos administrativos limpos podem mudar. Qualquer campo presente ou
  -- adicionado futuramente fora desta lista permanece imutável para vendedor.
  if (to_jsonb(new) - array[
      'frente_path', 'verso_path', 'numero_documento', 'validade',
      'dados_adicionais', 'estado', 'motivo_rejeicao', 'analisado_por',
      'analisado_em', 'atualizado_em'
    ]) is distinct from (to_jsonb(old) - array[
      'frente_path', 'verso_path', 'numero_documento', 'validade',
      'dados_adicionais', 'estado', 'motivo_rejeicao', 'analisado_por',
      'analisado_em', 'atualizado_em'
    ]) then
    raise exception 'Campos protegidos do documento não podem ser alterados.';
  end if;

  new.motivo_rejeicao = null;
  new.analisado_por = null;
  new.analisado_em = null;
  return new;
end;
$$;

drop trigger if exists proteger_analise_documento_vendedor on public.documentos_vendedor;
create trigger proteger_analise_documento_vendedor
before insert or update on public.documentos_vendedor
for each row execute function public.proteger_analise_documento_vendedor();

create or replace function public.registar_evento_documento_vendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento text;
begin
  if tg_op = 'INSERT' then
    v_evento := 'criado';
    insert into public.documentos_vendedor_eventos (
      documento_id, vendedor_id, evento, estado_novo, detalhes, realizado_por
    ) values (
      new.id, new.vendedor_id, v_evento, new.estado,
      jsonb_build_object('frente_path_novo', new.frente_path, 'verso_path_novo', new.verso_path),
      auth.uid()
    );
    return new;
  end if;

  v_evento := case
    when old.estado = 'rejeitado' and new.estado = 'pendente' then 'reenviado'
    when new.estado is distinct from old.estado then 'analisado'
    else 'atualizado'
  end;

  insert into public.documentos_vendedor_eventos (
    documento_id, vendedor_id, evento, estado_anterior, estado_novo,
    motivo_rejeicao, detalhes, realizado_por
  ) values (
    new.id, new.vendedor_id, v_evento, old.estado, new.estado,
    new.motivo_rejeicao,
    jsonb_build_object(
      'frente_path_anterior', old.frente_path,
      'verso_path_anterior', old.verso_path,
      'frente_path_novo', new.frente_path,
      'verso_path_novo', new.verso_path
    ),
    auth.uid()
  );
  return new;
end;
$$;

drop trigger if exists registar_evento_documento_vendedor on public.documentos_vendedor;
create trigger registar_evento_documento_vendedor
after insert or update on public.documentos_vendedor
for each row execute function public.registar_evento_documento_vendedor();

alter table public.documentos_vendedor enable row level security;
alter table public.documentos_vendedor_eventos enable row level security;

drop policy if exists documentos_vendedor_leitura_propria_admin on public.documentos_vendedor;
create policy documentos_vendedor_leitura_propria_admin
on public.documentos_vendedor for select to authenticated
using (
  public.eh_admin() or exists (
    select 1 from public.vendedores v
    where v.id = vendedor_id and v.user_id = auth.uid()
  )
);

drop policy if exists documentos_vendedor_criar_proprio on public.documentos_vendedor;
create policy documentos_vendedor_criar_proprio
on public.documentos_vendedor for insert to authenticated
with check (
  public.eh_admin() or exists (
    select 1 from public.vendedores v
    where v.id = vendedor_id and v.user_id = auth.uid()
  )
);

drop policy if exists documentos_vendedor_atualizar_proprio_admin on public.documentos_vendedor;
create policy documentos_vendedor_atualizar_proprio_admin
on public.documentos_vendedor for update to authenticated
using (
  public.eh_admin() or (
    estado = 'rejeitado' and exists (
    select 1 from public.vendedores v
    where v.id = vendedor_id and v.user_id = auth.uid()
    )
  )
)
with check (
  public.eh_admin() or exists (
    select 1 from public.vendedores v
    where v.id = vendedor_id and v.user_id = auth.uid()
  )
);

drop policy if exists documentos_vendedor_eventos_apenas_admin on public.documentos_vendedor_eventos;
create policy documentos_vendedor_eventos_apenas_admin
on public.documentos_vendedor_eventos for select to authenticated
using (public.eh_admin());

insert into storage.buckets (id, name, public)
values ('documentos-vendedores', 'documentos-vendedores', false)
on conflict (id) do update set public = false;

drop policy if exists documentos_vendedores_upload_proprio on storage.objects;
create policy documentos_vendedores_upload_proprio
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documentos-vendedores'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists documentos_vendedores_leitura_propria_admin on storage.objects;
create policy documentos_vendedores_leitura_propria_admin
on storage.objects for select to authenticated
using (
  bucket_id = 'documentos-vendedores'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin())
);

-- Não existe policy UPDATE para este bucket: reenvios usam INSERT com um
-- caminho UUID novo, preservando o ficheiro que já foi analisado.
drop policy if exists documentos_vendedores_atualizar_proprio on storage.objects;

-- `vendedores` mantém dados antigos para compatibilidade, mas documentos não
-- podem ser selecionados diretamente pelo cliente PostgREST. Admins usam a
-- função abaixo durante a transição; novas leituras devem usar documentos_vendedor.
revoke select on table public.vendedores from anon, authenticated;
grant select (
  id, user_id, nome_comercial, nome_responsavel, descricao, email, email_login,
  telefone_whatsapp, whatsapp, indicativo_telefone, telefone_nacional,
  provincia, municipio, bairro, mercado_bairro,
  endereco_detalhado, tipo_vendedor, plano, verificado, status_aprovacao,
  motivo_rejeicao, conta_ativa, pode_destacar, aprovado_em, aprovado_por,
  foto_perfil, ano_inicio, data_inicio_atividade, horario_atendimento,
  entrega_disponivel, tipo_producao, area_cultivada, principais_culturas,
  producao_mensal, venda_grosso, venda_retalho, tipos_produtos,
  compra_produtores, volume_minimo, entrega_outras_provincias, tipo_loja,
  mercado_localizado, venda_presencial, proximo_destaque_produto_em,
  proximo_destaque_servico_em, criado_em, atualizado_em
) on public.vendedores to anon, authenticated;

create or replace function public.obter_documentos_legados_vendedor(p_vendedor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_documentos jsonb;
begin
  if not public.eh_admin() then
    raise exception 'Sem permissão para consultar documentos legados.';
  end if;

  select coalesce(documentos, '{}'::jsonb)
    into v_documentos
  from public.vendedores
  where id = p_vendedor_id;

  return coalesce(v_documentos, '{}'::jsonb);
end;
$$;

revoke all on function public.obter_documentos_legados_vendedor(uuid) from public;
grant execute on function public.obter_documentos_legados_vendedor(uuid) to authenticated;

commit;
