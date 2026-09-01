-- ANGROLINK — ciclo completo de entrega, fase 2: recolha bilateral.
begin;

alter table public.encomendas drop constraint if exists encomendas_estado_check;
alter table public.encomendas add constraint encomendas_estado_check check (estado in (
  'aguardando_confirmacao', 'confirmada', 'em_preparacao',
  'pronta_para_levantamento', 'levantada', 'recolhida', 'concluida',
  'recusada', 'cancelada'
));

alter table public.atribuicoes_entrega_encomenda
  add column if not exists chegou_origem_em timestamptz,
  add column if not exists recolhida_em timestamptz;

alter table public.atribuicoes_entrega_encomenda
  drop constraint if exists atribuicoes_entrega_encomenda_estado_check,
  drop constraint if exists atribuicao_entrega_marcos_consistentes;
alter table public.atribuicoes_entrega_encomenda
  add constraint atribuicoes_entrega_encomenda_estado_check check (estado in (
    'atribuida', 'aceite', 'chegou_origem', 'recolhida', 'recusada', 'cancelada', 'concluida'
  )),
  add constraint atribuicao_entrega_marcos_consistentes check (
    (estado <> 'aceite' or aceite_em is not null)
    and (estado <> 'chegou_origem' or aceite_em is not null and chegou_origem_em is not null)
    and (estado <> 'recolhida' or aceite_em is not null and chegou_origem_em is not null and recolhida_em is not null)
    and (estado <> 'recusada' or recusado_em is not null)
    and (estado <> 'cancelada' or cancelado_em is not null)
    and (estado <> 'concluida' or concluido_em is not null)
  );

drop index if exists public.atribuicoes_entrega_uma_ativa_por_encomenda_idx;
create unique index atribuicoes_entrega_uma_ativa_por_encomenda_idx
  on public.atribuicoes_entrega_encomenda (encomenda_id)
  where estado in ('atribuida', 'aceite', 'chegou_origem', 'recolhida');

alter table public.eventos_encomenda drop constraint if exists eventos_encomenda_tipo_evento_check;
alter table public.eventos_encomenda add constraint eventos_encomenda_tipo_evento_check check (tipo_evento in (
  'encomenda_criada', 'vendedor_confirmou', 'vendedor_recusou', 'preparacao_iniciada',
  'pronta_para_levantamento', 'levantamento_confirmado', 'encomenda_concluida',
  'cliente_cancelou', 'codigo_levantamento_gerado', 'codigo_levantamento_regenerado',
  'tentativa_levantamento_falhou', 'problema_reportado', 'entregador_atribuido',
  'entregador_aceitou', 'entregador_recusou', 'entregador_chegou_origem',
  'encomenda_recolhida'
));

create or replace function public.confirmar_chegada_origem_entregador(p_atribuicao_id uuid)
returns public.atribuicoes_entrega_encomenda
language plpgsql security definer set search_path = public as $$
declare v_atribuicao public.atribuicoes_entrega_encomenda%rowtype; v_encomenda public.encomendas%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select a.* into v_atribuicao from public.atribuicoes_entrega_encomenda a
    join public.parceiros_entrega p on p.id = a.parceiro_entrega_id
    where a.id = p_atribuicao_id and p.user_id = auth.uid() for update;
  if not found then raise exception 'Tarefa não encontrada ou sem permissão.'; end if;
  select * into v_encomenda from public.encomendas where id = v_atribuicao.encomenda_id for update;
  -- A titularidade do parceiro foi confirmada antes desta ramificação. Uma
  -- repetição só é segura quando os dois registos já chegaram ao mesmo marco.
  if v_atribuicao.estado = 'recolhida' and v_encomenda.estado = 'recolhida' then
    return v_atribuicao;
  end if;
  if (v_atribuicao.estado = 'recolhida') <> (v_encomenda.estado = 'recolhida') then
    raise exception 'Inconsistência de integridade na recolha.';
  end if;
  if v_atribuicao.estado = 'chegou_origem' then
    if v_encomenda.modalidade_recebimento = 'entrega'
       and v_encomenda.estado = 'pronta_para_levantamento' then
      return v_atribuicao;
    end if;
    raise exception 'A encomenda já não está disponível para recolha.';
  end if;
  if v_encomenda.modalidade_recebimento <> 'entrega' or v_encomenda.estado <> 'pronta_para_levantamento' then
    raise exception 'A encomenda já não está disponível para recolha.';
  end if;
  if v_atribuicao.estado <> 'aceite' then raise exception 'A tarefa precisa estar aceite antes de confirmar a chegada.'; end if;
  update public.atribuicoes_entrega_encomenda set estado = 'chegou_origem', chegou_origem_em = now()
    where id = v_atribuicao.id returning * into v_atribuicao;
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados)
  values(v_encomenda.id,'entregador_chegou_origem',v_encomenda.estado,v_encomenda.estado,'entregador',auth.uid(),
    jsonb_build_object('atribuicao_id',v_atribuicao.id,'parceiro_entrega_id',v_atribuicao.parceiro_entrega_id,'veiculo_id',v_atribuicao.veiculo_id));
  return v_atribuicao;
end; $$;

create or replace function public.confirmar_recolha_encomenda_vendedor(p_atribuicao_id uuid)
returns public.atribuicoes_entrega_encomenda
language plpgsql security definer set search_path = public as $$
declare v_atribuicao public.atribuicoes_entrega_encomenda%rowtype; v_encomenda public.encomendas%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select a.* into v_atribuicao from public.atribuicoes_entrega_encomenda a where a.id = p_atribuicao_id for update;
  if not found then raise exception 'Atribuição não encontrada.'; end if;
  select * into v_encomenda from public.encomendas where id = v_atribuicao.encomenda_id for update;
  if not exists (select 1 from public.vendedores v where v.id = v_encomenda.vendedor_id and v.user_id = auth.uid()) then raise exception 'Sem permissão para confirmar esta recolha.'; end if;
  if v_atribuicao.estado = 'recolhida' and v_encomenda.estado = 'recolhida' then return v_atribuicao; end if;
  if v_atribuicao.estado = 'recolhida' or v_encomenda.estado = 'recolhida' then raise exception 'Inconsistência de integridade na recolha.'; end if;
  if v_encomenda.modalidade_recebimento <> 'entrega' or v_encomenda.estado <> 'pronta_para_levantamento' or v_atribuicao.estado <> 'chegou_origem' then raise exception 'A recolha não pode ser confirmada no estado atual.'; end if;
  update public.atribuicoes_entrega_encomenda set estado = 'recolhida', recolhida_em = now() where id = v_atribuicao.id returning * into v_atribuicao;
  update public.encomendas set estado = 'recolhida' where id = v_encomenda.id;
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados)
  values(v_encomenda.id,'encomenda_recolhida','pronta_para_levantamento','recolhida','vendedor',auth.uid(),
    jsonb_build_object('atribuicao_id',v_atribuicao.id,'parceiro_entrega_id',v_atribuicao.parceiro_entrega_id,'veiculo_id',v_atribuicao.veiculo_id,'confirmado_por_vendedor_user_id',auth.uid()));
  return v_atribuicao;
end; $$;

create or replace function public.atribuir_entregador_encomenda(p_encomenda_id uuid,p_parceiro_id uuid,p_veiculo_id uuid)
returns public.atribuicoes_entrega_encomenda language plpgsql security definer set search_path = public as $$
declare v_encomenda public.encomendas%rowtype; v_veiculo public.veiculos_entrega%rowtype; v_atribuicao public.atribuicoes_entrega_encomenda%rowtype; v_estado text; v_motivos text[];
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  select * into v_encomenda from public.encomendas where id=p_encomenda_id for update;
  if not found then raise exception 'Encomenda não encontrada.'; end if;
  if v_encomenda.modalidade_recebimento <> 'entrega' or v_encomenda.estado <> 'pronta_para_levantamento' then raise exception 'A encomenda precisa estar pronta para recolha antes de atribuir um entregador.'; end if;
  if exists(select 1 from public.atribuicoes_entrega_encomenda a where a.encomenda_id=p_encomenda_id and a.estado in ('atribuida','aceite','chegou_origem','recolhida')) then raise exception 'Esta encomenda já possui uma atribuição ativa.'; end if;
  select * into v_veiculo from public.veiculos_entrega where id=p_veiculo_id and parceiro_id=p_parceiro_id for update;
  if not found then raise exception 'O veículo indicado não pertence ao parceiro de entrega.'; end if;
  if not public.entregador_pode_receber_entregas(p_parceiro_id) then raise exception 'O parceiro de entrega já não está elegível para receber entregas.'; end if;
  if not public.veiculo_operacional_para_entregas(p_veiculo_id) then raise exception 'O veículo já não está operacional para entregas.'; end if;
  select c.estado,c.motivos into v_estado,v_motivos from public.avaliar_compatibilidade_veiculo_encomenda(p_veiculo_id,p_encomenda_id) c;
  if v_estado is distinct from 'compativel' then raise exception 'O veículo deixou de ser compatível com esta encomenda: %.',coalesce(array_to_string(v_motivos,', '),'sem detalhe'); end if;
  insert into public.atribuicoes_entrega_encomenda(encomenda_id,parceiro_entrega_id,veiculo_id,estado,atribuido_por) values(p_encomenda_id,p_parceiro_id,p_veiculo_id,'atribuida',auth.uid()) returning * into v_atribuicao;
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(p_encomenda_id,'entregador_atribuido',v_encomenda.estado,v_encomenda.estado,'admin',auth.uid(),jsonb_build_object('atribuicao_id',v_atribuicao.id,'parceiro_entrega_id',p_parceiro_id,'veiculo_id',p_veiculo_id));
  return v_atribuicao;
end; $$;

create or replace function public.obter_entrega_encomenda_participante(p_encomenda_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_encomenda public.encomendas%rowtype; v_atribuicao public.atribuicoes_entrega_encomenda%rowtype; v_e_vendedor boolean := false;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select * into v_encomenda from public.encomendas where id=p_encomenda_id; if not found then raise exception 'Encomenda não encontrada.'; end if;
  select exists(select 1 from public.vendedores v where v.id=v_encomenda.vendedor_id and v.user_id=auth.uid()) into v_e_vendedor;
  if v_encomenda.cliente_id <> auth.uid() and not v_e_vendedor then raise exception 'Sem permissão para consultar a entrega.'; end if;
  if v_encomenda.modalidade_recebimento <> 'entrega' then return jsonb_build_object('estado','nao_aplicavel'); end if;
  select * into v_atribuicao from public.atribuicoes_entrega_encomenda a where a.encomenda_id=v_encomenda.id order by a.atribuido_em desc,a.id desc limit 1;
  if not found then return jsonb_build_object('estado','nao_atribuido'); end if;
  if v_atribuicao.estado in ('aceite','chegou_origem','recolhida') then
    return (select jsonb_build_object('atribuicao_id',a.id,'estado',a.estado,'atribuido_em',a.atribuido_em,'aceite_em',a.aceite_em,'chegou_origem_em',a.chegou_origem_em,'recolhida_em',a.recolhida_em,'parceiro_entrega_id',p.id,'nome_entregador',p.nome_completo,'veiculo',jsonb_build_object('tipo_veiculo',v.tipo_veiculo,'marca',v.marca,'modelo',v.modelo,'matricula',v.matricula,'capacidade_kg',v.capacidade_kg,'capacidade_volume_m3',v.capacidade_volume_m3)) from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id join public.veiculos_entrega v on v.id=a.veiculo_id where a.id=v_atribuicao.id);
  end if;
  return jsonb_build_object('atribuicao_id',v_atribuicao.id,'estado',v_atribuicao.estado,'atribuido_em',v_atribuicao.atribuido_em,'recusado_em',v_atribuicao.recusado_em,'motivo_recusa',case when v_e_vendedor and v_atribuicao.estado='recusada' then v_atribuicao.motivo_recusa else null end);
end; $$;

create or replace function public.obter_tarefa_entregador(p_atribuicao_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_resultado jsonb;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select jsonb_build_object('tarefa',jsonb_build_object('id',a.id,'estado',a.estado,'atribuido_em',a.atribuido_em,'aceite_em',a.aceite_em,'chegou_origem_em',a.chegou_origem_em,'recolhida_em',a.recolhida_em,'recusado_em',a.recusado_em,'motivo_recusa',a.motivo_recusa),'encomenda',jsonb_build_object('id',e.id,'codigo_publico',e.codigo_publico,'estado',e.estado,'modalidade',e.modalidade_recebimento),'veiculo',jsonb_build_object('tipo',v.tipo_veiculo,'matricula',v.matricula),'origem',jsonb_build_object('nome_vendedor',case when a.estado in ('aceite','chegou_origem','recolhida') then ven.nome_comercial end,'telefone',case when a.estado in ('aceite','chegou_origem','recolhida') then coalesce(ven.telefone_whatsapp,ven.whatsapp) end,'provincia',e.provincia,'municipio',e.municipio,'bairro',e.bairro,'endereco',case when a.estado in ('aceite','chegou_origem','recolhida') then e.endereco_levantamento end,'referencia',case when a.estado in ('aceite','chegou_origem','recolhida') then e.ponto_referencia end),'destino',jsonb_build_object('nome',case when a.estado in ('aceite','chegou_origem','recolhida') then d.destinatario_nome end,'telefone',case when a.estado in ('aceite','chegou_origem','recolhida') then d.destinatario_telefone end,'provincia',d.provincia,'municipio',d.municipio,'bairro',d.bairro,'endereco',case when a.estado in ('aceite','chegou_origem','recolhida') then d.endereco_detalhado end,'referencia',case when a.estado in ('aceite','chegou_origem','recolhida') then d.ponto_referencia end,'instrucoes',case when a.estado in ('aceite','chegou_origem','recolhida') then d.instrucoes_entrega end),'itens',coalesce((select jsonb_agg(jsonb_build_object('nome',i.nome_produto_snapshot,'quantidade',i.quantidade,'unidade',i.unidade) order by i.criado_em,i.id) from public.itens_encomenda i where i.encomenda_id=e.id),'[]'::jsonb),'requisitos_logisticos',coalesce((select jsonb_build_object('peso_total_kg',r.peso_total_kg,'peso_total_conhecido',r.peso_total_conhecido,'volume_total_m3',r.volume_total_m3,'volume_total_conhecido',r.volume_total_conhecido,'requer_refrigeracao',r.requer_refrigeracao,'requer_caixa_carga',r.requer_caixa_carga,'requer_paletes',r.requer_paletes) from public.calcular_requisitos_logisticos_encomenda(e.id) r),'{}'::jsonb)) into v_resultado from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id join public.encomendas e on e.id=a.encomenda_id join public.vendedores ven on ven.id=e.vendedor_id join public.veiculos_entrega v on v.id=a.veiculo_id left join public.enderecos_entrega_encomenda d on d.encomenda_id=e.id where a.id=p_atribuicao_id and p.user_id=auth.uid();
  if v_resultado is null then raise exception 'Tarefa não encontrada ou sem permissão.'; end if; return v_resultado;
end; $$;

create or replace function public.obter_atribuicao_entrega_encomenda_admin(p_encomenda_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_resultado jsonb;
begin
 if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
 select jsonb_build_object('id',a.id,'estado',a.estado,'atribuido_em',a.atribuido_em,'aceite_em',a.aceite_em,'chegou_origem_em',a.chegou_origem_em,'recolhida_em',a.recolhida_em,'recusado_em',a.recusado_em,'motivo_recusa',a.motivo_recusa,'parceiro_id',p.id,'parceiro_nome',p.nome_completo,'veiculo_id',v.id,'veiculo_tipo',v.tipo_veiculo,'matricula',v.matricula,'atribuido_por',a.atribuido_por,'admin_nome',pr.nome) into v_resultado from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id join public.veiculos_entrega v on v.id=a.veiculo_id left join public.profiles pr on pr.id=a.atribuido_por where a.encomenda_id=p_encomenda_id and a.estado in ('atribuida','aceite','chegou_origem','recolhida') order by a.atribuido_em desc limit 1;
 return coalesce(v_resultado,jsonb_build_object('estado','nao_atribuido'));
end; $$;

create or replace function public.notificar_recolha_entrega_fase_2()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_encomenda public.encomendas%rowtype; v_destinatario_id uuid; v_atribuicao_id uuid; v_url_comprador text; v_url_vendedor text;
begin
 begin
  select * into v_encomenda from public.encomendas where id=new.encomenda_id; if not found then return new; end if;
  select case when exists(select 1 from public.vendedores v where v.user_id=v_encomenda.cliente_id) then '/dashboard/compras/'||v_encomenda.id else '/dashboard/encomendas/'||v_encomenda.id end into v_url_comprador;
  v_url_vendedor := '/dashboard/encomendas/'||v_encomenda.id;
  if new.tipo_evento='entregador_chegou_origem' then
    select v.user_id into v_destinatario_id from public.vendedores v where v.id=v_encomenda.vendedor_id;
    if v_destinatario_id is not null then perform public.criar_notificacao(v_destinatario_id,'venda','entregador_chegou_origem','Entregador chegou para recolha','O entregador chegou para recolher esta encomenda.','encomenda',v_encomenda.id,v_url_vendedor,'{}'::jsonb,'encomenda:'||new.id||':vendedor'); end if;
  elsif new.tipo_evento='encomenda_recolhida' then
    if v_encomenda.cliente_id is not null then perform public.criar_notificacao(v_encomenda.cliente_id,'compra','encomenda_recolhida','Encomenda recolhida','O entregador recolheu a tua encomenda junto do vendedor.','encomenda',v_encomenda.id,v_url_comprador,'{}'::jsonb,'encomenda:'||new.id||':cliente'); end if;
    v_atribuicao_id := nullif(new.metadados->>'atribuicao_id','')::uuid;
    select p.user_id into v_destinatario_id from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id where a.id=v_atribuicao_id;
    if v_destinatario_id is not null then perform public.criar_notificacao(v_destinatario_id,'entrega','encomenda_recolhida','Recolha confirmada','O vendedor confirmou a entrega da encomenda.','atribuicao_entrega',v_atribuicao_id,'/dashboard/tarefas/'||v_atribuicao_id,'{}'::jsonb,'encomenda:'||new.id||':entregador'); end if;
  end if;
 exception when others then raise warning 'Não foi possível criar a notificação do evento %: %',new.id,sqlerrm; end;
 return new;
end; $$;

drop trigger if exists criar_notificacao_recolha_entrega_fase_2 on public.eventos_encomenda;
create trigger criar_notificacao_recolha_entrega_fase_2
after insert on public.eventos_encomenda
for each row
when (new.tipo_evento in ('entregador_chegou_origem', 'encomenda_recolhida'))
execute function public.notificar_recolha_entrega_fase_2();

revoke all on function public.confirmar_chegada_origem_entregador(uuid),public.confirmar_recolha_encomenda_vendedor(uuid) from public, anon;
grant execute on function public.confirmar_chegada_origem_entregador(uuid),public.confirmar_recolha_encomenda_vendedor(uuid) to authenticated;
revoke all on function public.notificar_recolha_entrega_fase_2() from public, anon, authenticated;

commit;
