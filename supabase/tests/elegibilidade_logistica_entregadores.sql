-- Testes estruturais da elegibilidade logística; executar após a migration.
-- Não falsifica auth.uid() nem cria dados persistentes.
begin;

do $$
declare
  v_definicao text;
  v_funcao regprocedure;
  v_prosecdef boolean;
  v_proconfig text[];
  v_tabela regclass := 'public.requisitos_documentos_entrega'::regclass;
begin
  if to_regclass('public.requisitos_documentos_entrega') is null then
    raise exception 'Configuração de documentos logísticos ausente';
  end if;
  if not exists (select 1 from pg_class c where c.oid = v_tabela and c.relrowsecurity) then
    raise exception 'RLS ausente na configuração logística';
  end if;

  -- Preserva exatamente a matriz documental já usada no cadastro.
  if not exists (select 1 from public.requisitos_documentos_entrega where escopo='pessoal' and tipo_veiculo='todos' and tipo_documento='bi' and ativo)
    or not exists (select 1 from public.requisitos_documentos_entrega where escopo='veiculo' and tipo_veiculo='mota' and tipo_documento='seguro_automovel' and ativo)
    or not exists (select 1 from public.requisitos_documentos_entrega where escopo='veiculo' and tipo_veiculo='camiao' and tipo_documento='licenca_transporte_mercadorias' and ativo) then
    raise exception 'Matriz documental atual não foi preservada';
  end if;

  -- SECURITY DEFINER e search_path são atributos estruturais de pg_proc.
  -- Não dependemos da serialização textual variável de pg_get_functiondef().
  foreach v_funcao in array array[
    'public.motivos_operacionais_veiculo_entrega(uuid)'::regprocedure,
    'public.veiculo_operacional_para_entregas(uuid)'::regprocedure,
    'public.veiculo_pode_receber_entregas(uuid)'::regprocedure,
    'public.motivos_elegibilidade_entregador(uuid)'::regprocedure,
    'public.entregador_pode_receber_entregas(uuid)'::regprocedure,
    'public.obter_elegibilidade_entregador_admin(uuid)'::regprocedure
  ] loop
    select p.prosecdef, p.proconfig
      into v_prosecdef, v_proconfig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.oid = v_funcao::oid
      and n.nspname = 'public';

    if not found
      or not v_prosecdef
      or not exists (
        select 1
        from unnest(coalesce(v_proconfig, array[]::text[])) configuracao
        where regexp_replace(lower(configuracao), '[[:space:]]+', '', 'g') = 'search_path=public'
      ) then
      raise exception 'Função logística sem contexto seguro: %', v_funcao;
    end if;
  end loop;

  -- A função do veículo não substitui o parceiro: o matching futuro deve usar
  -- a função global, que inclui disponibilidade, documentos pessoais e áreas.
  select pg_get_functiondef('public.motivos_operacionais_veiculo_entrega(uuid)'::regprocedure) into v_definicao;
  if position('disponibilidade' in lower(v_definicao)) > 0 or position('areas_cobertura_entrega' in lower(v_definicao)) > 0 then
    raise exception 'Função operacional do veículo duplicou regras globais';
  end if;
  select pg_get_functiondef('public.motivos_elegibilidade_entregador(uuid)'::regprocedure) into v_definicao;
  if position('disponibilidade' in lower(v_definicao)) = 0
    or position('areas_cobertura_entrega' in lower(v_definicao)) = 0
    or position('escopo = ''pessoal''' in lower(v_definicao)) = 0
    or position('veiculo_operacional_para_entregas' in lower(v_definicao)) = 0
    or position('versao_atual_id' in lower(v_definicao)) = 0
    or position('validade_snapshot' in lower(v_definicao)) = 0
    or position('left join lateral' in lower(v_definicao)) = 0 then
    raise exception 'Elegibilidade global não cobre parceiro, documentos atuais e seleção determinística';
  end if;

  select pg_get_functiondef('public.motivos_operacionais_veiculo_entrega(uuid)'::regprocedure) into v_definicao;
  if position('estado_verificacao' in lower(v_definicao)) = 0
    or position('versao_atual_id' in lower(v_definicao)) = 0
    or position('documento_rejeitado:' in lower(v_definicao)) = 0
    or position('documento_expirado:' in lower(v_definicao)) = 0
    or position('left join lateral' in lower(v_definicao)) = 0 then
    raise exception 'Elegibilidade operacional por veículo incompleta';
  end if;

  select pg_get_functiondef('public.obter_entregador_admin(uuid)'::regprocedure) into v_definicao;
  if position('''historico_documental_disponivel'', true' in lower(v_definicao)) = 0 then
    raise exception 'Histórico documental disponível foi regressado para falso';
  end if;

  select pg_get_functiondef('public.atualizar_requisito_documento_entrega_em()'::regprocedure) into v_definicao;
  if position('new.atualizado_em = now()' in lower(v_definicao)) = 0
    or position('parceiros_entrega.' in lower(v_definicao)) > 0 then
    raise exception 'Trigger de atualizado_em não é genérico para a nova tabela';
  end if;

  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='documentos_parceiro_pessoal_unico_idx')
    or not exists (select 1 from pg_indexes where schemaname='public' and indexname='documentos_parceiro_veiculo_unico_idx') then
    raise exception 'Índices de unicidade documental ausentes';
  end if;

  select pg_get_functiondef('public.obter_elegibilidade_entregador_admin(uuid)'::regprocedure) into v_definicao;
  if position('public.eh_admin()' in lower(v_definicao)) = 0
    or position('frente_path' in lower(v_definicao)) > 0
    or position('verso_path' in lower(v_definicao)) > 0
    or position('foto_veiculo_path' in lower(v_definicao)) > 0 then
    raise exception 'Projeção administrativa expõe media privada ou não exige admin';
  end if;

  if has_function_privilege('anon', 'public.entregador_pode_receber_entregas(uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.entregador_pode_receber_entregas(uuid)', 'execute')
    or has_function_privilege('anon', 'public.obter_elegibilidade_entregador_admin(uuid)', 'execute') then
    raise exception 'Privilégio indevido em função logística';
  end if;
end;
$$;

-- Regressão do erro 22P02: cada motivo individual deve entrar em text[] sem
-- depender da resolução ambígua de `text[] || text`. A fixture é sintética e
-- integralmente revertida; usa apenas um auth.users sem parceiro como FK.
do $$
declare
  v_user_id uuid;
  v_parceiro_id uuid;
  v_motivos text[];
  v_definicao text;
begin
  select u.id into v_user_id
  from auth.users u
  where not exists (
    select 1 from public.parceiros_entrega p where p.user_id = u.id
  )
  order by u.created_at, u.id
  limit 1;

  if v_user_id is null then
    raise exception 'Pré-requisito: é necessário um auth.users de teste sem parceiro para validar os motivos de elegibilidade.';
  end if;

  insert into public.parceiros_entrega (
    user_id, nome_completo, telefone, provincia, municipio,
    contacto_emergencia, estado, disponibilidade
  ) values (
    v_user_id, 'Fixture temporária de elegibilidade',
    '+244900000000', 'Luanda', 'Luanda', '+244900000001',
    'rascunho', false
  ) returning id into v_parceiro_id;

  select public.motivos_elegibilidade_entregador(v_parceiro_id) into v_motivos;
  if not ('parceiro_nao_aprovado' = any(v_motivos))
    or not ('indisponivel' = any(v_motivos))
    or not ('sem_area_ativa' = any(v_motivos)) then
    raise exception 'Motivos individuais da elegibilidade não foram preservados: %', v_motivos;
  end if;
  if public.entregador_pode_receber_entregas(v_parceiro_id) then
    raise exception 'Parceiro indisponível não pode receber entregas.';
  end if;

  foreach v_definicao in array array[
    pg_get_functiondef('public.motivos_operacionais_veiculo_entrega(uuid)'::regprocedure),
    pg_get_functiondef('public.motivos_elegibilidade_entregador(uuid)'::regprocedure),
    pg_get_functiondef('public.avaliar_compatibilidade_veiculo_encomenda(uuid,uuid)'::regprocedure)
  ] loop
    if v_definicao ~* $regex$v_motivos[[:space:]]*:=[[:space:]]*v_motivos[[:space:]]*[|][|]$regex$
      or position('array_append' in lower(v_definicao)) = 0 then
      raise exception 'Função ainda possui concatenação ambígua de motivos.';
    end if;
  end loop;
end;
$$;

rollback;
