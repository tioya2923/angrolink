begin;

-- O detalhe administrativo recebe apenas o identificador opaco da versão
-- atual. Os paths privados continuam exclusivamente no boundary de media.
create or replace function public.listar_documentos_entregador_admin(
  p_parceiro_id uuid,
  p_limite integer default 25,
  p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_limite integer := least(greatest(coalesce(p_limite,25),1),100); v_offset integer := greatest(coalesce(p_offset,0),0);
begin
 if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
 if not exists (select 1 from public.parceiros_entrega where id=p_parceiro_id) then raise exception 'Entregador não encontrado.'; end if;
 return (with base as (
   select d.id,d.tipo_documento,d.numero_documento,d.validade,d.estado,d.veiculo_id,v.matricula as veiculo_matricula,
     d.versao_atual_id,d.frente_path is not null as frente_disponivel,d.verso_path is not null as verso_disponivel,
     d.criado_em,d.atualizado_em,d.analisado_por,d.analisado_em,d.motivo_rejeicao
   from public.documentos_parceiro_entrega d left join public.veiculos_entrega v on v.id=d.veiculo_id where d.parceiro_id=p_parceiro_id
 ), pagina as (select * from base order by criado_em desc,id limit v_limite offset v_offset), itens as (
   select coalesce(jsonb_agg(jsonb_build_object('documento_id',id,'tipo_documento',tipo_documento,'numero_documento',numero_documento,'validade',validade,'estado',estado,'veiculo_id',veiculo_id,'veiculo_matricula',veiculo_matricula,'versao_atual_id',versao_atual_id,'frente_disponivel',frente_disponivel,'verso_disponivel',verso_disponivel,'criado_em',criado_em,'atualizado_em',atualizado_em,'analisado_por',analisado_por,'analisado_em',analisado_em,'motivo_rejeicao',motivo_rejeicao) order by criado_em desc,id),'[]'::jsonb) dados from pagina
 ) select jsonb_build_object('itens',itens.dados,'paginacao',jsonb_build_object('total_resultados',(select count(*) from base),'limite',v_limite,'offset',v_offset)) from itens);
end;
$$;

create or replace function public.obter_entrega_encomenda_participante(p_encomenda_id uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare e public.encomendas%rowtype; a public.atribuicoes_entrega_encomenda%rowtype; vendedor boolean:=false;
begin
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 select * into e from public.encomendas where id=p_encomenda_id; if not found then raise exception 'Encomenda não encontrada.'; end if;
 select exists(select 1 from public.vendedores v where v.id=e.vendedor_id and v.user_id=auth.uid()) into vendedor;
 if e.cliente_id<>auth.uid() and not vendedor then raise exception 'Sem permissão para consultar a entrega.'; end if;
 if e.modalidade_recebimento<>'entrega' then return jsonb_build_object('estado','nao_aplicavel'); end if;
 select * into a from public.atribuicoes_entrega_encomenda where encomenda_id=e.id order by atribuido_em desc,id desc limit 1; if not found then return jsonb_build_object('estado','nao_atribuido'); end if;
 if a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then return (select jsonb_build_object(
   'atribuicao_id',a2.id,'estado',a2.estado,'atribuido_em',a2.atribuido_em,'aceite_em',a2.aceite_em,'chegou_origem_em',a2.chegou_origem_em,'recolhida_em',a2.recolhida_em,'chegou_destino_em',a2.chegou_destino_em,'concluido_em',a2.concluido_em,'codigo_entrega_validado',exists(select 1 from public.codigos_entrega c where c.encomenda_id=e.id and c.usado_em is not null),'parceiro_entrega_id',p.id,'nome_entregador',p.nome_completo,
   'foto_entregador_disponivel',p.foto_perfil_url is not null,'foto_veiculo_disponivel',v.foto_veiculo_path is not null,
   'veiculo',jsonb_build_object('tipo_veiculo',v.tipo_veiculo,'marca',v.marca,'modelo',v.modelo,'matricula',v.matricula))
   from public.atribuicoes_entrega_encomenda a2 join public.parceiros_entrega p on p.id=a2.parceiro_entrega_id join public.veiculos_entrega v on v.id=a2.veiculo_id where a2.id=a.id); end if;
 return jsonb_build_object('atribuicao_id',a.id,'estado',a.estado,'atribuido_em',a.atribuido_em,'recusado_em',a.recusado_em,'motivo_recusa',case when vendedor and a.estado='recusada' then a.motivo_recusa else null end);
end;
$$;

create or replace function public.obter_tarefa_entregador(p_atribuicao_id uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare resultado jsonb; v_visivel boolean;
begin
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 select jsonb_build_object(
  'tarefa',jsonb_build_object('id',a.id,'estado',a.estado,'atribuido_em',a.atribuido_em,'aceite_em',a.aceite_em,'chegou_origem_em',a.chegou_origem_em,'recolhida_em',a.recolhida_em,'chegou_destino_em',a.chegou_destino_em,'concluido_em',a.concluido_em,'recusado_em',a.recusado_em,'motivo_recusa',a.motivo_recusa),
  'encomenda',jsonb_build_object('id',e.id,'codigo_publico',e.codigo_publico,'estado',e.estado,'modalidade',e.modalidade_recebimento),
  'veiculo',jsonb_build_object('tipo',v.tipo_veiculo,'matricula',v.matricula),
  'origem',jsonb_build_object('nome_vendedor',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then ven.nome_comercial end,'foto_url',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then ven.foto_perfil end,'telefone',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then coalesce(ven.telefone_whatsapp,ven.whatsapp) end,'provincia',e.provincia,'municipio',e.municipio,'bairro',e.bairro,'endereco',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then e.endereco_levantamento end,'referencia',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then e.ponto_referencia end),
  'destino',jsonb_build_object('nome',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then d.destinatario_nome end,'foto_url',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then cli.foto_perfil end,'telefone',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then d.destinatario_telefone end,'provincia',d.provincia,'municipio',d.municipio,'bairro',d.bairro,'endereco',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then d.endereco_detalhado end,'referencia',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then d.ponto_referencia end,'instrucoes',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then d.instrucoes_entrega end),
  'itens',coalesce((select jsonb_agg(jsonb_build_object('nome',i.nome_produto_snapshot,'quantidade',i.quantidade,'unidade',i.unidade) order by i.criado_em,i.id) from public.itens_encomenda i where i.encomenda_id=e.id),'[]'::jsonb),
  'requisitos_logisticos',coalesce((select jsonb_build_object('peso_total_kg',r.peso_total_kg,'peso_total_conhecido',r.peso_total_conhecido,'volume_total_m3',r.volume_total_m3,'volume_total_conhecido',r.volume_total_conhecido,'requer_refrigeracao',r.requer_refrigeracao,'requer_caixa_carga',r.requer_caixa_carga,'requer_paletes',r.requer_paletes) from public.calcular_requisitos_logisticos_encomenda(e.id) r),'{}'::jsonb),
  'pagamento',coalesce((select jsonb_build_object('metodo',t.metodo,'estado',p.estado,'codigo_entrega_validado',exists(select 1 from public.codigos_entrega c where c.encomenda_id=e.id and c.usado_em is not null)) from public.pagamentos p join public.tentativas_pagamento t on t.pagamento_id=p.id where p.encomenda_id=e.id and t.metodo='pagamento_na_entrega' order by t.criado_em desc,t.id desc limit 1),'{}'::jsonb)
 ) into resultado from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega parceiro on parceiro.id=a.parceiro_entrega_id join public.encomendas e on e.id=a.encomenda_id join public.vendedores ven on ven.id=e.vendedor_id join public.veiculos_entrega v on v.id=a.veiculo_id left join public.enderecos_entrega_encomenda d on d.encomenda_id=e.id left join public.clientes cli on cli.id=e.cliente_id where a.id=p_atribuicao_id and parceiro.user_id=auth.uid();
 if resultado is null then raise exception 'Tarefa não encontrada ou sem permissão.'; end if; return resultado;
end;
$$;

revoke all on function public.listar_documentos_entregador_admin(uuid,integer,integer), public.obter_entrega_encomenda_participante(uuid), public.obter_tarefa_entregador(uuid) from public, anon;
grant execute on function public.listar_documentos_entregador_admin(uuid,integer,integer), public.obter_entrega_encomenda_participante(uuid), public.obter_tarefa_entregador(uuid) to authenticated;

commit;
