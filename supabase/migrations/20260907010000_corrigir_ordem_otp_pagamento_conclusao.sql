-- ANGROLINK — OTP presencial antes do pagamento e da conclusão.
begin;

alter table public.eventos_encomenda drop constraint if exists eventos_encomenda_tipo_evento_check;
alter table public.eventos_encomenda add constraint eventos_encomenda_tipo_evento_check check (tipo_evento in (
  'encomenda_criada','vendedor_confirmou','vendedor_recusou','preparacao_iniciada',
  'pronta_para_levantamento','levantamento_confirmado','encomenda_concluida','cliente_cancelou',
  'codigo_levantamento_gerado','codigo_levantamento_regenerado','codigo_levantamento_validado',
  'tentativa_levantamento_falhou','problema_reportado','entregador_atribuido','entregador_aceitou',
  'entregador_recusou','entregador_chegou_origem','encomenda_recolhida','entregador_chegou_destino',
  'codigo_entrega_gerado','codigo_entrega_regenerado','codigo_entrega_validado',
  'tentativa_entrega_falhou','entrega_confirmada','atribuicao_liberada_admin',
  'incidente_operacional_aberto','incidente_operacional_resolvido'
));

create or replace function public.obter_estado_levantamento_participante(p_encomenda_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_encomenda public.encomendas%rowtype; v_vendedor boolean := false;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select * into v_encomenda from public.encomendas where id=p_encomenda_id;
  if not found then raise exception 'Encomenda não encontrada.'; end if;
  select exists(select 1 from public.vendedores v where v.id=v_encomenda.vendedor_id and v.user_id=auth.uid()) into v_vendedor;
  if v_encomenda.cliente_id <> auth.uid() and not v_vendedor then raise exception 'Sem permissão para consultar o levantamento.'; end if;
  if v_encomenda.modalidade_recebimento <> 'levantamento' then return jsonb_build_object('estado','nao_aplicavel'); end if;
  return jsonb_build_object(
    'estado', v_encomenda.estado,
    'codigo_validado', exists(select 1 from public.codigos_levantamento c where c.encomenda_id=v_encomenda.id and c.usado_em is not null),
    'pagamento_confirmado', exists(select 1 from public.pagamentos p where p.encomenda_id=v_encomenda.id and p.estado='confirmado')
  );
end;
$$;

create or replace function public.validar_codigo_entrega_entregador(p_atribuicao_id uuid,p_codigo text)
returns table(validado boolean,estado_encomenda text,tentativas_restantes smallint,bloqueado boolean,motivo text)
language plpgsql security definer set search_path = public as $$
declare a public.atribuicoes_entrega_encomenda%rowtype; e public.encomendas%rowtype; c public.codigos_entrega%rowtype; apresentado text:=nullif(btrim(p_codigo),''); agora timestamptz:=now(); v_tentativas smallint;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  if apresentado is null or apresentado !~ '^[0-9]{6}$' then raise exception 'Introduza o código de entrega de seis dígitos.'; end if;
  select a0.* into a from public.atribuicoes_entrega_encomenda a0 join public.parceiros_entrega p on p.id=a0.parceiro_entrega_id where a0.id=p_atribuicao_id and p.user_id=auth.uid() for update;
  if not found then raise exception 'Tarefa não encontrada ou sem permissão.'; end if;
  select * into e from public.encomendas where id=a.encomenda_id for update;
  select * into c from public.codigos_entrega where encomenda_id=e.id for update;
  if a.estado='concluida' and e.estado='concluida' and found and c.usado_em is not null and extensions.crypt(apresentado,c.codigo_hash)=c.codigo_hash then
    validado:=true; estado_encomenda:='concluida'; tentativas_restantes:=greatest(c.max_tentativas-c.tentativas,0); bloqueado:=false; motivo:=null; return next; return;
  end if;
  if (a.estado='chegou_destino') <> (e.estado='chegou_destino') then raise exception 'Inconsistência de integridade na entrega ao destino.'; end if;
  if e.modalidade_recebimento <> 'entrega' or a.estado <> 'chegou_destino' then raise exception 'A entrega não pode ser confirmada no estado atual.'; end if;
  if not found then validado:=false; estado_encomenda:=e.estado; tentativas_restantes:=0; bloqueado:=false; motivo:='O comprador ainda não gerou um código de entrega.'; return next; return; end if;
  if c.usado_em is not null then
    validado:=extensions.crypt(apresentado,c.codigo_hash)=c.codigo_hash; estado_encomenda:=e.estado; tentativas_restantes:=greatest(c.max_tentativas-c.tentativas,0); bloqueado:=false; motivo:=case when validado then null else 'Este código de entrega já foi utilizado.' end; return next; return;
  end if;
  if c.bloqueado_em is not null or c.expira_em <= agora then validado:=false; estado_encomenda:=e.estado; tentativas_restantes:=greatest(c.max_tentativas-c.tentativas,0); bloqueado:=c.bloqueado_em is not null; motivo:=case when bloqueado then 'Este código de entrega está bloqueado. O comprador deve renová-lo.' else 'Este código de entrega expirou. O comprador deve renová-lo.' end; return next; return; end if;
  if extensions.crypt(apresentado,c.codigo_hash) <> c.codigo_hash then
    v_tentativas:=c.tentativas+1; update public.codigos_entrega set tentativas=v_tentativas,bloqueado_em=case when v_tentativas>=c.max_tentativas then agora else null end,atualizado_por=auth.uid() where id=c.id;
    insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(e.id,'tentativa_entrega_falhou','chegou_destino','chegou_destino','entregador',auth.uid(),jsonb_build_object('atribuicao_id',a.id,'tentativas',v_tentativas));
    validado:=false; estado_encomenda:=e.estado; tentativas_restantes:=greatest(c.max_tentativas-v_tentativas,0); bloqueado:=v_tentativas>=c.max_tentativas; motivo:=case when bloqueado then 'Este código de entrega ficou bloqueado. O comprador deve renová-lo.' else 'Código de entrega inválido.' end; return next; return;
  end if;
  update public.codigos_entrega set usado_em=agora,atualizado_por=auth.uid() where id=c.id;
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(e.id,'codigo_entrega_validado','chegou_destino','chegou_destino','entregador',auth.uid(),jsonb_build_object('atribuicao_id',a.id));
  validado:=true; estado_encomenda:='chegou_destino'; tentativas_restantes:=greatest(c.max_tentativas-c.tentativas,0); bloqueado:=false; motivo:=null; return next;
end;
$$;

create or replace function public.registar_pagamento_na_entrega_entregador(p_atribuicao_id uuid)
returns public.pagamentos language plpgsql security definer set search_path = public as $$
declare a public.atribuicoes_entrega_encomenda%rowtype; e public.encomendas%rowtype; p public.pagamentos%rowtype; t public.tentativas_pagamento%rowtype; codigo_validado boolean;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select a0.* into a from public.atribuicoes_entrega_encomenda a0 join public.parceiros_entrega parceiro on parceiro.id=a0.parceiro_entrega_id where a0.id=p_atribuicao_id and parceiro.user_id=auth.uid() for update;
  if not found then raise exception 'Tarefa não encontrada ou sem permissão.'; end if;
  select * into e from public.encomendas where id=a.encomenda_id for update;
  select * into p from public.pagamentos where encomenda_id=e.id for update;
  if not found then raise exception 'Pagamento não encontrado.'; end if;
  select * into t from public.tentativas_pagamento where pagamento_id=p.id and metodo='pagamento_na_entrega' order by criado_em desc,id desc limit 1 for update;
  if not found then raise exception 'Não existe pagamento na entrega pendente para esta encomenda.'; end if;
  if a.estado='concluida' and e.estado='concluida' and p.estado='confirmado' and t.estado='confirmada' then return p; end if;
  if (a.estado='concluida') <> (e.estado='concluida') then raise exception 'Inconsistência de integridade na conclusão da entrega.'; end if;
  if e.modalidade_recebimento<>'entrega' or a.estado<>'chegou_destino' or e.estado<>'chegou_destino' then raise exception 'O pagamento só pode ser registado depois da chegada ao destino.'; end if;
  select exists(select 1 from public.codigos_entrega c where c.encomenda_id=e.id and c.usado_em is not null) into codigo_validado;
  if not codigo_validado then raise exception 'Valide primeiro o código de entrega antes de registar o pagamento.'; end if;
  if p.estado<>'pendente' or t.estado not in ('criada','pendente') then raise exception 'O pagamento não pode ser confirmado no estado atual.'; end if;
  update public.tentativas_pagamento set estado='confirmada',confirmado_em=now(),metadados=metadados||jsonb_build_object('confirmado_na_entrega_por',auth.uid()) where id=t.id;
  update public.pagamentos set estado='confirmado',confirmado_em=now() where id=p.id returning * into p;
  update public.atribuicoes_entrega_encomenda set estado='concluida',concluido_em=now() where id=a.id;
  update public.encomendas set estado='concluida',concluido_em=now() where id=e.id;
  insert into public.eventos_pagamento(pagamento_id,tentativa_pagamento_id,encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(p.id,t.id,e.id,'pagamento_confirmado','pendente','confirmado','entregador',auth.uid(),jsonb_build_object('metodo','pagamento_na_entrega','atribuicao_id',a.id));
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(e.id,'entrega_confirmada','chegou_destino','concluida','entregador',auth.uid(),jsonb_build_object('atribuicao_id',a.id));
  return p;
end;
$$;

create or replace function public.validar_codigo_levantamento_vendedor(p_encomenda_id uuid,p_codigo text)
returns table(validado boolean,estado_encomenda text,tentativas_restantes smallint,bloqueado boolean,motivo text)
language plpgsql security definer set search_path = public as $$
declare e public.encomendas%rowtype; c public.codigos_levantamento%rowtype; apresentado text:=nullif(btrim(p_codigo),''); agora timestamptz:=now(); v_tentativas smallint;
begin
  if auth.uid() is null then raise exception 'Sessão inválida. Inicie sessão novamente.'; end if;
  if apresentado is null or apresentado !~ '^[0-9]{6}$' then raise exception 'Introduza o código de levantamento de seis dígitos.'; end if;
  select * into e from public.encomendas where id=p_encomenda_id for update; if not found then raise exception 'Encomenda não encontrada.'; end if;
  if not exists(select 1 from public.vendedores v where v.id=e.vendedor_id and v.user_id=auth.uid() and public.vendedor_pode_receber_encomendas(v.id)) then raise exception 'Sem permissão para validar o levantamento desta encomenda.'; end if;
  select * into c from public.codigos_levantamento where encomenda_id=e.id for update;
  if e.estado='concluida' and found and c.usado_em is not null and extensions.crypt(apresentado,c.codigo_hash)=c.codigo_hash then validado:=true;estado_encomenda:='concluida';tentativas_restantes:=greatest(c.max_tentativas-c.tentativas,0);bloqueado:=false;motivo:=null;return next;return; end if;
  if e.modalidade_recebimento<>'levantamento' or e.estado<>'pronta_para_levantamento' then raise exception 'Esta encomenda não está pronta para levantamento.'; end if;
  if not found then validado:=false;estado_encomenda:=e.estado;tentativas_restantes:=0;bloqueado:=false;motivo:='Não existe código de levantamento ativo para esta encomenda.';return next;return; end if;
  if c.usado_em is not null then validado:=extensions.crypt(apresentado,c.codigo_hash)=c.codigo_hash;estado_encomenda:=e.estado;tentativas_restantes:=greatest(c.max_tentativas-c.tentativas,0);bloqueado:=false;motivo:=case when validado then null else 'Este código de levantamento já foi utilizado.' end;return next;return; end if;
  if c.bloqueado_em is not null or c.expira_em<=agora then validado:=false;estado_encomenda:=e.estado;tentativas_restantes:=greatest(c.max_tentativas-c.tentativas,0);bloqueado:=c.bloqueado_em is not null;motivo:=case when bloqueado then 'Este código de levantamento está bloqueado. O cliente deve renová-lo.' else 'Este código de levantamento expirou. O cliente deve renová-lo.' end;return next;return; end if;
  if extensions.crypt(apresentado,c.codigo_hash)<>c.codigo_hash then v_tentativas:=c.tentativas+1;update public.codigos_levantamento set tentativas=v_tentativas,bloqueado_em=case when v_tentativas>=c.max_tentativas then agora else null end,atualizado_por=auth.uid() where id=c.id;insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(e.id,'tentativa_levantamento_falhou','pronta_para_levantamento','pronta_para_levantamento','vendedor',auth.uid(),jsonb_build_object('tentativas',v_tentativas,'bloqueado',v_tentativas>=c.max_tentativas));validado:=false;estado_encomenda:=e.estado;tentativas_restantes:=greatest(c.max_tentativas-v_tentativas,0);bloqueado:=v_tentativas>=c.max_tentativas;motivo:=case when bloqueado then 'Código incorreto. O limite de tentativas foi atingido e o código foi bloqueado.' else 'Código de levantamento incorreto.' end;return next;return;end if;
  update public.codigos_levantamento set usado_em=agora,atualizado_por=auth.uid() where id=c.id;
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(e.id,'codigo_levantamento_validado','pronta_para_levantamento','pronta_para_levantamento','vendedor',auth.uid(),'{}'::jsonb);
  validado:=true;estado_encomenda:='pronta_para_levantamento';tentativas_restantes:=greatest(c.max_tentativas-c.tentativas,0);bloqueado:=false;motivo:=null;return next;
end;
$$;

create or replace function public.registar_pagamento_no_levantamento_vendedor(p_encomenda_id uuid)
returns public.pagamentos language plpgsql security definer set search_path = public as $$
declare e public.encomendas%rowtype; p public.pagamentos%rowtype; t public.tentativas_pagamento%rowtype; codigo_validado boolean;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select * into e from public.encomendas where id=p_encomenda_id for update; if not found then raise exception 'Encomenda não encontrada.'; end if;
  if not exists(select 1 from public.vendedores v where v.id=e.vendedor_id and v.user_id=auth.uid() and public.vendedor_pode_receber_encomendas(v.id)) then raise exception 'Sem permissão para confirmar o pagamento deste levantamento.'; end if;
  select * into p from public.pagamentos where encomenda_id=e.id for update; if not found then raise exception 'Pagamento não encontrado.'; end if;
  select * into t from public.tentativas_pagamento where pagamento_id=p.id and metodo='pagamento_no_levantamento' order by criado_em desc,id desc limit 1 for update; if not found then raise exception 'Não existe pagamento no levantamento pendente para esta encomenda.'; end if;
  if e.estado='concluida' and p.estado='confirmado' and t.estado='confirmada' then return p; end if;
  if e.modalidade_recebimento<>'levantamento' or e.estado<>'pronta_para_levantamento' then raise exception 'O pagamento só pode ser confirmado no levantamento pronto.'; end if;
  select exists(select 1 from public.codigos_levantamento c where c.encomenda_id=e.id and c.usado_em is not null) into codigo_validado;
  if not codigo_validado then raise exception 'Valide primeiro o código de levantamento antes de registar o pagamento.'; end if;
  if p.estado<>'pendente' or t.estado not in ('criada','pendente') then raise exception 'O pagamento não pode ser confirmado no estado atual.'; end if;
  update public.tentativas_pagamento set estado='confirmada',confirmado_em=now(),metadados=metadados||jsonb_build_object('confirmado_no_levantamento_por',auth.uid()) where id=t.id;
  update public.pagamentos set estado='confirmado',confirmado_em=now() where id=p.id returning * into p;
  update public.encomendas set estado='concluida',concluido_em=now() where id=e.id;
  insert into public.eventos_pagamento(pagamento_id,tentativa_pagamento_id,encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(p.id,t.id,e.id,'pagamento_confirmado','pendente','confirmado','vendedor',auth.uid(),jsonb_build_object('metodo','pagamento_no_levantamento'));
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(e.id,'levantamento_confirmado','pronta_para_levantamento','concluida','vendedor',auth.uid(),jsonb_build_object('pagamento_confirmado',true));
  return p;
end;
$$;

create or replace function public.transicionar_encomenda_levantamento(p_encomenda_id uuid,p_proximo_estado text,p_motivo text default null)
returns public.encomendas language plpgsql security definer set search_path = public as $$
declare e public.encomendas%rowtype; anterior text; ator text; evento text; motivo text:=nullif(btrim(p_motivo),'');
begin
 if auth.uid() is null then raise exception 'Sessão inválida. Inicie sessão novamente.'; end if;
 select * into e from public.encomendas where id=p_encomenda_id for update; if not found then raise exception 'Encomenda não encontrada.'; end if;
 if exists(select 1 from public.clientes c where c.id=e.cliente_id and c.id=auth.uid()) then ator:='cliente'; elsif exists(select 1 from public.vendedores v where v.id=e.vendedor_id and v.user_id=auth.uid() and public.vendedor_pode_receber_encomendas(v.id)) then ator:='vendedor'; else raise exception 'Sem permissão para alterar esta encomenda.'; end if;
 if ator='cliente' then if e.estado='aguardando_confirmacao' and p_proximo_estado='cancelada' then if motivo is null or char_length(motivo)<3 or char_length(motivo)>500 then raise exception 'Indique um motivo de cancelamento entre 3 e 500 caracteres.'; end if; evento:='cliente_cancelou'; else raise exception 'Esta transição não é permitida para o cliente.'; end if;
 elsif e.estado='aguardando_confirmacao' and p_proximo_estado='confirmada' then evento:='vendedor_confirmou'; elsif e.estado='aguardando_confirmacao' and p_proximo_estado='recusada' then if motivo is null or char_length(motivo)<3 or char_length(motivo)>500 then raise exception 'Indique um motivo de recusa entre 3 e 500 caracteres.'; end if;evento:='vendedor_recusou'; elsif e.estado='confirmada' and p_proximo_estado='em_preparacao' then evento:='preparacao_iniciada'; elsif e.estado='em_preparacao' and p_proximo_estado='pronta_para_levantamento' then evento:='pronta_para_levantamento'; else raise exception 'Esta transição não é permitida para o vendedor.'; end if;
 anterior:=e.estado; update public.encomendas set estado=p_proximo_estado,motivo_recusa=case when ator='vendedor' and p_proximo_estado='recusada' then motivo else motivo_recusa end,motivo_cancelamento=case when ator='cliente' and p_proximo_estado='cancelada' then motivo else motivo_cancelamento end,confirmado_em=case when p_proximo_estado='confirmada' then now() else confirmado_em end,recusado_em=case when p_proximo_estado='recusada' then now() else recusado_em end,concluido_em=case when p_proximo_estado='concluida' then now() else concluido_em end,cancelado_em=case when p_proximo_estado='cancelada' then now() else cancelado_em end where id=e.id returning * into e;
 insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(e.id,evento,anterior,p_proximo_estado,ator,auth.uid(),case when evento in ('cliente_cancelou','vendedor_recusou') then jsonb_build_object('motivo',motivo) else '{}'::jsonb end); return e;
end;
$$;

create or replace function public.obter_tarefa_entregador(p_atribuicao_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare resultado jsonb;
begin
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 select jsonb_build_object('tarefa',jsonb_build_object('id',a.id,'estado',a.estado,'atribuido_em',a.atribuido_em,'aceite_em',a.aceite_em,'chegou_origem_em',a.chegou_origem_em,'recolhida_em',a.recolhida_em,'chegou_destino_em',a.chegou_destino_em,'concluido_em',a.concluido_em,'recusado_em',a.recusado_em,'motivo_recusa',a.motivo_recusa),'encomenda',jsonb_build_object('id',e.id,'codigo_publico',e.codigo_publico,'estado',e.estado,'modalidade',e.modalidade_recebimento),'veiculo',jsonb_build_object('tipo',v.tipo_veiculo,'matricula',v.matricula),'origem',jsonb_build_object('nome_vendedor',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then ven.nome_comercial end,'telefone',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then coalesce(ven.telefone_whatsapp,ven.whatsapp) end,'provincia',e.provincia,'municipio',e.municipio,'bairro',e.bairro,'endereco',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then e.endereco_levantamento end,'referencia',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then e.ponto_referencia end),'destino',jsonb_build_object('nome',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then d.destinatario_nome end,'telefone',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then d.destinatario_telefone end,'provincia',d.provincia,'municipio',d.municipio,'bairro',d.bairro,'endereco',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then d.endereco_detalhado end,'referencia',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then d.ponto_referencia end,'instrucoes',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then d.instrucoes_entrega end),'itens',coalesce((select jsonb_agg(jsonb_build_object('nome',i.nome_produto_snapshot,'quantidade',i.quantidade,'unidade',i.unidade) order by i.criado_em,i.id) from public.itens_encomenda i where i.encomenda_id=e.id),'[]'::jsonb),'requisitos_logisticos',coalesce((select jsonb_build_object('peso_total_kg',r.peso_total_kg,'peso_total_conhecido',r.peso_total_conhecido,'volume_total_m3',r.volume_total_m3,'volume_total_conhecido',r.volume_total_conhecido,'requer_refrigeracao',r.requer_refrigeracao,'requer_caixa_carga',r.requer_caixa_carga,'requer_paletes',r.requer_paletes) from public.calcular_requisitos_logisticos_encomenda(e.id) r),'{}'::jsonb),'pagamento',coalesce((select jsonb_build_object('metodo',t.metodo,'estado',p.estado,'codigo_entrega_validado',exists(select 1 from public.codigos_entrega c where c.encomenda_id=e.id and c.usado_em is not null)) from public.pagamentos p join public.tentativas_pagamento t on t.pagamento_id=p.id where p.encomenda_id=e.id and t.metodo='pagamento_na_entrega' order by t.criado_em desc,t.id desc limit 1),'{}'::jsonb)) into resultado from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega parceiro on parceiro.id=a.parceiro_entrega_id join public.encomendas e on e.id=a.encomenda_id join public.vendedores ven on ven.id=e.vendedor_id join public.veiculos_entrega v on v.id=a.veiculo_id left join public.enderecos_entrega_encomenda d on d.encomenda_id=e.id where a.id=p_atribuicao_id and parceiro.user_id=auth.uid();
 if resultado is null then raise exception 'Tarefa não encontrada ou sem permissão.'; end if; return resultado;
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
 if a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then return (select jsonb_build_object('atribuicao_id',a2.id,'estado',a2.estado,'atribuido_em',a2.atribuido_em,'aceite_em',a2.aceite_em,'chegou_origem_em',a2.chegou_origem_em,'recolhida_em',a2.recolhida_em,'chegou_destino_em',a2.chegou_destino_em,'concluido_em',a2.concluido_em,'codigo_entrega_validado',exists(select 1 from public.codigos_entrega c where c.encomenda_id=e.id and c.usado_em is not null),'parceiro_entrega_id',p.id,'nome_entregador',p.nome_completo,'veiculo',jsonb_build_object('tipo_veiculo',v.tipo_veiculo,'marca',v.marca,'modelo',v.modelo,'matricula',v.matricula)) from public.atribuicoes_entrega_encomenda a2 join public.parceiros_entrega p on p.id=a2.parceiro_entrega_id join public.veiculos_entrega v on v.id=a2.veiculo_id where a2.id=a.id); end if;
 return jsonb_build_object('atribuicao_id',a.id,'estado',a.estado,'atribuido_em',a.atribuido_em,'recusado_em',a.recusado_em,'motivo_recusa',case when vendedor and a.estado='recusada' then a.motivo_recusa else null end);
end;
$$;

revoke all on function public.obter_estado_levantamento_participante(uuid),public.registar_pagamento_no_levantamento_vendedor(uuid) from public,anon;
grant execute on function public.obter_estado_levantamento_participante(uuid),public.registar_pagamento_no_levantamento_vendedor(uuid) to authenticated;
commit;
