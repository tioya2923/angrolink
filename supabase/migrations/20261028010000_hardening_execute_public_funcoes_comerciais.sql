-- Hardening nominal de EXECUTE. Nao altera corpos, owners, RLS, triggers ou Auth.
-- Contrato fail-closed: fingerprints de pg_get_functiondef sob pg_catalog,
-- normalizando somente CR de CRLF. MD5 identifica divergencia; nao e prova criptografica.
begin;
set local search_path = pg_catalog;

do $hardening$
declare
  contratos constant jsonb := $contratos$[
  {
    "signature": "public.apagar_minha_conta()",
    "definition_md5": "07276043c724bafb9c08ee09e3c82cc9",
    "path": [
      "search_path=public"
    ]
  },
  {
    "signature": "public.criar_pedido_parceiro_entrega(jsonb,jsonb,jsonb,jsonb)",
    "definition_md5": "4f982b1ae6920951dfb92142223753e3",
    "path": [
      "search_path=public"
    ]
  },
  {
    "signature": "public.criar_versao_inicial_documento_parceiro()",
    "definition_md5": "7ae16fb403505baea161a872f2789e53",
    "path": [
      "search_path=public"
    ]
  },
  {
    "signature": "public.desativar_minha_conta()",
    "definition_md5": "99eb4c110f10266b8f8f68086a740e60",
    "path": [
      "search_path=public"
    ]
  },
  {
    "signature": "public.destacar_servico_gratis(uuid)",
    "definition_md5": "8492d6e5e1fe64615da293768376e48d",
    "path": [
      "search_path=public"
    ]
  },
  {
    "signature": "public.expirar_destaques_antigos()",
    "definition_md5": "0bef4592d05d210f170cb19fd498ae1a",
    "path": [
      "search_path=public"
    ]
  },
  {
    "signature": "public.handle_new_user_profile()",
    "definition_md5": "2e69bbd5d67d2fd369ad1d3a3e9cf995",
    "path": [
      "search_path=public"
    ]
  },
  {
    "signature": "public.handle_new_user()",
    "definition_md5": "79b71f8a39aa7be44632c2a315c6958f",
    "path": null
  },
  {
    "signature": "public.incrementar_clique_whatsapp_servico(uuid)",
    "definition_md5": "f16d9124a7673da62e7f88460ee52774",
    "path": [
      "search_path=public"
    ]
  },
  {
    "signature": "public.incrementar_visualizacao_servico(uuid)",
    "definition_md5": "5b658ae153eabf36c5c4c60029aeb316",
    "path": [
      "search_path=public"
    ]
  },
  {
    "signature": "public.is_admin_atual()",
    "definition_md5": "70d2ff1fe84fb95000bb24bdd6188e7b",
    "path": [
      "search_path=public"
    ]
  },
  {
    "signature": "public.is_dono_vendedor(uuid)",
    "definition_md5": "e15f223461ac56797846a89f71ec24c6",
    "path": [
      "search_path=public"
    ]
  },
  {
    "signature": "public.is_vendedor_aprovado(uuid)",
    "definition_md5": "cc2d294719be65e983a947b5c92a7236",
    "path": [
      "search_path=public"
    ]
  },
  {
    "signature": "public.proteger_analise_documento_vendedor()",
    "definition_md5": "b67dc061fab6c0f435f2e612580fc68f",
    "path": [
      "search_path=public"
    ]
  },
  {
    "signature": "public.proteger_campos_vendedor()",
    "definition_md5": "9d7078620775774e0be9bb45b5d28bc8",
    "path": [
      "search_path=public"
    ]
  },
  {
    "signature": "public.proteger_eventos_documento_parceiro()",
    "definition_md5": "ebaa1190199e43515b8ab57f7bcfcab3",
    "path": [
      "search_path=public"
    ]
  },
  {
    "signature": "public.proteger_versao_documento_parceiro()",
    "definition_md5": "f8e5f796467d1e487a83b61566b67d43",
    "path": [
      "search_path=public"
    ]
  },
  {
    "signature": "public.registar_evento_documento_vendedor()",
    "definition_md5": "adbf16e307192aa7f622e1822ffc503b",
    "path": [
      "search_path=public"
    ]
  },
  {
    "signature": "public.remover_destaque_servico(uuid)",
    "definition_md5": "1080b00281a1c02a0af5374865d4df2a",
    "path": [
      "search_path=public"
    ]
  },
  {
    "signature": "public.sincronizar_analise_versao_documento_parceiro()",
    "definition_md5": "8bb9c8e93bdd7a97aae690fc11d4e304",
    "path": [
      "search_path=public"
    ]
  },
  {
    "signature": "public.submeter_pedido_parceiro_entrega(uuid)",
    "definition_md5": "5ec5cfe8c1025d7e2b7872497e089f9a",
    "path": [
      "search_path=public"
    ]
  },
  {
    "signature": "public.validar_veiculo_do_documento_parceiro()",
    "definition_md5": "05f702dd346af5ae0ad40224ee8ebee0",
    "path": [
      "search_path=public"
    ]
  }
]$contratos$::jsonb;
  contrato jsonb;
  estado jsonb;
  estados jsonb := '[]'::jsonb;
  p record;
  oid_funcao oid;
  assinatura text;
  papel text;
  acl_atual aclitem[];
  acl_sem_public jsonb;
  deve_revogar boolean;
  revogadas integer := 0;
  protegidas integer := 0;
begin
  if current_user <> 'postgres' then
    raise exception using errcode='55000', message='Executar o hardening como postgres.';
  end if;

  -- Primeiro validar TODOS os objetos. Nenhum REVOKE antecede este preflight.
  for contrato in select value from jsonb_array_elements(contratos) loop
    assinatura := contrato->>'signature';
    oid_funcao := to_regprocedure(assinatura);
    if oid_funcao is null then
      raise exception using errcode='55000', message='Assinatura ausente no hardening: '||assinatura;
    end if;
    select q.* into strict p from pg_proc q where q.oid=oid_funcao;
    if p.prokind <> 'f' or pg_get_userbyid(p.proowner) <> 'postgres' or not p.prosecdef
      or to_jsonb(p.proconfig) is distinct from nullif(contrato->'path','null'::jsonb)
      or md5(replace(pg_get_functiondef(oid_funcao),chr(13),'')) <> contrato->>'definition_md5' then
      raise exception using errcode='55000', message='Definicao, owner ou atributos divergentes: '||assinatura;
    end if;
    acl_atual := coalesce(p.proacl,acldefault('f',p.proowner));

    -- Contrato auditado: grants diretos destes consumidores devem existir.
    -- Grants adicionais a outros papeis sao aceites e preservados integralmente.
    foreach papel in array array['postgres','anon','authenticated','service_role'] loop
      if to_regrole(papel) is null or not exists(
        select 1 from aclexplode(acl_atual) a
        where a.grantee=to_regrole(papel)::oid and a.privilege_type='EXECUTE'
      ) then
        raise exception using errcode='55000', message='Grant explicito esperado ausente: '||assinatura||' / '||papel;
      end if;
    end loop;
    if exists(select 1 from aclexplode(acl_atual) a where a.grantee=0
      and (a.grantor<>p.proowner or a.privilege_type<>'EXECUTE' or a.is_grantable)) then
      raise exception using errcode='55000', message='ACL PUBLIC divergente: '||assinatura;
    end if;
    select exists(select 1 from aclexplode(acl_atual) a where a.grantee=0 and a.privilege_type='EXECUTE')
      into deve_revogar;
    select coalesce(jsonb_agg(jsonb_build_array(a.grantee,a.grantor,a.privilege_type,a.is_grantable)
      order by a.grantee,a.grantor,a.privilege_type,a.is_grantable),'[]'::jsonb)
      into acl_sem_public from aclexplode(acl_atual) a where a.grantee<>0;
    estados := estados || jsonb_build_array(jsonb_build_object(
      'contract',contrato,'oid',oid_funcao,'revoke',deve_revogar,'acl',acl_sem_public));
  end loop;

  for estado in select value from jsonb_array_elements(estados) loop
    assinatura := estado->'contract'->>'signature';
    if (estado->>'revoke')::boolean then
      execute format('revoke execute on function %s from public',assinatura);
      revogadas := revogadas+1;
    else
      -- Ja protegida: nao regrantar, reparar ou reescrever a ACL.
      protegidas := protegidas+1;
    end if;
  end loop;

  -- Comparacao posterior: apenas PUBLIC pode desaparecer. O resto deve ser igual.
  for estado in select value from jsonb_array_elements(estados) loop
    contrato := estado->'contract';
    assinatura := contrato->>'signature';
    oid_funcao := to_regprocedure(assinatura);
    if oid_funcao is distinct from (estado->>'oid')::oid then
      raise exception using errcode='55000', message='Objeto substituido durante hardening: '||assinatura;
    end if;
    select q.* into strict p from pg_proc q where q.oid=oid_funcao;
    if pg_get_userbyid(p.proowner)<>'postgres' or not p.prosecdef
      or md5(replace(pg_get_functiondef(oid_funcao),chr(13),''))<>contrato->>'definition_md5' then
      raise exception using errcode='55000', message='Contrato mudou durante hardening: '||assinatura;
    end if;
    acl_atual := coalesce(p.proacl,acldefault('f',p.proowner));
    if exists(select 1 from aclexplode(acl_atual) a where a.grantee=0) then
      raise exception using errcode='55000', message='PUBLIC residual: '||assinatura;
    end if;
    select coalesce(jsonb_agg(jsonb_build_array(a.grantee,a.grantor,a.privilege_type,a.is_grantable)
      order by a.grantee,a.grantor,a.privilege_type,a.is_grantable),'[]'::jsonb)
      into acl_sem_public from aclexplode(acl_atual) a where a.grantee<>0;
    if acl_sem_public is distinct from estado->'acl' then
      raise exception using errcode='55000', message='Grant nao PUBLIC alterado: '||assinatura;
    end if;
  end loop;
  raise notice 'HARDENING_EXECUTE: revogadas=%, ja_protegidas=%',revogadas,protegidas;
end
$hardening$;

commit;
