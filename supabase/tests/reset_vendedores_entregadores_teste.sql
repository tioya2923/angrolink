-- RESET CONTROLADO DE TESTE — NÃO EXECUTAR SEM REVER PRIMEIRO A AUDITORIA.
-- Esta primeira versão termina sempre em ROLLBACK e nunca limpa Storage.
-- Não use TRUNCATE, CASCADE, nem desative triggers/constraints.

begin;

create temporary table tmp_vendedores_reset on commit drop as
select id, user_id from public.vendedores;

create temporary table tmp_parceiros_reset on commit drop as
select id, user_id from public.parceiros_entrega;

create temporary table tmp_users_reset on commit drop as
select user_id from tmp_vendedores_reset where user_id is not null
union
select user_id from tmp_parceiros_reset where user_id is not null;

create temporary table tmp_produtos_reset on commit drop as
select id from public.produtos where vendedor_id in (select id from tmp_vendedores_reset);

create temporary table tmp_servicos_reset on commit drop as
select id from public.servicos where vendedor_id in (select id from tmp_vendedores_reset);

create temporary table tmp_encomendas_reset on commit drop as
select e.id
from public.encomendas e
where e.vendedor_id in (select id from tmp_vendedores_reset)
   or e.cliente_id in (select user_id from tmp_users_reset);

-- Bloqueios obrigatórios: o reset não pode violar a arquitetura append-only.
do $$
begin
  if exists (
    select 1 from public.administradores a
    join tmp_users_reset u on u.user_id = a.user_id
  ) then
    raise exception 'RESET BLOQUEADO: existe uma conta alvo que também é administradora.';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.vendedor_id in (select id from tmp_vendedores_reset)
      and p.id not in (select user_id from tmp_users_reset)
  ) then
    raise exception 'RESET BLOQUEADO: profile externo aponta para vendedor alvo.';
  end if;

  if exists (
    select 1 from public.movimentos_financeiros
    where encomenda_id in (select id from tmp_encomendas_reset)
       or vendedor_id in (select id from tmp_vendedores_reset)
       or cliente_id in (select user_id from tmp_users_reset)
  ) then
    raise exception 'RESET BLOQUEADO: movimentos_financeiros é append-only; requer estratégia de ambiente/arquivo aprovada.';
  end if;

  if exists (
    select 1 from public.eventos_pagamento
    where encomenda_id in (select id from tmp_encomendas_reset)
  ) then
    raise exception 'RESET BLOQUEADO: eventos_pagamento é append-only; não pode ser eliminado por este script.';
  end if;

  if exists (
    select 1 from public.versoes_documento_parceiro_entrega
    where parceiro_id in (select id from tmp_parceiros_reset)
  ) or exists (
    select 1 from public.eventos_documento_parceiro_entrega
    where parceiro_id in (select id from tmp_parceiros_reset)
  ) then
    raise exception 'RESET BLOQUEADO: versões/eventos documentais de parceiros são imutáveis/append-only.';
  end if;
end;
$$;

-- Notificações e históricos que mencionam exclusivamente identidades/dados alvo.
delete from public.notificacoes n
where n.utilizador_id in (select user_id from tmp_users_reset)
   or (n.entidade_tipo = 'encomenda' and n.entidade_id in (select id from tmp_encomendas_reset));

delete from public.favoritos
where utilizador_id in (select user_id from tmp_users_reset)
   or vendedor_id in (select id from tmp_vendedores_reset)
   or produto_id in (select id from tmp_produtos_reset)
   or servico_id in (select id from tmp_servicos_reset);

delete from public.visualizacoes_produtos
where cliente_id in (select user_id from tmp_users_reset)
   or vendedor_id in (select id from tmp_vendedores_reset)
   or produto_id in (select id from tmp_produtos_reset);

delete from public.visualizacoes_servicos
where cliente_id in (select user_id from tmp_users_reset)
   or vendedor_id in (select id from tmp_vendedores_reset)
   or servico_id in (select id from tmp_servicos_reset);

delete from public.historico_contactos
where cliente_id in (select user_id from tmp_users_reset)
   or vendedor_id in (select id from tmp_vendedores_reset)
   or produto_id in (select id from tmp_produtos_reset);

delete from public.historico_contactos_servicos
where cliente_id in (select user_id from tmp_users_reset)
   or vendedor_id in (select id from tmp_vendedores_reset)
   or servico_id in (select id from tmp_servicos_reset);

delete from public.historico_pesquisas
where cliente_id in (select user_id from tmp_users_reset);

-- Dependências de encomendas: primeiro filhos, depois pagamentos e encomendas.
delete from public.atribuicoes_entrega_encomenda
where encomenda_id in (select id from tmp_encomendas_reset)
   or parceiro_entrega_id in (select id from tmp_parceiros_reset);

delete from public.reembolsos_pagamento
where encomenda_id in (select id from tmp_encomendas_reset);

delete from public.repasses_vendedor
where encomenda_id in (select id from tmp_encomendas_reset)
   or vendedor_id in (select id from tmp_vendedores_reset);

delete from public.tentativas_pagamento
where pagamento_id in (select id from public.pagamentos where encomenda_id in (select id from tmp_encomendas_reset));

delete from public.pagamentos
where encomenda_id in (select id from tmp_encomendas_reset);

delete from public.disputas_encomenda
where encomenda_id in (select id from tmp_encomendas_reset)
   or vendedor_id in (select id from tmp_vendedores_reset)
   or cliente_id in (select user_id from tmp_users_reset);

delete from public.codigos_levantamento
where encomenda_id in (select id from tmp_encomendas_reset);

delete from public.enderecos_entrega_encomenda
where encomenda_id in (select id from tmp_encomendas_reset);

delete from public.eventos_encomenda
where encomenda_id in (select id from tmp_encomendas_reset);

delete from public.itens_encomenda
where encomenda_id in (select id from tmp_encomendas_reset);

delete from public.encomendas
where id in (select id from tmp_encomendas_reset);

-- Documentos de vendedor e catálogo.
delete from public.documentos_vendedor_eventos
where vendedor_id in (select id from tmp_vendedores_reset);

delete from public.documentos_vendedor
where vendedor_id in (select id from tmp_vendedores_reset);

delete from public.produtos where id in (select id from tmp_produtos_reset);
delete from public.servicos where id in (select id from tmp_servicos_reset);

-- Parceiros sem versões/eventos imutáveis (pré-condição validada acima).
delete from public.documentos_parceiro_entrega
where parceiro_id in (select id from tmp_parceiros_reset);

delete from public.areas_cobertura_entrega
where parceiro_id in (select id from tmp_parceiros_reset);

delete from public.veiculos_entrega
where parceiro_id in (select id from tmp_parceiros_reset);

delete from public.parceiros_entrega where id in (select id from tmp_parceiros_reset);

-- Identidades: clientes secundários, profiles e Auth são sempre as últimas etapas.
delete from public.clientes where id in (select user_id from tmp_users_reset);
delete from public.profiles where id in (select user_id from tmp_users_reset);
delete from public.vendedores where id in (select id from tmp_vendedores_reset);
delete from auth.users where id in (select user_id from tmp_users_reset);

-- Verificações dentro da transação: somente entidades alvo devem chegar a zero.
do $$
begin
  if exists (select 1 from public.vendedores)
    or exists (select 1 from public.parceiros_entrega)
    or exists (select 1 from public.produtos where vendedor_id in (select id from tmp_vendedores_reset))
    or exists (select 1 from public.servicos where vendedor_id in (select id from tmp_vendedores_reset))
    or exists (select 1 from public.veiculos_entrega where parceiro_id in (select id from tmp_parceiros_reset))
    or exists (select 1 from public.areas_cobertura_entrega where parceiro_id in (select id from tmp_parceiros_reset)) then
    raise exception 'RESET INCOMPLETO: restaram dados operacionais alvo.';
  end if;

  if not exists (select 1 from public.administradores)
    or not exists (select 1 from public.categorias)
    or not exists (select 1 from public.provincias_angola)
    or not exists (select 1 from public.municipios_angola)
    or not exists (select 1 from public.configuracoes_financeiras)
    or not exists (select 1 from public.requisitos_documentos_entrega) then
    raise exception 'RESET INSEGURO: uma entidade preservada deixou de existir.';
  end if;
end;
$$;

rollback;
