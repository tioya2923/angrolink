-- ANGROLINK — tarefas do entregador V1. Sem recolha, trânsito ou prova de entrega.
begin;

alter table public.eventos_encomenda drop constraint if exists eventos_encomenda_tipo_evento_check;
alter table public.eventos_encomenda add constraint eventos_encomenda_tipo_evento_check check (tipo_evento in (
  'encomenda_criada', 'vendedor_confirmou', 'vendedor_recusou', 'preparacao_iniciada',
  'pronta_para_levantamento', 'levantamento_confirmado', 'encomenda_concluida',
  'cliente_cancelou', 'codigo_levantamento_gerado', 'codigo_levantamento_regenerado',
  'tentativa_levantamento_falhou', 'problema_reportado', 'entregador_atribuido',
  'entregador_aceitou', 'entregador_recusou'
));
alter table public.eventos_encomenda drop constraint if exists eventos_encomenda_ator_tipo_check;
alter table public.eventos_encomenda add constraint eventos_encomenda_ator_tipo_check check (ator_tipo in ('cliente', 'vendedor', 'admin', 'sistema', 'entregador'));

create or replace function public.aceitar_atribuicao_entrega(p_atribuicao_id uuid)
returns public.atribuicoes_entrega_encomenda
language plpgsql security definer set search_path = public as $$
declare v_atribuicao public.atribuicoes_entrega_encomenda%rowtype; v_encomenda public.encomendas%rowtype; v_estado text; v_motivos text[];
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select a.* into v_atribuicao from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id where a.id=p_atribuicao_id and p.user_id=auth.uid() for update;
  if not found then raise exception 'Tarefa não encontrada ou sem permissão.'; end if;
  if v_atribuicao.estado <> 'atribuida' then raise exception 'Esta tarefa já não está disponível para aceite.'; end if;
  select * into v_encomenda from public.encomendas where id=v_atribuicao.encomenda_id for update;
  if v_encomenda.modalidade_recebimento <> 'entrega' then raise exception 'A encomenda já não é uma entrega válida.'; end if;
  if not public.entregador_pode_receber_entregas(v_atribuicao.parceiro_entrega_id) or not public.veiculo_operacional_para_entregas(v_atribuicao.veiculo_id) then raise exception 'A conta ou veículo já não está elegível para esta tarefa.'; end if;
  select estado, motivos into v_estado, v_motivos from public.avaliar_compatibilidade_veiculo_encomenda(v_atribuicao.veiculo_id, v_atribuicao.encomenda_id);
  if v_estado <> 'compativel' then raise exception 'A tarefa deixou de ser compatível: %.', coalesce(array_to_string(v_motivos, ', '), 'sem detalhe'); end if;
  update public.atribuicoes_entrega_encomenda set estado='aceite', aceite_em=now() where id=v_atribuicao.id and estado='atribuida' returning * into v_atribuicao;
  if not found then raise exception 'Esta tarefa foi atualizada por outra operação.'; end if;
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(v_atribuicao.encomenda_id,'entregador_aceitou',v_encomenda.estado,v_encomenda.estado,'entregador',auth.uid(),jsonb_build_object('atribuicao_id',v_atribuicao.id));
  return v_atribuicao;
end; $$;

create or replace function public.recusar_atribuicao_entrega(p_atribuicao_id uuid, p_motivo text)
returns public.atribuicoes_entrega_encomenda
language plpgsql security definer set search_path = public as $$
declare v_atribuicao public.atribuicoes_entrega_encomenda%rowtype; v_motivo text := nullif(btrim(p_motivo), '');
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  if v_motivo is null or char_length(v_motivo) < 3 or char_length(v_motivo) > 500 then raise exception 'Indique um motivo entre 3 e 500 caracteres.'; end if;
  select a.* into v_atribuicao from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id where a.id=p_atribuicao_id and p.user_id=auth.uid() for update;
  if not found then raise exception 'Tarefa não encontrada ou sem permissão.'; end if;
  if v_atribuicao.estado <> 'atribuida' then raise exception 'Esta tarefa já não está disponível para recusa.'; end if;
  update public.atribuicoes_entrega_encomenda set estado='recusada', recusado_em=now(), motivo_recusa=v_motivo where id=v_atribuicao.id and estado='atribuida' returning * into v_atribuicao;
  if not found then raise exception 'Esta tarefa foi atualizada por outra operação.'; end if;
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(v_atribuicao.encomenda_id,'entregador_recusou','atribuida','recusada','entregador',auth.uid(),jsonb_build_object('atribuicao_id',v_atribuicao.id,'motivo',v_motivo));
  return v_atribuicao;
end; $$;

create or replace function public.listar_tarefas_entregador()
returns table(id uuid,encomenda_id uuid,codigo_publico text,estado text,atribuido_em timestamptz,aceite_em timestamptz,recusado_em timestamptz,motivo_recusa text,tipo_veiculo text,matricula text,origem jsonb,destino jsonb,quantidade_itens integer,requisitos_logisticos jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  return query select a.id,e.id,e.codigo_publico,a.estado,a.atribuido_em,a.aceite_em,a.recusado_em,a.motivo_recusa,v.tipo_veiculo,v.matricula,
    jsonb_build_object('provincia',e.provincia,'municipio',e.municipio,'bairro',e.bairro,'endereco',e.endereco_levantamento),
    jsonb_build_object('provincia',d.provincia,'municipio',d.municipio,'bairro',d.bairro,'endereco',d.endereco_detalhado),
    (select count(*)::integer from public.itens_encomenda i where i.encomenda_id=e.id),
    coalesce((select jsonb_build_object('peso_total_kg',r.peso_total_kg,'peso_total_conhecido',r.peso_total_conhecido,'volume_total_m3',r.volume_total_m3,'volume_total_conhecido',r.volume_total_conhecido,'requer_refrigeracao',r.requer_refrigeracao,'requer_caixa_carga',r.requer_caixa_carga,'requer_paletes',r.requer_paletes) from public.calcular_requisitos_logisticos_encomenda(e.id) r),'{}'::jsonb)
  from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id join public.encomendas e on e.id=a.encomenda_id join public.veiculos_entrega v on v.id=a.veiculo_id left join public.enderecos_entrega_encomenda d on d.encomenda_id=e.id where p.user_id=auth.uid() order by a.atribuido_em desc;
end; $$;

create or replace function public.obter_tarefa_entregador(p_atribuicao_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_resultado jsonb;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select jsonb_build_object('tarefa',jsonb_build_object('id',a.id,'estado',a.estado,'atribuido_em',a.atribuido_em,'aceite_em',a.aceite_em,'recusado_em',a.recusado_em,'motivo_recusa',a.motivo_recusa),'encomenda',jsonb_build_object('id',e.id,'codigo_publico',e.codigo_publico,'estado',e.estado,'modalidade',e.modalidade_recebimento),'veiculo',jsonb_build_object('tipo',v.tipo_veiculo,'matricula',v.matricula),'origem',jsonb_build_object('nome_vendedor',ven.nome_comercial,'telefone',coalesce(ven.telefone_whatsapp,ven.whatsapp),'provincia',e.provincia,'municipio',e.municipio,'bairro',e.bairro,'endereco',e.endereco_levantamento,'referencia',e.ponto_referencia),'destino',jsonb_build_object('nome',d.destinatario_nome,'telefone',d.destinatario_telefone,'provincia',d.provincia,'municipio',d.municipio,'bairro',d.bairro,'endereco',d.endereco_detalhado,'referencia',d.ponto_referencia,'instrucoes',d.instrucoes_entrega),'itens',coalesce((select jsonb_agg(jsonb_build_object('nome',i.nome_produto_snapshot,'quantidade',i.quantidade,'unidade',i.unidade) order by i.criado_em) from public.itens_encomenda i where i.encomenda_id=e.id),'[]'::jsonb),'requisitos_logisticos',coalesce((select jsonb_build_object('peso_total_kg',r.peso_total_kg,'peso_total_conhecido',r.peso_total_conhecido,'volume_total_m3',r.volume_total_m3,'volume_total_conhecido',r.volume_total_conhecido,'requer_refrigeracao',r.requer_refrigeracao,'requer_caixa_carga',r.requer_caixa_carga,'requer_paletes',r.requer_paletes) from public.calcular_requisitos_logisticos_encomenda(e.id) r),'{}'::jsonb)) into v_resultado from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id join public.encomendas e on e.id=a.encomenda_id join public.vendedores ven on ven.id=e.vendedor_id join public.veiculos_entrega v on v.id=a.veiculo_id left join public.enderecos_entrega_encomenda d on d.encomenda_id=e.id where a.id=p_atribuicao_id and p.user_id=auth.uid();
  if v_resultado is null then raise exception 'Tarefa não encontrada ou sem permissão.'; end if; return v_resultado;
end; $$;

create or replace function public.obter_atribuicao_entrega_encomenda_admin(p_encomenda_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_resultado jsonb;
begin
 if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
 select jsonb_build_object('id',a.id,'estado',a.estado,'atribuido_em',a.atribuido_em,'aceite_em',a.aceite_em,'recusado_em',a.recusado_em,'motivo_recusa',a.motivo_recusa,'parceiro_id',p.id,'parceiro_nome',p.nome_completo,'veiculo_id',v.id,'veiculo_tipo',v.tipo_veiculo,'matricula',v.matricula,'atribuido_por',a.atribuido_por,'admin_nome',pr.nome) into v_resultado from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id join public.veiculos_entrega v on v.id=a.veiculo_id left join public.profiles pr on pr.id=a.atribuido_por where a.encomenda_id=p_encomenda_id order by a.atribuido_em desc limit 1;
 return coalesce(v_resultado,jsonb_build_object('estado','nao_atribuido'));
end; $$;

revoke all on function public.aceitar_atribuicao_entrega(uuid),public.recusar_atribuicao_entrega(uuid,text),public.listar_tarefas_entregador(),public.obter_tarefa_entregador(uuid) from public,anon;
grant execute on function public.aceitar_atribuicao_entrega(uuid),public.recusar_atribuicao_entrega(uuid,text),public.listar_tarefas_entregador(),public.obter_tarefa_entregador(uuid) to authenticated;
commit;
