-- ANGROLINK — testes estruturais da visibilidade segura de entrega, fase 1.
begin;

do $$
declare
  v_tarefa text;
  v_projecao text;
  v_notificacoes text;
begin
  select pg_get_functiondef('public.obter_tarefa_entregador(uuid)'::regprocedure)
    into v_tarefa;
  select pg_get_functiondef('public.obter_entrega_encomenda_participante(uuid)'::regprocedure)
    into v_projecao;
  select pg_get_functiondef('public.notificar_evento_encomenda()'::regprocedure)
    into v_notificacoes;

  if position('security definer' in lower(v_tarefa)) = 0
    or position('p.user_id = auth.uid()' in lower(v_tarefa)) = 0 then
    raise exception 'Tarefa do parceiro sem autorização server-side';
  end if;

  if position('case when a.estado = ''aceite'' then d.destinatario_nome else null end' in lower(v_tarefa)) = 0
    or position('case when a.estado = ''aceite'' then d.endereco_detalhado else null end' in lower(v_tarefa)) = 0
    or position('case when a.estado = ''aceite'' then d.destinatario_telefone else null end' in lower(v_tarefa)) = 0 then
    raise exception 'Dados privados do destino não estão condicionados ao aceite';
  end if;

  if position('foto_perfil_url' in lower(v_projecao)) > 0
    or position('frente_path' in lower(v_projecao)) > 0
    or position('verso_path' in lower(v_projecao)) > 0
    or position('telefone' in lower(v_projecao)) > 0 then
    raise exception 'Projeção comercial expõe dado privado do entregador';
  end if;

  if position('v_encomenda.cliente_id <> auth.uid() and not v_e_vendedor' in lower(v_projecao)) = 0
    or position('v_atribuicao.estado = ''aceite''' in lower(v_projecao)) = 0 then
    raise exception 'Projeção comercial não protege participantes ou aceite';
  end if;

  foreach v_tarefa in array array['entregador_atribuido', 'entregador_aceitou', 'entregador_recusou'] loop
    if position(v_tarefa in lower(v_notificacoes)) = 0 then
      raise exception 'Notificação ausente para evento %', v_tarefa;
    end if;
  end loop;

  if position('entregador atribuído' in lower(v_notificacoes)) = 0
    or position('entregador aceitou a tarefa' in lower(v_notificacoes)) = 0
    or position('a procurar outro entregador' in lower(v_notificacoes)) = 0 then
    raise exception 'Mensagens de entrega incompletas';
  end if;
end;
$$;

rollback;
