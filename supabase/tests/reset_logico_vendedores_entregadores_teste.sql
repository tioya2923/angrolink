-- Simulação reversível do reset lógico de vendedores e parceiros de entrega.
--
-- Não elimina dados, ficheiros, contas Auth, encomendas, pagamentos, documentos
-- nem histórico append-only. Execute apenas numa sessão autenticada de um
-- administrador real da ANGROLINK. O SQL Editor sem contexto JWT não é uma
-- sessão administrativa válida para os triggers de parceiros de entrega.
--
-- Este ficheiro termina sempre com ROLLBACK: não deixa alterações persistentes.

begin;

create temporary table tmp_vendedores_reset_logico on commit drop as
select
  v.id,
  v.user_id
from public.vendedores v;

create temporary table tmp_parceiros_reset_logico on commit drop as
select
  p.id,
  p.user_id
from public.parceiros_entrega p;

create temporary table tmp_utilizadores_reset_logico on commit drop as
select distinct user_id
from (
  select user_id from tmp_vendedores_reset_logico where user_id is not null
  union all
  select user_id from tmp_parceiros_reset_logico
) alvos;

create temporary table tmp_preservacao_reset_logico on commit drop as
select
  (select count(*) from public.profiles where papel = 'admin') as administradores,
  (
    select count(*)
    from public.clientes c
    where not exists (
      select 1
      from tmp_utilizadores_reset_logico u
      where u.user_id = c.id
    )
  ) as clientes_normais,
  (
    select count(*)
    from public.encomendas e
    where e.vendedor_id in (select id from tmp_vendedores_reset_logico)
  ) as encomendas_vendedores,
  (
    select count(*)
    from public.pagamentos pg
    join public.encomendas e on e.id = pg.encomenda_id
    where e.vendedor_id in (select id from tmp_vendedores_reset_logico)
  ) as pagamentos_vendedores,
  (
    select count(*)
    from public.eventos_pagamento ep
    join public.pagamentos pg on pg.id = ep.pagamento_id
    join public.encomendas e on e.id = pg.encomenda_id
    where e.vendedor_id in (select id from tmp_vendedores_reset_logico)
  ) as eventos_pagamento_vendedores,
  (
    select count(*)
    from public.versoes_documento_parceiro_entrega vd
    where vd.parceiro_id in (select id from tmp_parceiros_reset_logico)
  ) as versoes_documentais_parceiros,
  (
    select count(*)
    from public.eventos_documento_parceiro_entrega ed
    where ed.parceiro_id in (select id from tmp_parceiros_reset_logico)
  ) as eventos_documentais_parceiros,
  (
    select count(*)
    from auth.users au
    join tmp_utilizadores_reset_logico u on u.user_id = au.id
  ) as contas_auth_alvo;

do $$
begin
  if not public.eh_admin() then
    raise exception
      'A simulação exige uma sessão autenticada de administrador real; não falsifique auth.uid() nem desative triggers.';
  end if;

  if exists (
    select 1
    from public.profiles pr
    join tmp_utilizadores_reset_logico u on u.user_id = pr.id
    where pr.papel = 'admin'
  ) then
    raise exception 'Os alvos incluem um administrador; interrompido para preservar contas administrativas.';
  end if;
end;
$$;

-- Catálogo: retira os anúncios antigos da experiência pública sem os apagar.
update public.produtos p
set
  publicado = false,
  disponivel = false,
  destaque = false
where p.vendedor_id in (select id from tmp_vendedores_reset_logico);

update public.servicos s
set
  publicado = false,
  disponivel = false,
  destaque = false
where s.vendedor_id in (select id from tmp_vendedores_reset_logico);

-- Conta comercial: suspensa, inativa e inelegível para encomendas novas.
update public.vendedores v
set
  conta_ativa = false,
  status_aprovacao = 'suspenso',
  verificado = false,
  pode_destacar = false
where v.id in (select id from tmp_vendedores_reset_logico);

-- Cobertura e disponibilidade: retiram os parceiros do matching sem apagar
-- veículos, documentos, versões ou o respetivo histórico de análise.
update public.areas_cobertura_entrega a
set ativo = false
where a.parceiro_id in (select id from tmp_parceiros_reset_logico);

update public.parceiros_entrega p
set
  estado = 'suspenso',
  disponibilidade = false
where p.id in (select id from tmp_parceiros_reset_logico);

-- Defesa adicional para eventuais contas multi-papel de teste. Não altera
-- clientes normais; apenas clientes cujo id pertence a um alvo acima.
update public.clientes c
set conta_ativa = false
where c.id in (select user_id from tmp_utilizadores_reset_logico);

-- Profiles/Auth: não elimina Auth. O profile fica logicamente desativado para
-- impedir uso normal; o histórico continua íntegro por conservar o mesmo UUID.
update public.profiles pr
set
  ativo = false,
  apagado_em = coalesce(pr.apagado_em, now())
where pr.id in (select user_id from tmp_utilizadores_reset_logico);

do $$
declare
  v_esperado bigint;
  v_atual bigint;
begin
  select count(*) into v_atual
  from tmp_vendedores_reset_logico v
  where public.vendedor_pode_receber_encomendas(v.id);
  if v_atual <> 0 then
    raise exception 'Reset lógico incompleto: % vendedores-alvo ainda podem receber encomendas.', v_atual;
  end if;

  select count(*) into v_atual
  from public.produtos p
  where p.vendedor_id in (select id from tmp_vendedores_reset_logico)
    and (coalesce(p.publicado, false) or coalesce(p.disponivel, false) or coalesce(p.destaque, false));
  if v_atual <> 0 then
    raise exception 'Reset lógico incompleto: % produtos-alvo continuam públicos, disponíveis ou em destaque.', v_atual;
  end if;

  select count(*) into v_atual
  from public.servicos s
  where s.vendedor_id in (select id from tmp_vendedores_reset_logico)
    and (coalesce(s.publicado, false) or coalesce(s.disponivel, false) or coalesce(s.destaque, false));
  if v_atual <> 0 then
    raise exception 'Reset lógico incompleto: % serviços-alvo continuam públicos, disponíveis ou em destaque.', v_atual;
  end if;

  select count(*) into v_atual
  from tmp_parceiros_reset_logico p
  where public.entregador_pode_receber_entregas(p.id);
  if v_atual <> 0 then
    raise exception 'Reset lógico incompleto: % parceiros-alvo continuam elegíveis para entregas.', v_atual;
  end if;

  select count(*) into v_atual
  from public.areas_cobertura_entrega a
  where a.parceiro_id in (select id from tmp_parceiros_reset_logico)
    and a.ativo;
  if v_atual <> 0 then
    raise exception 'Reset lógico incompleto: % áreas de cobertura-alvo continuam ativas.', v_atual;
  end if;

  select count(*) into v_atual
  from public.veiculos_entrega ve
  join tmp_parceiros_reset_logico p on p.id = ve.parceiro_id
  where public.entregador_pode_receber_entregas(p.id)
    and public.veiculo_operacional_para_entregas(ve.id);
  if v_atual <> 0 then
    raise exception 'Reset lógico incompleto: % veículos-alvo ainda podem ser candidatos logísticos.', v_atual;
  end if;

  select administradores into v_esperado from tmp_preservacao_reset_logico;
  select count(*) into v_atual from public.profiles where papel = 'admin';
  if v_atual <> v_esperado then
    raise exception 'Preservação falhou: contagem de administradores foi alterada.';
  end if;

  select clientes_normais into v_esperado from tmp_preservacao_reset_logico;
  select count(*) into v_atual
  from public.clientes c
  where not exists (
    select 1 from tmp_utilizadores_reset_logico u where u.user_id = c.id
  );
  if v_atual <> v_esperado then
    raise exception 'Preservação falhou: clientes normais foram alterados ou removidos.';
  end if;

  select encomendas_vendedores into v_esperado from tmp_preservacao_reset_logico;
  select count(*) into v_atual
  from public.encomendas e
  where e.vendedor_id in (select id from tmp_vendedores_reset_logico);
  if v_atual <> v_esperado then
    raise exception 'Preservação falhou: encomendas históricas foram alteradas.';
  end if;

  select pagamentos_vendedores into v_esperado from tmp_preservacao_reset_logico;
  select count(*) into v_atual
  from public.pagamentos pg
  join public.encomendas e on e.id = pg.encomenda_id
  where e.vendedor_id in (select id from tmp_vendedores_reset_logico);
  if v_atual <> v_esperado then
    raise exception 'Preservação falhou: pagamentos históricos foram alterados.';
  end if;

  select eventos_pagamento_vendedores into v_esperado from tmp_preservacao_reset_logico;
  select count(*) into v_atual
  from public.eventos_pagamento ep
  join public.pagamentos pg on pg.id = ep.pagamento_id
  join public.encomendas e on e.id = pg.encomenda_id
  where e.vendedor_id in (select id from tmp_vendedores_reset_logico);
  if v_atual <> v_esperado then
    raise exception 'Preservação falhou: eventos de pagamento históricos foram alterados.';
  end if;

  select versoes_documentais_parceiros into v_esperado from tmp_preservacao_reset_logico;
  select count(*) into v_atual
  from public.versoes_documento_parceiro_entrega vd
  where vd.parceiro_id in (select id from tmp_parceiros_reset_logico);
  if v_atual <> v_esperado then
    raise exception 'Preservação falhou: versões documentais foram alteradas.';
  end if;

  select eventos_documentais_parceiros into v_esperado from tmp_preservacao_reset_logico;
  select count(*) into v_atual
  from public.eventos_documento_parceiro_entrega ed
  where ed.parceiro_id in (select id from tmp_parceiros_reset_logico);
  if v_atual <> v_esperado then
    raise exception 'Preservação falhou: eventos documentais foram alterados.';
  end if;

  select contas_auth_alvo into v_esperado from tmp_preservacao_reset_logico;
  select count(*) into v_atual
  from auth.users au
  join tmp_utilizadores_reset_logico u on u.user_id = au.id;
  if v_atual <> v_esperado then
    raise exception 'Preservação falhou: contas Auth foram alteradas.';
  end if;
end;
$$;

rollback;
