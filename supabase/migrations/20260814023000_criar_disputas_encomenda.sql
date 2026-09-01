-- ANGROLINK — fundação de problemas/disputas de encomenda.
-- Abrir uma disputa não confirma pagamento, não cria reembolso e não cria repasse.

begin;

alter table public.configuracoes_financeiras
  add column if not exists prazo_reclamacao_horas integer not null default 168
  check (prazo_reclamacao_horas >= 0);

update public.configuracoes_financeiras
set prazo_reclamacao_horas = 168,
    atualizado_em = now()
where chave = 'padrao' and ativo = true;

create table public.disputas_encomenda (
  id uuid primary key default gen_random_uuid(),
  encomenda_id uuid not null references public.encomendas(id) on delete restrict,
  pagamento_id uuid references public.pagamentos(id) on delete restrict,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  vendedor_id uuid not null references public.vendedores(id) on delete restrict,
  estado text not null default 'aberta' check (estado in (
    'aberta', 'em_analise', 'resolvida_sem_reembolso',
    'resolvida_reembolso_parcial', 'resolvida_reembolso_total', 'cancelada'
  )),
  tipo_problema text not null check (tipo_problema in (
    'produto_danificado', 'produto_incorreto', 'quantidade_incorreta',
    'qualidade_inadequada', 'produto_em_falta', 'outro'
  )),
  descricao text not null check (char_length(btrim(descricao)) between 3 and 1000),
  valor_reclamado_centimos bigint check (valor_reclamado_centimos is null or valor_reclamado_centimos >= 0),
  decisao text,
  observacao_resolucao text,
  resolvido_em timestamptz,
  resolvido_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint disputas_decisao_apenas_resolvida check (
    (estado in ('resolvida_sem_reembolso', 'resolvida_reembolso_parcial', 'resolvida_reembolso_total')
      and resolvido_em is not null)
    or (estado not in ('resolvida_sem_reembolso', 'resolvida_reembolso_parcial', 'resolvida_reembolso_total')
      and resolvido_em is null)
  )
);

create index disputas_encomenda_cliente_criado_idx
  on public.disputas_encomenda (cliente_id, criado_em desc);
create index disputas_encomenda_vendedor_criado_idx
  on public.disputas_encomenda (vendedor_id, criado_em desc);
create unique index disputas_encomenda_uma_ativa_por_encomenda_idx
  on public.disputas_encomenda (encomenda_id)
  where estado in ('aberta', 'em_analise');

create trigger atualizar_disputa_encomenda_em
before update on public.disputas_encomenda
for each row execute function public.atualizar_atualizado_em_financeiro();

-- Fonte central para a futura liberação de repasses. Não é exposta ao cliente.
create or replace function public.encomenda_tem_disputa_ativa(p_encomenda_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.disputas_encomenda d
    where d.encomenda_id = p_encomenda_id
      and d.estado in ('aberta', 'em_analise')
  );
$$;

-- A interface já desativa a confirmação de receção, mas a regra deve existir
-- também no servidor para que uma chamada direta à RPC não conclua a encomenda.
create or replace function public.bloquear_conclusao_com_disputa_ativa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.estado = 'levantada'
    and new.estado = 'concluida'
    and public.encomenda_tem_disputa_ativa(old.id) then
    raise exception 'A encomenda possui um problema em análise e não pode ser concluída.';
  end if;
  return new;
end;
$$;

create trigger bloquear_conclusao_encomenda_com_disputa
before update of estado on public.encomendas
for each row execute function public.bloquear_conclusao_com_disputa_ativa();

create or replace function public.abrir_disputa_encomenda(
  p_encomenda_id uuid,
  p_tipo_problema text,
  p_descricao text,
  p_valor_reclamado_centimos bigint default null
)
returns public.disputas_encomenda
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encomenda public.encomendas%rowtype;
  v_pagamento_id uuid;
  v_config public.configuracoes_financeiras%rowtype;
  v_tipo text := lower(btrim(coalesce(p_tipo_problema, '')));
  v_descricao text := nullif(btrim(p_descricao), '');
  v_disputa public.disputas_encomenda%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão para reportar um problema.';
  end if;
  if v_tipo not in ('produto_danificado', 'produto_incorreto', 'quantidade_incorreta', 'qualidade_inadequada', 'produto_em_falta', 'outro') then
    raise exception 'Indique um tipo de problema válido.';
  end if;
  if v_descricao is null or char_length(v_descricao) < 3 or char_length(v_descricao) > 1000 then
    raise exception 'Descreva o problema entre 3 e 1000 caracteres.';
  end if;
  if p_valor_reclamado_centimos is not null and p_valor_reclamado_centimos < 0 then
    raise exception 'O valor reclamado não pode ser negativo.';
  end if;

  select * into v_encomenda
  from public.encomendas
  where id = p_encomenda_id and cliente_id = auth.uid()
  for update;
  if not found then
    raise exception 'Encomenda não encontrada ou sem permissão para reportar um problema.';
  end if;

  if v_encomenda.estado = 'levantada' then
    null;
  elsif v_encomenda.estado = 'concluida' then
    select * into v_config from public.configuracoes_financeiras
    where chave = 'padrao' and ativo = true
    for share;
    if not found then
      raise exception 'A configuração de reclamações não está disponível.';
    end if;
    if v_encomenda.concluido_em is null
      or now() > v_encomenda.concluido_em + make_interval(hours => v_config.prazo_reclamacao_horas) then
      raise exception 'O prazo para reportar problema nesta encomenda terminou.';
    end if;
  else
    raise exception 'Só é possível reportar problema após o levantamento da encomenda.';
  end if;

  select p.id into v_pagamento_id
  from public.pagamentos p
  where p.encomenda_id = v_encomenda.id;

  begin
    insert into public.disputas_encomenda (
      encomenda_id, pagamento_id, cliente_id, vendedor_id,
      tipo_problema, descricao, valor_reclamado_centimos
    ) values (
      v_encomenda.id, v_pagamento_id, v_encomenda.cliente_id, v_encomenda.vendedor_id,
      v_tipo, v_descricao, p_valor_reclamado_centimos
    ) returning * into v_disputa;
  exception when unique_violation then
    raise exception 'Já existe um problema em análise para esta encomenda.';
  end;

  insert into public.eventos_encomenda (
    encomenda_id, tipo_evento, estado_anterior, estado_novo,
    ator_tipo, utilizador_id, metadados
  ) values (
    v_encomenda.id, 'problema_reportado', v_encomenda.estado, v_encomenda.estado,
    'cliente', auth.uid(), jsonb_build_object('tipo_problema', v_disputa.tipo_problema)
  );

  return v_disputa;
end;
$$;

alter table public.eventos_encomenda
  drop constraint if exists eventos_encomenda_tipo_evento_check;
alter table public.eventos_encomenda
  add constraint eventos_encomenda_tipo_evento_check check (tipo_evento in (
    'encomenda_criada', 'vendedor_confirmou', 'vendedor_recusou',
    'preparacao_iniciada', 'pronta_para_levantamento',
    'levantamento_confirmado', 'encomenda_concluida', 'cliente_cancelou',
    'codigo_levantamento_gerado', 'codigo_levantamento_regenerado',
    'tentativa_levantamento_falhou', 'problema_reportado'
  ));

alter table public.disputas_encomenda enable row level security;
create policy disputas_encomenda_leitura_cliente
on public.disputas_encomenda for select to authenticated
using (cliente_id = auth.uid());
create policy disputas_encomenda_leitura_vendedor
on public.disputas_encomenda for select to authenticated
using (exists (
  select 1 from public.vendedores v
  where v.id = disputas_encomenda.vendedor_id and v.user_id = auth.uid()
));

revoke all on table public.disputas_encomenda from public, anon, authenticated;
grant select on table public.disputas_encomenda to authenticated;
revoke all on function public.encomenda_tem_disputa_ativa(uuid) from public, anon, authenticated;
revoke all on function public.bloquear_conclusao_com_disputa_ativa() from public, anon, authenticated;
revoke all on function public.abrir_disputa_encomenda(uuid, text, text, bigint) from public, anon;
grant execute on function public.abrir_disputa_encomenda(uuid, text, text, bigint) to authenticated;

commit;
