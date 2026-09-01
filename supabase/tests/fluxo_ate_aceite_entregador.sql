-- Executar após aplicar 20260823030000_corrigir_fluxo_atribuicao_e_cobertura_entrega.sql.
-- Teste estrutural: não cria nem altera dados persistentes.
begin;

do $$
declare
  v_atribuicao text;
  v_criar_area text;
  v_atualizar_area text;
  v_remover_area text;
begin
  select pg_get_functiondef('public.atribuir_entregador_encomenda(uuid,uuid,uuid)'::regprocedure)
  into v_atribuicao;
  if position('pronta_para_levantamento' in v_atribuicao) = 0
    or position('A encomenda precisa estar pronta para recolha antes de atribuir um entregador.' in v_atribuicao) = 0
    or position('a.estado in (''atribuida'', ''aceite'')' in v_atribuicao) = 0
    or position('entregador_pode_receber_entregas' in v_atribuicao) = 0
    or position('veiculo_operacional_para_entregas' in v_atribuicao) = 0 then
    raise exception 'A atribuição não aplica todas as salvaguardas operacionais.';
  end if;

  select pg_get_functiondef('public.criar_area_cobertura_entrega(text,text,text)'::regprocedure)
  into v_criar_area;
  select pg_get_functiondef('public.atualizar_area_cobertura_entrega(uuid,text,text,text,boolean)'::regprocedure)
  into v_atualizar_area;
  select pg_get_functiondef('public.remover_area_cobertura_entrega(uuid)'::regprocedure)
  into v_remover_area;

  if position('territorio_angola_valido' in v_criar_area) = 0
    or position('territorio_angola_valido' in v_atualizar_area) = 0
    or position('p.user_id=auth.uid()' in replace(v_atualizar_area, ' ', '')) = 0
    or position('p.user_id=auth.uid()' in replace(v_remover_area, ' ', '')) = 0 then
    raise exception 'Gestão de cobertura sem validação territorial ou titularidade.';
  end if;

  if has_function_privilege('anon', 'public.criar_area_cobertura_entrega(text,text,text)', 'execute')
    or has_function_privilege('anon', 'public.atualizar_area_cobertura_entrega(uuid,text,text,text,boolean)', 'execute')
    or has_function_privilege('anon', 'public.remover_area_cobertura_entrega(uuid)', 'execute') then
    raise exception 'Funções de cobertura expostas a anon.';
  end if;
end;
$$;

rollback;
