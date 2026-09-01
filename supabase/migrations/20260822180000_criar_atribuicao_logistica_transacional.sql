-- ANGROLINK — atribuição logística transacional V1.
-- Regista a responsabilidade administrativa sem implementar aceite, recusa,
-- cancelamento, reatribuição, tracking, tarifa ou pagamento ao entregador.

begin;

create table public.atribuicoes_entrega_encomenda (
  id uuid primary key default gen_random_uuid(),
  encomenda_id uuid not null references public.encomendas(id) on delete restrict,
  parceiro_entrega_id uuid not null references public.parceiros_entrega(id) on delete restrict,
  veiculo_id uuid not null references public.veiculos_entrega(id) on delete restrict,
  estado text not null default 'atribuida' check (estado in (
    'atribuida', 'aceite', 'recusada', 'cancelada', 'concluida'
  )),
  atribuido_em timestamptz not null default now(),
  atribuido_por uuid not null references auth.users(id) on delete restrict,
  aceite_em timestamptz,
  recusado_em timestamptz,
  cancelado_em timestamptz,
  concluido_em timestamptz,
  motivo_recusa text,
  motivo_cancelamento text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint atribuicao_entrega_marcos_consistentes check (
    (estado <> 'aceite' or aceite_em is not null)
    and (estado <> 'recusada' or recusado_em is not null)
    and (estado <> 'cancelada' or cancelado_em is not null)
    and (estado <> 'concluida' or concluido_em is not null)
  )
);

comment on table public.atribuicoes_entrega_encomenda is
  'Histórico transacional de atribuições de entrega. V1 cria apenas atribuições administrativas; transições futuras terão RPCs próprias.';

create unique index atribuicoes_entrega_uma_ativa_por_encomenda_idx
  on public.atribuicoes_entrega_encomenda (encomenda_id)
  where estado in ('atribuida', 'aceite');

create index atribuicoes_entrega_parceiro_criado_idx
  on public.atribuicoes_entrega_encomenda (parceiro_entrega_id, criado_em desc);

create index atribuicoes_entrega_veiculo_criado_idx
  on public.atribuicoes_entrega_encomenda (veiculo_id, criado_em desc);

create or replace function public.atualizar_atualizado_em_atribuicao_entrega()
returns trigger language plpgsql set search_path = public as $$
begin new.atualizado_em = now(); return new; end;
$$;

create trigger atualizar_atribuicao_entrega_em
before update on public.atribuicoes_entrega_encomenda
for each row execute function public.atualizar_atualizado_em_atribuicao_entrega();

-- Mesmo futuras RPCs não podem ligar um veículo ao parceiro errado.
create or replace function public.validar_veiculo_da_atribuicao_entrega()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1 from public.veiculos_entrega v
    where v.id = new.veiculo_id and v.parceiro_id = new.parceiro_entrega_id
  ) then
    raise exception 'O veículo indicado não pertence ao parceiro de entrega.';
  end if;
  return new;
end;
$$;

create trigger validar_veiculo_atribuicao_entrega
before insert or update of parceiro_entrega_id, veiculo_id
on public.atribuicoes_entrega_encomenda
for each row execute function public.validar_veiculo_da_atribuicao_entrega();

-- O evento de atribuição pertence à linha do tempo imutável da encomenda.
alter table public.eventos_encomenda
  drop constraint if exists eventos_encomenda_tipo_evento_check;
alter table public.eventos_encomenda
  add constraint eventos_encomenda_tipo_evento_check check (tipo_evento in (
    'encomenda_criada', 'vendedor_confirmou', 'vendedor_recusou',
    'preparacao_iniciada', 'pronta_para_levantamento',
    'levantamento_confirmado', 'encomenda_concluida', 'cliente_cancelou',
    'codigo_levantamento_gerado', 'codigo_levantamento_regenerado',
    'tentativa_levantamento_falhou', 'problema_reportado',
    'entregador_atribuido'
  ));

alter table public.atribuicoes_entrega_encomenda enable row level security;

create policy atribuicoes_entrega_leitura_admin_ou_parceiro
on public.atribuicoes_entrega_encomenda for select to authenticated
using (
  public.eh_admin()
  or exists (
    select 1 from public.parceiros_entrega p
    where p.id = parceiro_entrega_id and p.user_id = auth.uid()
  )
);

revoke all on table public.atribuicoes_entrega_encomenda from public, anon, authenticated;
grant select on table public.atribuicoes_entrega_encomenda to authenticated;

create or replace function public.atribuir_entregador_encomenda(
  p_encomenda_id uuid,
  p_parceiro_id uuid,
  p_veiculo_id uuid
)
returns public.atribuicoes_entrega_encomenda
language plpgsql security definer set search_path = public
as $$
declare
  v_encomenda public.encomendas%rowtype;
  v_veiculo public.veiculos_entrega%rowtype;
  v_atribuicao public.atribuicoes_entrega_encomenda%rowtype;
  v_estado text;
  v_motivos text[];
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  -- Serializa atribuições concorrentes por encomenda.
  select * into v_encomenda from public.encomendas where id = p_encomenda_id for update;
  if not found then raise exception 'Encomenda não encontrada.'; end if;
  if v_encomenda.modalidade_recebimento <> 'entrega' then
    raise exception 'Apenas encomendas com entrega podem receber um entregador.';
  end if;
  if exists (
    select 1 from public.atribuicoes_entrega_encomenda a
    where a.encomenda_id = p_encomenda_id and a.estado in ('atribuida', 'aceite')
  ) then
    raise exception 'Esta encomenda já possui uma atribuição ativa.';
  end if;

  select * into v_veiculo from public.veiculos_entrega
  where id = p_veiculo_id and parceiro_id = p_parceiro_id for update;
  if not found then raise exception 'O veículo indicado não pertence ao parceiro de entrega.'; end if;
  if not public.entregador_pode_receber_entregas(p_parceiro_id) then
    raise exception 'O parceiro de entrega já não está elegível para receber entregas.';
  end if;
  if not public.veiculo_operacional_para_entregas(p_veiculo_id) then
    raise exception 'O veículo já não está operacional para entregas.';
  end if;

  select c.estado, c.motivos into v_estado, v_motivos
  from public.avaliar_compatibilidade_veiculo_encomenda(p_veiculo_id, p_encomenda_id) c;
  if v_estado is distinct from 'compativel' then
    raise exception 'O veículo deixou de ser compatível com esta encomenda: %.',
      coalesce(array_to_string(v_motivos, ', '), 'sem motivo disponível');
  end if;

  insert into public.atribuicoes_entrega_encomenda (
    encomenda_id, parceiro_entrega_id, veiculo_id, estado, atribuido_por
  ) values (p_encomenda_id, p_parceiro_id, p_veiculo_id, 'atribuida', auth.uid())
  returning * into v_atribuicao;

  insert into public.eventos_encomenda (
    encomenda_id, tipo_evento, estado_anterior, estado_novo,
    ator_tipo, utilizador_id, metadados
  ) values (
    p_encomenda_id, 'entregador_atribuido', v_encomenda.estado, v_encomenda.estado,
    'admin', auth.uid(), jsonb_build_object(
      'atribuicao_id', v_atribuicao.id,
      'parceiro_entrega_id', p_parceiro_id,
      'veiculo_id', p_veiculo_id
    )
  );
  return v_atribuicao;
end;
$$;

create or replace function public.obter_atribuicao_entrega_encomenda_admin(
  p_encomenda_id uuid
)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_resultado jsonb;
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;
  if not exists (select 1 from public.encomendas where id = p_encomenda_id) then
    raise exception 'Encomenda não encontrada.';
  end if;
  select jsonb_build_object(
    'id', a.id, 'estado', a.estado, 'atribuido_em', a.atribuido_em,
    'parceiro_id', p.id, 'parceiro_nome', p.nome_completo,
    'veiculo_id', v.id, 'veiculo_tipo', v.tipo_veiculo, 'matricula', v.matricula,
    'atribuido_por', a.atribuido_por, 'admin_nome', pr.nome
  ) into v_resultado
  from public.atribuicoes_entrega_encomenda a
  join public.parceiros_entrega p on p.id = a.parceiro_entrega_id
  join public.veiculos_entrega v on v.id = a.veiculo_id
  left join public.profiles pr on pr.id = a.atribuido_por
  where a.encomenda_id = p_encomenda_id and a.estado in ('atribuida', 'aceite')
  order by a.atribuido_em desc limit 1;
  return coalesce(v_resultado, jsonb_build_object('estado', 'nao_atribuido'));
end;
$$;

revoke all on function public.atribuir_entregador_encomenda(uuid, uuid, uuid) from public, anon;
revoke all on function public.obter_atribuicao_entrega_encomenda_admin(uuid) from public, anon;
grant execute on function public.atribuir_entregador_encomenda(uuid, uuid, uuid) to authenticated;
grant execute on function public.obter_atribuicao_entrega_encomenda_admin(uuid) to authenticated;

commit;
