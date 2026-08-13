-- ANGROLINK — confirmação presencial de levantamento através de OTP.
-- O código nunca é persistido em texto simples nem incluído em eventos.

begin;

create table public.codigos_levantamento (
  id uuid primary key default gen_random_uuid(),
  encomenda_id uuid not null unique references public.encomendas(id) on delete restrict,
  codigo_hash text not null,
  expira_em timestamptz not null,
  tentativas smallint not null default 0 check (tentativas >= 0),
  max_tentativas smallint not null default 5 check (max_tentativas between 1 and 10),
  bloqueado_em timestamptz,
  usado_em timestamptz,
  geracoes smallint not null default 1 check (geracoes between 1 and 3),
  criado_por uuid not null references auth.users(id) on delete restrict,
  atualizado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  gerado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint codigos_levantamento_bloqueio_consistente check (
    bloqueado_em is null or tentativas >= max_tentativas
  ),
  constraint codigos_levantamento_uso_consistente check (
    usado_em is null or usado_em >= criado_em
  )
);

create index codigos_levantamento_expira_em_idx
  on public.codigos_levantamento (expira_em)
  where usado_em is null;

create or replace function public.atualizar_atualizado_em_codigo_levantamento()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger atualizar_codigo_levantamento_em
before update on public.codigos_levantamento
for each row execute function public.atualizar_atualizado_em_codigo_levantamento();

-- Usa bytes aleatórios de pgcrypto; o espaço de seis dígitos é protegido no
-- servidor também pelo prazo curto e pelo máximo de tentativas.
create or replace function public.gerar_otp_levantamento_aleatorio()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_bytes bytea := extensions.gen_random_bytes(4);
  v_valor bigint;
begin
  v_valor :=
    (get_byte(v_bytes, 0)::bigint << 24)
    + (get_byte(v_bytes, 1)::bigint << 16)
    + (get_byte(v_bytes, 2)::bigint << 8)
    + get_byte(v_bytes, 3)::bigint;

  return lpad((v_valor % 1000000)::text, 6, '0');
end;
$$;

-- O cliente solicita o código apenas depois de a encomenda estar pronta.
-- Não é possível recuperar um OTP anterior: um novo pedido autorizado renova
-- o hash, invalida o código anterior e devolve o novo valor uma única vez.
create or replace function public.obter_codigo_levantamento_cliente(
  p_encomenda_id uuid
)
returns table (
  codigo text,
  expira_em timestamptz,
  geracoes smallint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encomenda public.encomendas%rowtype;
  v_codigo public.codigos_levantamento%rowtype;
  v_otp text;
  v_agora timestamptz := now();
  v_evento text;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão novamente.';
  end if;

  select * into v_encomenda
  from public.encomendas
  where id = p_encomenda_id
    and cliente_id = auth.uid()
  for update;

  if not found then
    raise exception 'Encomenda não encontrada ou sem permissão.';
  end if;

  if v_encomenda.estado <> 'pronta_para_levantamento' then
    raise exception 'O código de levantamento só está disponível quando a encomenda estiver pronta.';
  end if;

  select * into v_codigo
  from public.codigos_levantamento
  where encomenda_id = v_encomenda.id
  for update;

  if found then
    if v_codigo.usado_em is not null then
      raise exception 'O código desta encomenda já foi utilizado.';
    end if;

    if v_codigo.gerado_em > v_agora - interval '60 seconds' then
      raise exception 'Aguarde um minuto antes de renovar o código de levantamento.';
    end if;

    if v_codigo.geracoes >= 3 then
      raise exception 'Foi atingido o limite de renovações do código de levantamento. Contacte o suporte.';
    end if;

    v_evento := 'codigo_levantamento_regenerado';
    v_otp := public.gerar_otp_levantamento_aleatorio();

    update public.codigos_levantamento
    set
      codigo_hash = extensions.crypt(v_otp, extensions.gen_salt('bf', 10)),
      expira_em = v_agora + interval '15 minutes',
      tentativas = 0,
      bloqueado_em = null,
      geracoes = v_codigo.geracoes + 1,
      atualizado_por = auth.uid(),
      gerado_em = v_agora
    where id = v_codigo.id
    returning codigos_levantamento.expira_em, codigos_levantamento.geracoes
      into expira_em, geracoes;
  else
    v_evento := 'codigo_levantamento_gerado';
    v_otp := public.gerar_otp_levantamento_aleatorio();

    insert into public.codigos_levantamento (
      encomenda_id, codigo_hash, expira_em, criado_por, atualizado_por
    ) values (
      v_encomenda.id,
      extensions.crypt(v_otp, extensions.gen_salt('bf', 10)),
      v_agora + interval '15 minutes',
      auth.uid(), auth.uid()
    ) returning codigos_levantamento.expira_em, codigos_levantamento.geracoes
      into expira_em, geracoes;
  end if;

  insert into public.eventos_encomenda (
    encomenda_id, tipo_evento, estado_anterior, estado_novo,
    ator_tipo, utilizador_id, metadados
  ) values (
    v_encomenda.id, v_evento, 'pronta_para_levantamento', 'pronta_para_levantamento',
    'cliente', auth.uid(), jsonb_build_object('validade_segundos', 900, 'geracoes', geracoes)
  );

  codigo := v_otp;
  return next;
end;
$$;

-- Uma tentativa inválida devolve um resultado controlado, em vez de lançar
-- exceção e reverter o incremento de tentativas e o evento de auditoria.
create or replace function public.validar_codigo_levantamento_vendedor(
  p_encomenda_id uuid,
  p_codigo text
)
returns table (
  validado boolean,
  estado_encomenda text,
  tentativas_restantes smallint,
  bloqueado boolean,
  motivo text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encomenda public.encomendas%rowtype;
  v_codigo public.codigos_levantamento%rowtype;
  v_codigo_apresentado text := nullif(btrim(p_codigo), '');
  v_agora timestamptz := now();
  v_tentativas smallint;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão novamente.';
  end if;

  if v_codigo_apresentado is null or v_codigo_apresentado !~ '^[0-9]{6}$' then
    raise exception 'Introduza o código de levantamento de seis dígitos.';
  end if;

  select * into v_encomenda
  from public.encomendas
  where id = p_encomenda_id
  for update;

  if not found then
    raise exception 'Encomenda não encontrada.';
  end if;

  if not exists (
    select 1
    from public.vendedores v
    where v.id = v_encomenda.vendedor_id
      and v.user_id = auth.uid()
      and public.vendedor_pode_receber_encomendas(v.id)
  ) then
    raise exception 'Sem permissão para validar o levantamento desta encomenda.';
  end if;

  if v_encomenda.estado <> 'pronta_para_levantamento' then
    raise exception 'Esta encomenda não está pronta para levantamento.';
  end if;

  select * into v_codigo
  from public.codigos_levantamento
  where encomenda_id = v_encomenda.id
  for update;

  if not found then
    validado := false;
    estado_encomenda := v_encomenda.estado;
    tentativas_restantes := 0;
    bloqueado := false;
    motivo := 'Não existe código de levantamento ativo para esta encomenda.';
    return next;
    return;
  end if;

  if v_codigo.usado_em is not null then
    validado := false;
    estado_encomenda := v_encomenda.estado;
    tentativas_restantes := 0;
    bloqueado := false;
    motivo := 'Este código de levantamento já foi utilizado.';
    return next;
    return;
  end if;

  if v_codigo.bloqueado_em is not null or v_codigo.tentativas >= v_codigo.max_tentativas then
    validado := false;
    estado_encomenda := v_encomenda.estado;
    tentativas_restantes := 0;
    bloqueado := true;
    motivo := 'Este código de levantamento está bloqueado. O cliente deve renová-lo.';
    return next;
    return;
  end if;

  if v_codigo.expira_em <= v_agora then
    validado := false;
    estado_encomenda := v_encomenda.estado;
    tentativas_restantes := v_codigo.max_tentativas - v_codigo.tentativas;
    bloqueado := false;
    motivo := 'Este código de levantamento expirou. O cliente deve renová-lo.';
    return next;
    return;
  end if;

  if extensions.crypt(v_codigo_apresentado, v_codigo.codigo_hash) <> v_codigo.codigo_hash then
    v_tentativas := v_codigo.tentativas + 1;

    update public.codigos_levantamento
    set
      tentativas = v_tentativas,
      bloqueado_em = case when v_tentativas >= v_codigo.max_tentativas then v_agora else null end,
      atualizado_por = auth.uid()
    where id = v_codigo.id;

    insert into public.eventos_encomenda (
      encomenda_id, tipo_evento, estado_anterior, estado_novo,
      ator_tipo, utilizador_id, metadados
    ) values (
      v_encomenda.id, 'tentativa_levantamento_falhou',
      'pronta_para_levantamento', 'pronta_para_levantamento',
      'vendedor', auth.uid(), jsonb_build_object('tentativas', v_tentativas, 'bloqueado', v_tentativas >= v_codigo.max_tentativas)
    );

    validado := false;
    estado_encomenda := v_encomenda.estado;
    tentativas_restantes := greatest(v_codigo.max_tentativas - v_tentativas, 0)::smallint;
    bloqueado := v_tentativas >= v_codigo.max_tentativas;
    motivo := case
      when bloqueado then 'Código incorreto. O limite de tentativas foi atingido e o código foi bloqueado.'
      else 'Código de levantamento incorreto.'
    end;
    return next;
    return;
  end if;

  update public.codigos_levantamento
  set usado_em = v_agora, atualizado_por = auth.uid()
  where id = v_codigo.id;

  update public.encomendas
  set estado = 'levantada'
  where id = v_encomenda.id
  returning * into v_encomenda;

  insert into public.eventos_encomenda (
    encomenda_id, tipo_evento, estado_anterior, estado_novo,
    ator_tipo, utilizador_id, metadados
  ) values (
    v_encomenda.id, 'levantamento_confirmado',
    'pronta_para_levantamento', 'levantada',
    'vendedor', auth.uid(), '{}'::jsonb
  );

  validado := true;
  estado_encomenda := v_encomenda.estado;
  tentativas_restantes := v_codigo.max_tentativas - v_codigo.tentativas;
  bloqueado := false;
  motivo := null;
  return next;
end;
$$;

-- Consulta operacional sem hash/OTP. Só administradores podem aceder.
create or replace function public.consultar_estado_codigo_levantamento_admin(
  p_encomenda_id uuid
)
returns table (
  encomenda_id uuid,
  expira_em timestamptz,
  tentativas smallint,
  max_tentativas smallint,
  bloqueado_em timestamptz,
  usado_em timestamptz,
  geracoes smallint,
  criado_em timestamptz,
  atualizado_em timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.encomenda_id, c.expira_em, c.tentativas, c.max_tentativas,
    c.bloqueado_em, c.usado_em, c.geracoes, c.criado_em, c.atualizado_em
  from public.codigos_levantamento c
  where c.encomenda_id = p_encomenda_id
    and public.eh_admin();
$$;

alter table public.codigos_levantamento enable row level security;

-- Não existem políticas de leitura nem de escrita direta: o hash só é
-- manipulado pelas RPCs SECURITY DEFINER e o OTP em claro só sai na RPC do cliente.
create policy codigos_levantamento_sem_acesso_direto
on public.codigos_levantamento
for all to authenticated
using (false)
with check (false);

revoke all on table public.codigos_levantamento from public, anon, authenticated;

alter table public.eventos_encomenda
  drop constraint if exists eventos_encomenda_tipo_evento_check;
alter table public.eventos_encomenda
  add constraint eventos_encomenda_tipo_evento_check check (tipo_evento in (
    'encomenda_criada', 'vendedor_confirmou', 'vendedor_recusou',
    'preparacao_iniciada', 'pronta_para_levantamento',
    'levantamento_confirmado', 'encomenda_concluida', 'cliente_cancelou',
    'codigo_levantamento_gerado', 'codigo_levantamento_regenerado',
    'tentativa_levantamento_falhou'
  ));

revoke all on function public.gerar_otp_levantamento_aleatorio() from public, anon, authenticated;
revoke all on function public.obter_codigo_levantamento_cliente(uuid) from public, anon;
revoke all on function public.validar_codigo_levantamento_vendedor(uuid, text) from public, anon;
revoke all on function public.consultar_estado_codigo_levantamento_admin(uuid) from public, anon;

grant execute on function public.obter_codigo_levantamento_cliente(uuid) to authenticated;
grant execute on function public.validar_codigo_levantamento_vendedor(uuid, text) to authenticated;
grant execute on function public.consultar_estado_codigo_levantamento_admin(uuid) to authenticated;

commit;
