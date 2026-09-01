-- ANGROLINK — fecho operacional de entregas para o piloto.
-- Complementa a recolha bilateral: chegada ao destino, OTP presencial,
-- confirmação controlada de pagamento na entrega e conclusão idempotente.
begin;

-- Infraestrutura independente de idempotência dos checkouts. Não pertence ao
-- Stock V1: guarda apenas a intenção canónica e a encomenda já criada.
create table public.idempotencia_checkout_encomenda (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  modalidade_recebimento text not null check (modalidade_recebimento in ('levantamento', 'entrega')),
  chave_idempotencia uuid not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  encomenda_id uuid references public.encomendas(id) on delete restrict,
  criada_em timestamptz not null default now(),
  concluida_em timestamptz,
  constraint idempotencia_checkout_conclusao_consistente check (
    (encomenda_id is null) = (concluida_em is null)
  ),
  unique (cliente_id, modalidade_recebimento, chave_idempotencia)
);

create index idempotencia_checkout_encomenda_encomenda_idx
  on public.idempotencia_checkout_encomenda (encomenda_id)
  where encomenda_id is not null;

alter table public.idempotencia_checkout_encomenda enable row level security;
revoke all on table public.idempotencia_checkout_encomenda from public, anon, authenticated;

create or replace function public.normalizar_itens_checkout_idempotencia(p_itens jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_item jsonb;
  v_produto_id uuid;
  v_quantidade numeric;
  v_produtos uuid[] := '{}'::uuid[];
  v_normalizados jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Indique pelo menos um produto para a encomenda.';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens) loop
    if coalesce(jsonb_typeof(v_item), '') <> 'object'
      or nullif(btrim(v_item ->> 'produto_id'), '') is null
      or coalesce(jsonb_typeof(v_item -> 'quantidade'), '') <> 'number' then
      raise exception 'Cada item deve indicar produto e quantidade válidos.';
    end if;

    begin
      v_produto_id := (v_item ->> 'produto_id')::uuid;
      v_quantidade := (v_item ->> 'quantidade')::numeric;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Cada item deve indicar produto e quantidade válidos.';
    end;

    if v_quantidade is null or v_quantidade <= 0 or v_quantidade <> trunc(v_quantidade, 3) then
      raise exception 'A quantidade deve ser superior a zero e ter no máximo três casas decimais.';
    end if;
    if v_produto_id = any(v_produtos) then
      raise exception 'Não repita o mesmo produto na encomenda.';
    end if;

    v_produtos := array_append(v_produtos, v_produto_id);
    v_normalizados := v_normalizados || jsonb_build_array(
      jsonb_build_object('produto_id', v_produto_id, 'quantidade', v_quantidade)
    );
  end loop;

  select coalesce(jsonb_agg(item order by (item ->> 'produto_id')::uuid), '[]'::jsonb)
    into v_normalizados
  from jsonb_array_elements(v_normalizados) item;

  return v_normalizados;
end;
$$;

create or replace function public.calcular_hash_intencao_checkout(p_intencao jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(extensions.digest(convert_to(p_intencao::text, 'UTF8'), 'sha256'), 'hex');
$$;

alter table public.encomendas drop constraint if exists encomendas_estado_check;
alter table public.encomendas add constraint encomendas_estado_check check (estado in (
  'aguardando_confirmacao', 'confirmada', 'em_preparacao',
  'pronta_para_levantamento', 'levantada', 'recolhida', 'chegou_destino',
  'concluida', 'recusada', 'cancelada'
));

alter table public.atribuicoes_entrega_encomenda
  add column if not exists chegou_destino_em timestamptz;

alter table public.atribuicoes_entrega_encomenda
  drop constraint if exists atribuicoes_entrega_encomenda_estado_check,
  drop constraint if exists atribuicao_entrega_marcos_consistentes;
alter table public.atribuicoes_entrega_encomenda
  add constraint atribuicoes_entrega_encomenda_estado_check check (estado in (
    'atribuida', 'aceite', 'chegou_origem', 'recolhida', 'chegou_destino',
    'recusada', 'cancelada', 'concluida'
  )),
  add constraint atribuicao_entrega_marcos_consistentes check (
    (estado <> 'aceite' or aceite_em is not null)
    and (estado <> 'chegou_origem' or aceite_em is not null and chegou_origem_em is not null)
    and (estado <> 'recolhida' or aceite_em is not null and chegou_origem_em is not null and recolhida_em is not null)
    and (estado <> 'chegou_destino' or aceite_em is not null and chegou_origem_em is not null and recolhida_em is not null and chegou_destino_em is not null)
    and (estado <> 'recusada' or recusado_em is not null)
    and (estado <> 'cancelada' or cancelado_em is not null)
    and (estado <> 'concluida' or aceite_em is not null and chegou_origem_em is not null and recolhida_em is not null and chegou_destino_em is not null and concluido_em is not null)
  );

drop index if exists public.atribuicoes_entrega_uma_ativa_por_encomenda_idx;
create unique index atribuicoes_entrega_uma_ativa_por_encomenda_idx
  on public.atribuicoes_entrega_encomenda (encomenda_id)
  where estado in ('atribuida', 'aceite', 'chegou_origem', 'recolhida', 'chegou_destino');

alter table public.eventos_encomenda drop constraint if exists eventos_encomenda_tipo_evento_check;
alter table public.eventos_encomenda add constraint eventos_encomenda_tipo_evento_check check (tipo_evento in (
  'encomenda_criada', 'vendedor_confirmou', 'vendedor_recusou', 'preparacao_iniciada',
  'pronta_para_levantamento', 'levantamento_confirmado', 'encomenda_concluida',
  'cliente_cancelou', 'codigo_levantamento_gerado', 'codigo_levantamento_regenerado',
  'tentativa_levantamento_falhou', 'problema_reportado', 'entregador_atribuido',
  'entregador_aceitou', 'entregador_recusou', 'entregador_chegou_origem',
  'encomenda_recolhida', 'entregador_chegou_destino', 'codigo_entrega_gerado',
  'codigo_entrega_regenerado', 'tentativa_entrega_falhou', 'entrega_confirmada'
));

create table public.codigos_entrega (
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
  constraint codigos_entrega_bloqueio_consistente check (bloqueado_em is null or tentativas >= max_tentativas),
  constraint codigos_entrega_uso_consistente check (usado_em is null or usado_em >= criado_em)
);
create index codigos_entrega_expira_em_idx on public.codigos_entrega(expira_em) where usado_em is null;
alter table public.codigos_entrega enable row level security;
revoke all on table public.codigos_entrega from public, anon, authenticated;

create or replace function public.atualizar_atualizado_em_codigo_entrega()
returns trigger language plpgsql set search_path = public as $$
begin new.atualizado_em = now(); return new; end;
$$;
create trigger atualizar_codigo_entrega_em before update on public.codigos_entrega
for each row execute function public.atualizar_atualizado_em_codigo_entrega();

create or replace function public.gerar_otp_entrega_aleatorio()
returns text language plpgsql volatile set search_path = public as $$
declare v_bytes bytea := extensions.gen_random_bytes(4); v_valor bigint;
begin
  v_valor := (get_byte(v_bytes, 0)::bigint << 24) + (get_byte(v_bytes, 1)::bigint << 16) + (get_byte(v_bytes, 2)::bigint << 8) + get_byte(v_bytes, 3)::bigint;
  return lpad((v_valor % 1000000)::text, 6, '0');
end;
$$;

create or replace function public.confirmar_chegada_destino_entregador(p_atribuicao_id uuid)
returns public.atribuicoes_entrega_encomenda
language plpgsql security definer set search_path = public as $$
declare v_atribuicao public.atribuicoes_entrega_encomenda%rowtype; v_encomenda public.encomendas%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select a.* into v_atribuicao from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id where a.id=p_atribuicao_id and p.user_id=auth.uid() for update;
  if not found then raise exception 'Tarefa não encontrada ou sem permissão.'; end if;
  select * into v_encomenda from public.encomendas where id=v_atribuicao.encomenda_id for update;
  if v_atribuicao.estado='chegou_destino' and v_encomenda.estado='chegou_destino' then return v_atribuicao; end if;
  if (v_atribuicao.estado='chegou_destino') <> (v_encomenda.estado='chegou_destino') then raise exception 'Inconsistência de integridade na chegada ao destino.'; end if;
  if v_encomenda.modalidade_recebimento <> 'entrega' or v_atribuicao.estado <> 'recolhida' or v_encomenda.estado <> 'recolhida' then raise exception 'A chegada ao destino não pode ser confirmada no estado atual.'; end if;
  update public.atribuicoes_entrega_encomenda set estado='chegou_destino',chegou_destino_em=now() where id=v_atribuicao.id returning * into v_atribuicao;
  update public.encomendas set estado='chegou_destino' where id=v_encomenda.id;
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(v_encomenda.id,'entregador_chegou_destino','recolhida','chegou_destino','entregador',auth.uid(),jsonb_build_object('atribuicao_id',v_atribuicao.id));
  return v_atribuicao;
end;
$$;

create or replace function public.obter_codigo_entrega_cliente(p_encomenda_id uuid)
returns table(codigo text,expira_em timestamptz,geracoes smallint)
language plpgsql security definer set search_path = public as $$
declare v_encomenda public.encomendas%rowtype; v_codigo public.codigos_entrega%rowtype; v_otp text; v_agora timestamptz:=now(); v_evento text;
begin
  if auth.uid() is null then raise exception 'Sessão inválida. Inicie sessão novamente.'; end if;
  select * into v_encomenda from public.encomendas where id=p_encomenda_id and cliente_id=auth.uid() for update;
  if not found then raise exception 'Encomenda não encontrada ou sem permissão.'; end if;
  if v_encomenda.modalidade_recebimento <> 'entrega' or v_encomenda.estado <> 'chegou_destino' then raise exception 'O código de entrega só está disponível quando o entregador chegar ao destino.'; end if;
  select * into v_codigo from public.codigos_entrega where encomenda_id=v_encomenda.id for update;
  if found then
    if v_codigo.usado_em is not null then raise exception 'O código desta entrega já foi utilizado.'; end if;
    if v_codigo.gerado_em > v_agora - interval '60 seconds' then raise exception 'Aguarde um minuto antes de renovar o código de entrega.'; end if;
    if v_codigo.geracoes >= 3 then raise exception 'Foi atingido o limite de renovações do código de entrega. Contacte o suporte.'; end if;
    v_evento := 'codigo_entrega_regenerado'; v_otp:=public.gerar_otp_entrega_aleatorio();
    update public.codigos_entrega set codigo_hash=extensions.crypt(v_otp,extensions.gen_salt('bf',10)),expira_em=v_agora+interval '15 minutes',tentativas=0,bloqueado_em=null,geracoes=v_codigo.geracoes+1,atualizado_por=auth.uid(),gerado_em=v_agora where id=v_codigo.id returning codigos_entrega.expira_em,codigos_entrega.geracoes into expira_em,geracoes;
  else
    v_evento := 'codigo_entrega_gerado'; v_otp:=public.gerar_otp_entrega_aleatorio();
    insert into public.codigos_entrega(encomenda_id,codigo_hash,expira_em,criado_por,atualizado_por) values(v_encomenda.id,extensions.crypt(v_otp,extensions.gen_salt('bf',10)),v_agora+interval '15 minutes',auth.uid(),auth.uid()) returning codigos_entrega.expira_em,codigos_entrega.geracoes into expira_em,geracoes;
  end if;
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(v_encomenda.id,v_evento,'chegou_destino','chegou_destino','cliente',auth.uid(),jsonb_build_object('validade_segundos',900,'geracoes',geracoes));
  codigo:=v_otp; return next;
end;
$$;

alter table public.eventos_pagamento drop constraint if exists eventos_pagamento_ator_tipo_check;
alter table public.eventos_pagamento add constraint eventos_pagamento_ator_tipo_check check (ator_tipo in ('cliente','vendedor','admin','sistema','provedor','entregador'));

create or replace function public.registar_pagamento_na_entrega_entregador(p_atribuicao_id uuid)
returns public.pagamentos language plpgsql security definer set search_path = public as $$
declare v_atribuicao public.atribuicoes_entrega_encomenda%rowtype; v_encomenda public.encomendas%rowtype; v_pagamento public.pagamentos%rowtype; v_tentativa public.tentativas_pagamento%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select a.* into v_atribuicao from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id where a.id=p_atribuicao_id and p.user_id=auth.uid() for update;
  if not found then raise exception 'Tarefa não encontrada ou sem permissão.'; end if;
  select * into v_encomenda from public.encomendas where id=v_atribuicao.encomenda_id for update;
  if v_encomenda.modalidade_recebimento <> 'entrega' or v_atribuicao.estado not in ('chegou_destino','concluida') or v_encomenda.estado not in ('chegou_destino','concluida') then raise exception 'O pagamento só pode ser registado depois da chegada ao destino.'; end if;
  select * into v_pagamento from public.pagamentos where encomenda_id=v_encomenda.id for update;
  if not found then raise exception 'Pagamento não encontrado.'; end if;
  select * into v_tentativa from public.tentativas_pagamento where pagamento_id=v_pagamento.id and metodo='pagamento_na_entrega' order by criado_em desc,id desc limit 1 for update;
  if not found then raise exception 'Não existe pagamento na entrega pendente para esta encomenda.'; end if;
  if v_pagamento.estado='confirmado' and v_tentativa.estado='confirmada' then return v_pagamento; end if;
  if v_pagamento.estado <> 'pendente' or v_tentativa.estado not in ('criada','pendente') then raise exception 'O pagamento não pode ser confirmado no estado atual.'; end if;
  update public.tentativas_pagamento set estado='confirmada',confirmado_em=now(),metadados=metadados || jsonb_build_object('confirmado_na_entrega_por',auth.uid()) where id=v_tentativa.id;
  update public.pagamentos set estado='confirmado',confirmado_em=now() where id=v_pagamento.id returning * into v_pagamento;
  insert into public.eventos_pagamento(pagamento_id,tentativa_pagamento_id,encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(v_pagamento.id,v_tentativa.id,v_encomenda.id,'pagamento_confirmado','pendente','confirmado','entregador',auth.uid(),jsonb_build_object('metodo','pagamento_na_entrega','atribuicao_id',v_atribuicao.id));
  return v_pagamento;
end;
$$;

create or replace function public.validar_codigo_entrega_entregador(p_atribuicao_id uuid,p_codigo text)
returns table(validado boolean,estado_encomenda text,tentativas_restantes smallint,bloqueado boolean,motivo text)
language plpgsql security definer set search_path = public as $$
declare v_atribuicao public.atribuicoes_entrega_encomenda%rowtype; v_encomenda public.encomendas%rowtype; v_codigo public.codigos_entrega%rowtype; v_pagamento public.pagamentos%rowtype; v_apresentado text:=nullif(btrim(p_codigo),''); v_agora timestamptz:=now(); v_tentativas smallint;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  if v_apresentado is null or v_apresentado !~ '^[0-9]{6}$' then raise exception 'Introduza o código de entrega de seis dígitos.'; end if;
  select a.* into v_atribuicao from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id where a.id=p_atribuicao_id and p.user_id=auth.uid() for update;
  if not found then raise exception 'Tarefa não encontrada ou sem permissão.'; end if;
  select * into v_encomenda from public.encomendas where id=v_atribuicao.encomenda_id for update;
  if v_atribuicao.estado='concluida' and v_encomenda.estado='concluida' then validado:=true;estado_encomenda:='concluida';tentativas_restantes:=0;bloqueado:=false;motivo:=null;return next;return; end if;
  if v_encomenda.modalidade_recebimento <> 'entrega' or v_atribuicao.estado <> 'chegou_destino' or v_encomenda.estado <> 'chegou_destino' then raise exception 'A entrega não pode ser confirmada no estado atual.'; end if;
  select * into v_pagamento from public.pagamentos where encomenda_id=v_encomenda.id for update;
  if not found or v_pagamento.estado <> 'confirmado' then raise exception 'Registe primeiro o pagamento aplicável antes de confirmar a entrega.'; end if;
  select * into v_codigo from public.codigos_entrega where encomenda_id=v_encomenda.id for update;
  if not found then validado:=false;estado_encomenda:=v_encomenda.estado;tentativas_restantes:=0;bloqueado:=false;motivo:='O comprador ainda não gerou um código de entrega.';return next;return; end if;
  if v_codigo.usado_em is not null or v_codigo.bloqueado_em is not null or v_codigo.expira_em <= v_agora then validado:=false;estado_encomenda:=v_encomenda.estado;tentativas_restantes:=greatest(v_codigo.max_tentativas-v_codigo.tentativas,0);bloqueado:=v_codigo.bloqueado_em is not null;motivo:=case when v_codigo.usado_em is not null then 'Este código de entrega já foi utilizado.' when v_codigo.bloqueado_em is not null then 'Este código de entrega está bloqueado. O comprador deve renová-lo.' else 'Este código de entrega expirou. O comprador deve renová-lo.' end;return next;return; end if;
  if extensions.crypt(v_apresentado,v_codigo.codigo_hash) <> v_codigo.codigo_hash then
    v_tentativas:=v_codigo.tentativas+1; update public.codigos_entrega set tentativas=v_tentativas,bloqueado_em=case when v_tentativas>=v_codigo.max_tentativas then v_agora else null end,atualizado_por=auth.uid() where id=v_codigo.id;
    insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(v_encomenda.id,'tentativa_entrega_falhou','chegou_destino','chegou_destino','entregador',auth.uid(),jsonb_build_object('atribuicao_id',v_atribuicao.id,'tentativas',v_tentativas));
    validado:=false;estado_encomenda:=v_encomenda.estado;tentativas_restantes:=greatest(v_codigo.max_tentativas-v_tentativas,0);bloqueado:=v_tentativas>=v_codigo.max_tentativas;motivo:=case when v_tentativas>=v_codigo.max_tentativas then 'Este código de entrega ficou bloqueado. O comprador deve renová-lo.' else 'Código de entrega inválido.' end;return next;return;
  end if;
  update public.codigos_entrega set usado_em=v_agora,atualizado_por=auth.uid() where id=v_codigo.id;
  update public.atribuicoes_entrega_encomenda set estado='concluida',concluido_em=v_agora where id=v_atribuicao.id;
  update public.encomendas set estado='concluida',concluido_em=v_agora where id=v_encomenda.id;
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(v_encomenda.id,'entrega_confirmada','chegou_destino','concluida','entregador',auth.uid(),jsonb_build_object('atribuicao_id',v_atribuicao.id));
  validado:=true;estado_encomenda:='concluida';tentativas_restantes:=v_codigo.max_tentativas-v_codigo.tentativas;bloqueado:=false;motivo:=null;return next;
end;
$$;

create or replace function public.obter_entrega_encomenda_participante(p_encomenda_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e public.encomendas%rowtype; a public.atribuicoes_entrega_encomenda%rowtype; vendedor boolean:=false;
begin
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 select * into e from public.encomendas where id=p_encomenda_id; if not found then raise exception 'Encomenda não encontrada.'; end if;
 select exists(select 1 from public.vendedores v where v.id=e.vendedor_id and v.user_id=auth.uid()) into vendedor;
 if e.cliente_id<>auth.uid() and not vendedor then raise exception 'Sem permissão para consultar a entrega.'; end if;
 if e.modalidade_recebimento<>'entrega' then return jsonb_build_object('estado','nao_aplicavel'); end if;
 select * into a from public.atribuicoes_entrega_encomenda where encomenda_id=e.id order by atribuido_em desc,id desc limit 1; if not found then return jsonb_build_object('estado','nao_atribuido'); end if;
 if a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then return (select jsonb_build_object('atribuicao_id',a2.id,'estado',a2.estado,'atribuido_em',a2.atribuido_em,'aceite_em',a2.aceite_em,'chegou_origem_em',a2.chegou_origem_em,'recolhida_em',a2.recolhida_em,'chegou_destino_em',a2.chegou_destino_em,'concluido_em',a2.concluido_em,'parceiro_entrega_id',p.id,'nome_entregador',p.nome_completo,'veiculo',jsonb_build_object('tipo_veiculo',v.tipo_veiculo,'marca',v.marca,'modelo',v.modelo,'matricula',v.matricula)) from public.atribuicoes_entrega_encomenda a2 join public.parceiros_entrega p on p.id=a2.parceiro_entrega_id join public.veiculos_entrega v on v.id=a2.veiculo_id where a2.id=a.id); end if;
 return jsonb_build_object('atribuicao_id',a.id,'estado',a.estado,'atribuido_em',a.atribuido_em,'recusado_em',a.recusado_em,'motivo_recusa',case when vendedor and a.estado='recusada' then a.motivo_recusa else null end);
end;
$$;

create or replace function public.obter_tarefa_entregador(p_atribuicao_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare resultado jsonb;
begin
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 select jsonb_build_object(
  'tarefa',jsonb_build_object('id',a.id,'estado',a.estado,'atribuido_em',a.atribuido_em,'aceite_em',a.aceite_em,'chegou_origem_em',a.chegou_origem_em,'recolhida_em',a.recolhida_em,'chegou_destino_em',a.chegou_destino_em,'concluido_em',a.concluido_em,'recusado_em',a.recusado_em,'motivo_recusa',a.motivo_recusa),
  'encomenda',jsonb_build_object('id',e.id,'codigo_publico',e.codigo_publico,'estado',e.estado,'modalidade',e.modalidade_recebimento),
  'veiculo',jsonb_build_object('tipo',v.tipo_veiculo,'matricula',v.matricula),
  'origem',jsonb_build_object('nome_vendedor',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then ven.nome_comercial end,'telefone',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then coalesce(ven.telefone_whatsapp,ven.whatsapp) end,'provincia',e.provincia,'municipio',e.municipio,'bairro',e.bairro,'endereco',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then e.endereco_levantamento end,'referencia',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then e.ponto_referencia end),
  'destino',jsonb_build_object('nome',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then d.destinatario_nome end,'telefone',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then d.destinatario_telefone end,'provincia',d.provincia,'municipio',d.municipio,'bairro',d.bairro,'endereco',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then d.endereco_detalhado end,'referencia',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then d.ponto_referencia end,'instrucoes',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then d.instrucoes_entrega end),
  'itens',coalesce((select jsonb_agg(jsonb_build_object('nome',i.nome_produto_snapshot,'quantidade',i.quantidade,'unidade',i.unidade) order by i.criado_em,i.id) from public.itens_encomenda i where i.encomenda_id=e.id),'[]'::jsonb),
  'requisitos_logisticos',coalesce((select jsonb_build_object('peso_total_kg',r.peso_total_kg,'peso_total_conhecido',r.peso_total_conhecido,'volume_total_m3',r.volume_total_m3,'volume_total_conhecido',r.volume_total_conhecido,'requer_refrigeracao',r.requer_refrigeracao,'requer_caixa_carga',r.requer_caixa_carga,'requer_paletes',r.requer_paletes) from public.calcular_requisitos_logisticos_encomenda(e.id) r),'{}'::jsonb),
  'pagamento',coalesce((select jsonb_build_object('metodo',t.metodo,'estado',p.estado) from public.pagamentos p join public.tentativas_pagamento t on t.pagamento_id=p.id where p.encomenda_id=e.id and t.metodo='pagamento_na_entrega' order by t.criado_em desc,t.id desc limit 1),'{}'::jsonb)
 ) into resultado from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega parceiro on parceiro.id=a.parceiro_entrega_id join public.encomendas e on e.id=a.encomenda_id join public.vendedores ven on ven.id=e.vendedor_id join public.veiculos_entrega v on v.id=a.veiculo_id left join public.enderecos_entrega_encomenda d on d.encomenda_id=e.id where a.id=p_atribuicao_id and parceiro.user_id=auth.uid();
 if resultado is null then raise exception 'Tarefa não encontrada ou sem permissão.'; end if;
 return resultado;
end;
$$;

create or replace function public.notificar_ciclo_entrega_fase_1()
returns trigger language plpgsql security definer set search_path=public as $$
declare e public.encomendas%rowtype; destino uuid; atribuicao uuid; url_compra text; url_venda text;
begin
 begin
  select * into e from public.encomendas where id=new.encomenda_id; if not found then return new; end if;
  select case when exists(select 1 from public.vendedores v where v.user_id=e.cliente_id) then '/dashboard/compras/'||e.id else '/dashboard/encomendas/'||e.id end into url_compra; url_venda:='/dashboard/encomendas/'||e.id; atribuicao:=nullif(new.metadados->>'atribuicao_id','')::uuid;
  if new.tipo_evento='entregador_chegou_origem' then select user_id into destino from public.vendedores where id=e.vendedor_id; if destino is not null then perform public.criar_notificacao(destino,'venda','entregador_chegou_origem','Entregador chegou para recolha','O entregador chegou para recolher esta encomenda.','encomenda',e.id,url_venda,'{}'::jsonb,'encomenda:'||new.id||':vendedor'); end if;
  elsif new.tipo_evento='encomenda_recolhida' then if e.cliente_id is not null then perform public.criar_notificacao(e.cliente_id,'compra','encomenda_recolhida','Encomenda em transporte','A tua encomenda foi recolhida e está a caminho do destino.','encomenda',e.id,url_compra,'{}'::jsonb,'encomenda:'||new.id||':cliente'); end if; select user_id into destino from public.vendedores where id=e.vendedor_id; if destino is not null then perform public.criar_notificacao(destino,'venda','encomenda_recolhida','Encomenda em transporte','A encomenda foi entregue ao transportador.','encomenda',e.id,url_venda,'{}'::jsonb,'encomenda:'||new.id||':vendedor'); end if; select p.user_id into destino from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id where a.id=atribuicao; if destino is not null then perform public.criar_notificacao(destino,'entrega','encomenda_recolhida','Recolha confirmada','O vendedor confirmou a entrega da encomenda.','atribuicao_entrega',atribuicao,'/dashboard/tarefas/'||atribuicao,'{}'::jsonb,'encomenda:'||new.id||':entregador'); end if;
  elsif new.tipo_evento='entregador_chegou_destino' then if e.cliente_id is not null then perform public.criar_notificacao(e.cliente_id,'compra','entregador_chegou_destino','Entregador chegou ao destino','O entregador chegou ao destino com a tua encomenda.','encomenda',e.id,url_compra,'{}'::jsonb,'encomenda:'||new.id||':cliente'); end if; select user_id into destino from public.vendedores where id=e.vendedor_id; if destino is not null then perform public.criar_notificacao(destino,'venda','entregador_chegou_destino','Entregador chegou ao destino','O entregador chegou ao destino da encomenda.','encomenda',e.id,url_venda,'{}'::jsonb,'encomenda:'||new.id||':vendedor'); end if;
  elsif new.tipo_evento='entrega_confirmada' then if e.cliente_id is not null then perform public.criar_notificacao(e.cliente_id,'compra','entrega_confirmada','Encomenda entregue','A tua encomenda foi entregue com sucesso.','encomenda',e.id,url_compra,'{}'::jsonb,'encomenda:'||new.id||':cliente'); end if; select user_id into destino from public.vendedores where id=e.vendedor_id; if destino is not null then perform public.criar_notificacao(destino,'venda','entrega_confirmada','Encomenda entregue','A encomenda foi entregue ao comprador.','encomenda',e.id,url_venda,'{}'::jsonb,'encomenda:'||new.id||':vendedor'); end if; select p.user_id into destino from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id where a.id=atribuicao; if destino is not null then perform public.criar_notificacao(destino,'entrega','entrega_confirmada','Entrega concluída','A entrega foi concluída com sucesso.','atribuicao_entrega',atribuicao,'/dashboard/tarefas/'||atribuicao,'{}'::jsonb,'encomenda:'||new.id||':entregador'); end if;
  end if;
 exception when others then raise warning 'Não foi possível criar a notificação do evento %: %',new.id,sqlerrm; end;
 return new;
end;
$$;
drop trigger if exists criar_notificacao_recolha_entrega_fase_2 on public.eventos_encomenda;
create trigger criar_notificacao_ciclo_entrega_fase_1 after insert on public.eventos_encomenda for each row when (new.tipo_evento in ('entregador_chegou_origem','encomenda_recolhida','entregador_chegou_destino','entrega_confirmada')) execute function public.notificar_ciclo_entrega_fase_1();

-- As sobrecargas novas preservam as RPCs aplicadas de 5/10 parâmetros. As
-- chamadas modernas usam a chave do checkout para proteger retries perdidos.
create function public.criar_encomenda_levantamento(
  p_itens jsonb,
  p_modalidade text,
  p_nome_destinatario text,
  p_telefone_destinatario text,
  p_observacoes_cliente text,
  p_idempotency_key uuid
)
returns public.encomendas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_itens jsonb;
  v_hash text;
  v_registo public.idempotencia_checkout_encomenda%rowtype;
  v_encomenda public.encomendas%rowtype;
  v_pagamento_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão antes de criar a encomenda.';
  end if;
  if p_idempotency_key is null then
    raise exception 'Não foi possível identificar esta tentativa de encomenda. Tente novamente.';
  end if;
  if coalesce(btrim(p_modalidade), '') <> 'levantamento' then
    raise exception 'A entrega ainda não está disponível. Escolha levantamento no local.';
  end if;

  v_itens := public.normalizar_itens_checkout_idempotencia(p_itens);
  v_hash := public.calcular_hash_intencao_checkout(jsonb_build_object(
    'modalidade_recebimento', 'levantamento',
    'itens', v_itens,
    'destinatario_nome', nullif(btrim(p_nome_destinatario), ''),
    'destinatario_telefone', nullif(btrim(p_telefone_destinatario), ''),
    'observacoes_cliente', nullif(btrim(p_observacoes_cliente), '')
  ));

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':levantamento:' || p_idempotency_key::text, 0));
  select * into v_registo
  from public.idempotencia_checkout_encomenda
  where cliente_id = auth.uid()
    and modalidade_recebimento = 'levantamento'
    and chave_idempotencia = p_idempotency_key
  for update;

  if found then
    if v_registo.payload_hash <> v_hash then
      raise exception 'Esta chave de idempotência já foi usada com dados diferentes.';
    end if;
    if v_registo.encomenda_id is null then
      raise exception 'Esta tentativa de encomenda ainda está a ser processada. Tente novamente.';
    end if;
    select * into v_encomenda from public.encomendas where id = v_registo.encomenda_id;
    if not found then
      raise exception 'Não foi possível recuperar a encomenda desta tentativa.';
    end if;
    return v_encomenda;
  end if;

  perform public.garantir_perfil_comprador();
  insert into public.idempotencia_checkout_encomenda (
    cliente_id, modalidade_recebimento, chave_idempotencia, payload_hash
  ) values (auth.uid(), 'levantamento', p_idempotency_key, v_hash);

  -- A implementação aplicada continua a ser a fonte de verdade para catálogo,
  -- preço, vendedor elegível, itens e evento comercial.
  v_encomenda := public.criar_encomenda_levantamento(
    p_itens,
    p_modalidade,
    p_nome_destinatario,
    p_telefone_destinatario,
    p_observacoes_cliente
  );

  perform public.criar_pagamento_encomenda(v_encomenda.id, gen_random_uuid());
  select id into v_pagamento_id from public.pagamentos where encomenda_id = v_encomenda.id for update;
  if v_pagamento_id is null then
    raise exception 'Não foi possível preparar o pagamento desta encomenda.';
  end if;
  perform public.criar_tentativa_pagamento(v_pagamento_id, 'pagamento_no_levantamento', gen_random_uuid());

  update public.idempotencia_checkout_encomenda
  set encomenda_id = v_encomenda.id, concluida_em = now()
  where cliente_id = auth.uid()
    and modalidade_recebimento = 'levantamento'
    and chave_idempotencia = p_idempotency_key;

  return v_encomenda;
end;
$$;

create function public.criar_encomenda_entrega(
  p_itens jsonb,
  p_destinatario_nome text,
  p_destinatario_telefone text,
  p_provincia text,
  p_municipio text,
  p_bairro text,
  p_endereco_detalhado text,
  p_ponto_referencia text,
  p_instrucoes_entrega text,
  p_observacoes text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_itens jsonb;
  v_hash text;
  v_registo public.idempotencia_checkout_encomenda%rowtype;
  v_resultado jsonb;
  v_encomenda public.encomendas%rowtype;
  v_pagamento public.pagamentos%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão antes de criar a encomenda.';
  end if;
  if p_idempotency_key is null then
    raise exception 'Não foi possível identificar esta tentativa de encomenda. Tente novamente.';
  end if;

  v_itens := public.normalizar_itens_checkout_idempotencia(p_itens);
  v_hash := public.calcular_hash_intencao_checkout(jsonb_build_object(
    'modalidade_recebimento', 'entrega',
    'itens', v_itens,
    'destinatario_nome', nullif(btrim(p_destinatario_nome), ''),
    'destinatario_telefone', nullif(btrim(p_destinatario_telefone), ''),
    'provincia', nullif(btrim(p_provincia), ''),
    'municipio', nullif(btrim(p_municipio), ''),
    'bairro', nullif(btrim(p_bairro), ''),
    'endereco_detalhado', nullif(btrim(p_endereco_detalhado), ''),
    'ponto_referencia', nullif(btrim(p_ponto_referencia), ''),
    'instrucoes_entrega', nullif(btrim(p_instrucoes_entrega), ''),
    'observacoes_cliente', nullif(btrim(p_observacoes), '')
  ));

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':entrega:' || p_idempotency_key::text, 0));
  select * into v_registo
  from public.idempotencia_checkout_encomenda
  where cliente_id = auth.uid()
    and modalidade_recebimento = 'entrega'
    and chave_idempotencia = p_idempotency_key
  for update;

  if found then
    if v_registo.payload_hash <> v_hash then
      raise exception 'Esta chave de idempotência já foi usada com dados diferentes.';
    end if;
    if v_registo.encomenda_id is null then
      raise exception 'Esta tentativa de encomenda ainda está a ser processada. Tente novamente.';
    end if;
    select * into v_encomenda from public.encomendas where id = v_registo.encomenda_id;
    select * into v_pagamento from public.pagamentos where encomenda_id = v_registo.encomenda_id;
    if not found or v_encomenda.id is null then
      raise exception 'Não foi possível recuperar a encomenda desta tentativa.';
    end if;
    return jsonb_build_object(
      'id', v_encomenda.id,
      'codigo_publico', v_encomenda.codigo_publico,
      'total_centimos', v_encomenda.total_centimos,
      'vendedor_id', v_encomenda.vendedor_id,
      'pagamento_id', v_pagamento.id,
      'estado_pagamento', v_pagamento.estado
    );
  end if;

  perform public.garantir_perfil_comprador();
  insert into public.idempotencia_checkout_encomenda (
    cliente_id, modalidade_recebimento, chave_idempotencia, payload_hash
  ) values (auth.uid(), 'entrega', p_idempotency_key, v_hash);

  v_resultado := public.criar_encomenda_entrega(
    p_itens,
    p_destinatario_nome,
    p_destinatario_telefone,
    p_provincia,
    p_municipio,
    p_bairro,
    p_endereco_detalhado,
    p_ponto_referencia,
    p_instrucoes_entrega,
    p_observacoes
  );

  update public.idempotencia_checkout_encomenda
  set encomenda_id = (v_resultado ->> 'id')::uuid, concluida_em = now()
  where cliente_id = auth.uid()
    and modalidade_recebimento = 'entrega'
    and chave_idempotencia = p_idempotency_key;

  return v_resultado;
end;
$$;

-- No levantamento presencial, a confirmação do OTP é o marco único: confirma
-- o pagamento ao vendedor, o levantamento físico e o encerramento comercial.
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
  v_pagamento public.pagamentos%rowtype;
  v_tentativa public.tentativas_pagamento%rowtype;
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
    select 1 from public.vendedores v
    where v.id = v_encomenda.vendedor_id
      and v.user_id = auth.uid()
      and public.vendedor_pode_receber_encomendas(v.id)
  ) then
    raise exception 'Sem permissão para validar o levantamento desta encomenda.';
  end if;

  select * into v_codigo
  from public.codigos_levantamento
  where encomenda_id = v_encomenda.id
  for update;
  if not found then
    validado := false; estado_encomenda := v_encomenda.estado;
    tentativas_restantes := 0; bloqueado := false;
    motivo := 'Não existe código de levantamento ativo para esta encomenda.';
    return next; return;
  end if;

  select * into v_pagamento
  from public.pagamentos
  where encomenda_id = v_encomenda.id
  for update;

  -- Retry seguro: só reconhece como sucesso a repetição do mesmo OTP depois
  -- de todos os efeitos autoritativos já terem sido concluídos.
  if v_encomenda.estado = 'concluida'
    and v_codigo.usado_em is not null
    and found
    and v_pagamento.estado = 'confirmado' then
    if extensions.crypt(v_codigo_apresentado, v_codigo.codigo_hash) = v_codigo.codigo_hash then
      validado := true; estado_encomenda := 'concluida';
      tentativas_restantes := greatest(v_codigo.max_tentativas - v_codigo.tentativas, 0)::smallint;
      bloqueado := false; motivo := null;
      return next; return;
    end if;
    validado := false; estado_encomenda := 'concluida';
    tentativas_restantes := 0; bloqueado := false;
    motivo := 'Este código de levantamento já foi utilizado.';
    return next; return;
  end if;

  if v_encomenda.estado <> 'pronta_para_levantamento' then
    raise exception 'Esta encomenda não está pronta para levantamento.';
  end if;
  if v_codigo.usado_em is not null then
    validado := false; estado_encomenda := v_encomenda.estado;
    tentativas_restantes := 0; bloqueado := false;
    motivo := 'Este código de levantamento já foi utilizado.';
    return next; return;
  end if;
  if v_codigo.bloqueado_em is not null or v_codigo.tentativas >= v_codigo.max_tentativas then
    validado := false; estado_encomenda := v_encomenda.estado;
    tentativas_restantes := 0; bloqueado := true;
    motivo := 'Este código de levantamento está bloqueado. O cliente deve renová-lo.';
    return next; return;
  end if;
  if v_codigo.expira_em <= v_agora then
    validado := false; estado_encomenda := v_encomenda.estado;
    tentativas_restantes := greatest(v_codigo.max_tentativas - v_codigo.tentativas, 0)::smallint;
    bloqueado := false;
    motivo := 'Este código de levantamento expirou. O cliente deve renová-lo.';
    return next; return;
  end if;
  if extensions.crypt(v_codigo_apresentado, v_codigo.codigo_hash) <> v_codigo.codigo_hash then
    v_tentativas := v_codigo.tentativas + 1;
    update public.codigos_levantamento
    set tentativas = v_tentativas,
        bloqueado_em = case when v_tentativas >= v_codigo.max_tentativas then v_agora else null end,
        atualizado_por = auth.uid()
    where id = v_codigo.id;
    insert into public.eventos_encomenda (
      encomenda_id, tipo_evento, estado_anterior, estado_novo,
      ator_tipo, utilizador_id, metadados
    ) values (
      v_encomenda.id, 'tentativa_levantamento_falhou',
      'pronta_para_levantamento', 'pronta_para_levantamento',
      'vendedor', auth.uid(), jsonb_build_object(
        'tentativas', v_tentativas,
        'bloqueado', v_tentativas >= v_codigo.max_tentativas
      )
    );
    validado := false; estado_encomenda := v_encomenda.estado;
    tentativas_restantes := greatest(v_codigo.max_tentativas - v_tentativas, 0)::smallint;
    bloqueado := v_tentativas >= v_codigo.max_tentativas;
    motivo := case when bloqueado then
      'Código incorreto. O limite de tentativas foi atingido e o código foi bloqueado.'
    else 'Código de levantamento incorreto.' end;
    return next; return;
  end if;

  if not found then
    raise exception 'Não existe pagamento preparado para esta encomenda.';
  end if;
  if v_pagamento.estado <> 'confirmado' then
    select * into v_tentativa
    from public.tentativas_pagamento
    where pagamento_id = v_pagamento.id
      and metodo = 'pagamento_no_levantamento'
    order by criado_em desc, id desc
    limit 1
    for update;
    if not found or v_pagamento.estado <> 'pendente' or v_tentativa.estado not in ('criada', 'pendente') then
      raise exception 'O pagamento no levantamento não pode ser confirmado no estado atual.';
    end if;

    update public.tentativas_pagamento
    set estado = 'confirmada', confirmado_em = v_agora,
        metadados = metadados || jsonb_build_object('confirmado_no_levantamento_por', auth.uid())
    where id = v_tentativa.id;
    update public.pagamentos
    set estado = 'confirmado', confirmado_em = v_agora
    where id = v_pagamento.id
    returning * into v_pagamento;
    insert into public.eventos_pagamento (
      pagamento_id, tentativa_pagamento_id, encomenda_id, tipo_evento,
      estado_anterior, estado_novo, ator_tipo, utilizador_id, metadados
    ) values (
      v_pagamento.id, v_tentativa.id, v_encomenda.id, 'pagamento_confirmado',
      'pendente', 'confirmado', 'vendedor', auth.uid(),
      jsonb_build_object('metodo', 'pagamento_no_levantamento', 'origem', 'validacao_otp_levantamento')
    );
  end if;

  update public.codigos_levantamento
  set usado_em = v_agora, atualizado_por = auth.uid()
  where id = v_codigo.id;
  update public.encomendas
  set estado = 'concluida', concluido_em = v_agora
  where id = v_encomenda.id
  returning * into v_encomenda;
  insert into public.eventos_encomenda (
    encomenda_id, tipo_evento, estado_anterior, estado_novo,
    ator_tipo, utilizador_id, metadados
  ) values (
    v_encomenda.id, 'levantamento_confirmado',
    'pronta_para_levantamento', 'concluida',
    'vendedor', auth.uid(), jsonb_build_object('pagamento_confirmado', true)
  );

  validado := true; estado_encomenda := 'concluida';
  tentativas_restantes := greatest(v_codigo.max_tentativas - v_codigo.tentativas, 0)::smallint;
  bloqueado := false; motivo := null;
  return next;
end;
$$;

revoke all on function public.confirmar_chegada_destino_entregador(uuid),public.obter_codigo_entrega_cliente(uuid),public.registar_pagamento_na_entrega_entregador(uuid),public.validar_codigo_entrega_entregador(uuid,text) from public,anon;
grant execute on function public.confirmar_chegada_destino_entregador(uuid),public.obter_codigo_entrega_cliente(uuid),public.registar_pagamento_na_entrega_entregador(uuid),public.validar_codigo_entrega_entregador(uuid,text) to authenticated;
revoke all on function public.normalizar_itens_checkout_idempotencia(jsonb),public.calcular_hash_intencao_checkout(jsonb) from public,anon,authenticated;
revoke all on function public.criar_encomenda_levantamento(jsonb,text,text,text,text) from public,anon,authenticated;
revoke all on function public.criar_encomenda_entrega(jsonb,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.criar_encomenda_levantamento(jsonb,text,text,text,text,uuid),public.criar_encomenda_entrega(jsonb,text,text,text,text,text,text,text,text,text,uuid) from public,anon;
grant execute on function public.criar_encomenda_levantamento(jsonb,text,text,text,text,uuid),public.criar_encomenda_entrega(jsonb,text,text,text,text,text,text,text,text,text,uuid) to authenticated;
revoke all on function public.gerar_otp_entrega_aleatorio(),public.notificar_ciclo_entrega_fase_1() from public,anon,authenticated;

commit;
