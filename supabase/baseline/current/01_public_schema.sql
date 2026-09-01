


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."disputas_encomenda" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "encomenda_id" "uuid" NOT NULL,
    "pagamento_id" "uuid",
    "cliente_id" "uuid" NOT NULL,
    "vendedor_id" "uuid" NOT NULL,
    "estado" "text" DEFAULT 'aberta'::"text" NOT NULL,
    "tipo_problema" "text" NOT NULL,
    "descricao" "text" NOT NULL,
    "valor_reclamado_centimos" bigint,
    "decisao" "text",
    "observacao_resolucao" "text",
    "resolvido_em" timestamp with time zone,
    "resolvido_por" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "analisado_por" "uuid",
    "analisado_em" timestamp with time zone,
    CONSTRAINT "disputas_decisao_apenas_resolvida" CHECK (((("estado" = ANY (ARRAY['resolvida_sem_reembolso'::"text", 'resolvida_reembolso_parcial'::"text", 'resolvida_reembolso_total'::"text"])) AND ("resolvido_em" IS NOT NULL)) OR (("estado" <> ALL (ARRAY['resolvida_sem_reembolso'::"text", 'resolvida_reembolso_parcial'::"text", 'resolvida_reembolso_total'::"text"])) AND ("resolvido_em" IS NULL)))),
    CONSTRAINT "disputas_encomenda_descricao_check" CHECK ((("char_length"("btrim"("descricao")) >= 3) AND ("char_length"("btrim"("descricao")) <= 1000))),
    CONSTRAINT "disputas_encomenda_estado_check" CHECK (("estado" = ANY (ARRAY['aberta'::"text", 'em_analise'::"text", 'resolvida_sem_reembolso'::"text", 'resolvida_reembolso_parcial'::"text", 'resolvida_reembolso_total'::"text", 'cancelada'::"text"]))),
    CONSTRAINT "disputas_encomenda_tipo_problema_check" CHECK (("tipo_problema" = ANY (ARRAY['produto_danificado'::"text", 'produto_incorreto'::"text", 'quantidade_incorreta'::"text", 'qualidade_inadequada'::"text", 'produto_em_falta'::"text", 'outro'::"text"]))),
    CONSTRAINT "disputas_encomenda_valor_reclamado_centimos_check" CHECK ((("valor_reclamado_centimos" IS NULL) OR ("valor_reclamado_centimos" >= 0)))
);


ALTER TABLE "public"."disputas_encomenda" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."abrir_disputa_encomenda"("p_encomenda_id" "uuid", "p_tipo_problema" "text", "p_descricao" "text", "p_valor_reclamado_centimos" bigint DEFAULT NULL::bigint) RETURNS "public"."disputas_encomenda"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_encomenda public.encomendas%rowtype;
  v_pagamento_id uuid;
  v_config public.configuracoes_financeiras%rowtype;
  v_tipo text := lower(btrim(coalesce(p_tipo_problema, '')));
  v_descricao text := nullif(btrim(p_descricao), '');
  v_disputa public.disputas_encomenda%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão para reportar um problema.';
  end if;
  if v_tipo not in ('produto_danificado', 'produto_incorreto', 'quantidade_incorreta', 'qualidade_inadequada', 'produto_em_falta', 'outro') then
    raise exception 'Indique um tipo de problema válido.';
  end if;
  if v_descricao is null or char_length(v_descricao) < 3 or char_length(v_descricao) > 1000 then
    raise exception 'Descreva o problema entre 3 e 1000 caracteres.';
  end if;
  if p_valor_reclamado_centimos is not null and p_valor_reclamado_centimos < 0 then
    raise exception 'O valor reclamado não pode ser negativo.';
  end if;

  select * into v_encomenda
  from public.encomendas
  where id = p_encomenda_id and cliente_id = auth.uid()
  for update;
  if not found then
    raise exception 'Encomenda não encontrada ou sem permissão para reportar um problema.';
  end if;

  if v_encomenda.estado = 'levantada' then
    null;
  elsif v_encomenda.estado = 'concluida' then
    select * into v_config from public.configuracoes_financeiras
    where chave = 'padrao' and ativo = true
    for share;
    if not found then
      raise exception 'A configuração de reclamações não está disponível.';
    end if;
    if v_encomenda.concluido_em is null
      or now() > v_encomenda.concluido_em + make_interval(hours => v_config.prazo_reclamacao_horas) then
      raise exception 'O prazo para reportar problema nesta encomenda terminou.';
    end if;
  else
    raise exception 'Só é possível reportar problema após o levantamento da encomenda.';
  end if;

  select p.id into v_pagamento_id
  from public.pagamentos p
  where p.encomenda_id = v_encomenda.id;

  begin
    insert into public.disputas_encomenda (
      encomenda_id, pagamento_id, cliente_id, vendedor_id,
      tipo_problema, descricao, valor_reclamado_centimos
    ) values (
      v_encomenda.id, v_pagamento_id, v_encomenda.cliente_id, v_encomenda.vendedor_id,
      v_tipo, v_descricao, p_valor_reclamado_centimos
    ) returning * into v_disputa;
  exception when unique_violation then
    raise exception 'Já existe um problema em análise para esta encomenda.';
  end;

  insert into public.eventos_encomenda (
    encomenda_id, tipo_evento, estado_anterior, estado_novo,
    ator_tipo, utilizador_id, metadados
  ) values (
    v_encomenda.id, 'problema_reportado', v_encomenda.estado, v_encomenda.estado,
    'cliente', auth.uid(), jsonb_build_object('tipo_problema', v_disputa.tipo_problema)
  );

  return v_disputa;
end;
$$;


ALTER FUNCTION "public"."abrir_disputa_encomenda"("p_encomenda_id" "uuid", "p_tipo_problema" "text", "p_descricao" "text", "p_valor_reclamado_centimos" bigint) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."atribuicoes_entrega_encomenda" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "encomenda_id" "uuid" NOT NULL,
    "parceiro_entrega_id" "uuid" NOT NULL,
    "veiculo_id" "uuid" NOT NULL,
    "estado" "text" DEFAULT 'atribuida'::"text" NOT NULL,
    "atribuido_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atribuido_por" "uuid" NOT NULL,
    "aceite_em" timestamp with time zone,
    "recusado_em" timestamp with time zone,
    "cancelado_em" timestamp with time zone,
    "concluido_em" timestamp with time zone,
    "motivo_recusa" "text",
    "motivo_cancelamento" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "chegou_origem_em" timestamp with time zone,
    "recolhida_em" timestamp with time zone,
    "chegou_destino_em" timestamp with time zone,
    CONSTRAINT "atribuicao_entrega_marcos_consistentes" CHECK (((("estado" <> 'aceite'::"text") OR ("aceite_em" IS NOT NULL)) AND (("estado" <> 'chegou_origem'::"text") OR (("aceite_em" IS NOT NULL) AND ("chegou_origem_em" IS NOT NULL))) AND (("estado" <> 'recolhida'::"text") OR (("aceite_em" IS NOT NULL) AND ("chegou_origem_em" IS NOT NULL) AND ("recolhida_em" IS NOT NULL))) AND (("estado" <> 'chegou_destino'::"text") OR (("aceite_em" IS NOT NULL) AND ("chegou_origem_em" IS NOT NULL) AND ("recolhida_em" IS NOT NULL) AND ("chegou_destino_em" IS NOT NULL))) AND (("estado" <> 'recusada'::"text") OR ("recusado_em" IS NOT NULL)) AND (("estado" <> 'cancelada'::"text") OR ("cancelado_em" IS NOT NULL)) AND (("estado" <> 'concluida'::"text") OR (("aceite_em" IS NOT NULL) AND ("chegou_origem_em" IS NOT NULL) AND ("recolhida_em" IS NOT NULL) AND ("chegou_destino_em" IS NOT NULL) AND ("concluido_em" IS NOT NULL))))),
    CONSTRAINT "atribuicoes_entrega_encomenda_estado_check" CHECK (("estado" = ANY (ARRAY['atribuida'::"text", 'aceite'::"text", 'chegou_origem'::"text", 'recolhida'::"text", 'chegou_destino'::"text", 'recusada'::"text", 'cancelada'::"text", 'concluida'::"text"])))
);


ALTER TABLE "public"."atribuicoes_entrega_encomenda" OWNER TO "postgres";


COMMENT ON TABLE "public"."atribuicoes_entrega_encomenda" IS 'Histórico transacional de atribuições de entrega. V1 cria apenas atribuições administrativas; transições futuras terão RPCs próprias.';



CREATE OR REPLACE FUNCTION "public"."aceitar_atribuicao_entrega"("p_atribuicao_id" "uuid") RETURNS "public"."atribuicoes_entrega_encomenda"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."aceitar_atribuicao_entrega"("p_atribuicao_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apagar_minha_conta"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  user_id uuid;
begin
  user_id := auth.uid();

  if user_id is null then
    raise exception 'Utilizador não autenticado';
  end if;

  delete from public.historico_contactos
  where cliente_id = user_id;

  delete from public.historico_contactos_servicos
  where cliente_id = user_id;

  delete from public.visualizacoes_produtos
  where cliente_id = user_id;

  delete from public.visualizacoes_servicos
  where cliente_id = user_id;

  delete from public.historico_pesquisas
  where cliente_id = user_id;

  delete from public.clientes
  where id = user_id;

  delete from public.profiles
  where id = user_id;

  delete from auth.users
  where id = user_id;
end;
$$;


ALTER FUNCTION "public"."apagar_minha_conta"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assumir_disputa_admin"("p_disputa_id" "uuid") RETURNS "public"."disputas_encomenda"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_disputa public.disputas_encomenda%rowtype;
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  select * into v_disputa from public.disputas_encomenda where id = p_disputa_id for update;
  if not found then raise exception 'Disputa não encontrada.'; end if;
  if v_disputa.estado <> 'aberta' then raise exception 'A disputa já não pode ser assumida.'; end if;

  update public.disputas_encomenda
  set estado = 'em_analise', analisado_por = auth.uid(), analisado_em = now()
  where id = v_disputa.id returning * into v_disputa;

  insert into public.auditoria_administrativa(
    admin_user_id, entidade_tipo, entidade_id, acao, estado_anterior, estado_novo
  ) values (auth.uid(), 'disputa', v_disputa.id, 'disputa_assumida', 'aberta', 'em_analise');
  return v_disputa;
end;
$$;


ALTER FUNCTION "public"."assumir_disputa_admin"("p_disputa_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atribuir_entregador_encomenda"("p_encomenda_id" "uuid", "p_parceiro_id" "uuid", "p_veiculo_id" "uuid") RETURNS "public"."atribuicoes_entrega_encomenda"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."atribuir_entregador_encomenda"("p_encomenda_id" "uuid", "p_parceiro_id" "uuid", "p_veiculo_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."areas_cobertura_entrega" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parceiro_id" "uuid" NOT NULL,
    "provincia" "text" NOT NULL,
    "municipio" "text" NOT NULL,
    "bairro" "text",
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."areas_cobertura_entrega" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_area_cobertura_entrega"("p_area_id" "uuid", "p_provincia" "text", "p_municipio" "text", "p_bairro" "text" DEFAULT NULL::"text", "p_ativo" boolean DEFAULT true) RETURNS "public"."areas_cobertura_entrega"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_area public.areas_cobertura_entrega%rowtype;
begin
  if not public.territorio_angola_valido(p_provincia, p_municipio) then raise exception 'Selecione uma província e um município válidos.'; end if;
  update public.areas_cobertura_entrega a set provincia=btrim(p_provincia),municipio=btrim(p_municipio),bairro=nullif(btrim(p_bairro),''),ativo=p_ativo
  where a.id=p_area_id and exists(select 1 from public.parceiros_entrega p where p.id=a.parceiro_id and p.user_id=auth.uid()) returning * into v_area;
  if v_area is null then raise exception 'Área de cobertura não encontrada ou sem permissão.'; end if;
  return v_area;
end; $$;


ALTER FUNCTION "public"."atualizar_area_cobertura_entrega"("p_area_id" "uuid", "p_provincia" "text", "p_municipio" "text", "p_bairro" "text", "p_ativo" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_atualizado_em_atribuicao_entrega"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin new.atualizado_em = now(); return new; end;
$$;


ALTER FUNCTION "public"."atualizar_atualizado_em_atribuicao_entrega"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_atualizado_em_codigo_entrega"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin new.atualizado_em = now(); return new; end;
$$;


ALTER FUNCTION "public"."atualizar_atualizado_em_codigo_entrega"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_atualizado_em_codigo_levantamento"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."atualizar_atualizado_em_codigo_levantamento"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_atualizado_em_documentos_vendedor"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."atualizar_atualizado_em_documentos_vendedor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_atualizado_em_encomenda"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."atualizar_atualizado_em_encomenda"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_atualizado_em_financeiro"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin new.atualizado_em = now(); return new; end;
$$;


ALTER FUNCTION "public"."atualizar_atualizado_em_financeiro"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_atualizado_em_incidente_operacional_entrega"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin new.atualizado_em = now(); return new; end;
$$;


ALTER FUNCTION "public"."atualizar_atualizado_em_incidente_operacional_entrega"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_atualizado_em_parceiros_entrega"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."atualizar_atualizado_em_parceiros_entrega"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_atualizado_em_taxonomia_territorial"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."atualizar_atualizado_em_taxonomia_territorial"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_estado_vendedor_admin"("p_vendedor_id" "uuid", "p_estado" "text", "p_motivo_rejeicao" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ begin if not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if; if p_estado not in ('pendente','aprovado','rejeitado','suspenso') then raise exception 'Estado de vendedor inválido.'; end if; if p_estado='rejeitado' and nullif(btrim(p_motivo_rejeicao),'') is null then raise exception 'Indique o motivo da rejeição.'; end if; update public.vendedores set status_aprovacao=p_estado,aprovado_em=case when p_estado='aprovado' then now() else aprovado_em end,aprovado_por=case when p_estado='aprovado' then auth.uid() else aprovado_por end,motivo_rejeicao=case when p_estado='rejeitado' then btrim(p_motivo_rejeicao) else null end,verificado=case when p_estado in ('rejeitado','suspenso') then false else verificado end,pode_destacar=case when p_estado in ('rejeitado','suspenso') then false else pode_destacar end,atualizado_em=now() where id=p_vendedor_id; if not found then raise exception 'Vendedor não encontrado.'; end if; end $$;


ALTER FUNCTION "public"."atualizar_estado_vendedor_admin"("p_vendedor_id" "uuid", "p_estado" "text", "p_motivo_rejeicao" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_plano_vendedor_admin"("p_vendedor_id" "uuid", "p_plano" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ begin if not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if; if p_plano not in ('gratuito','destaque','premium') then raise exception 'Plano de vendedor inválido.'; end if; update public.vendedores set plano=p_plano,atualizado_em=now() where id=p_vendedor_id; if not found then raise exception 'Vendedor não encontrado.'; end if; end $$;


ALTER FUNCTION "public"."atualizar_plano_vendedor_admin"("p_vendedor_id" "uuid", "p_plano" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_requisito_documento_entrega_em"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."atualizar_requisito_documento_entrega_em"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_verificacao_vendedor_admin"("p_vendedor_id" "uuid", "p_verificado" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ begin if not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if; if p_verificado and not exists (select 1 from public.vendedores where id=p_vendedor_id and status_aprovacao='aprovado' and coalesce(conta_ativa,false)=true) then raise exception 'Apenas vendedores aprovados e ativos podem ser verificados.'; end if; update public.vendedores set verificado=p_verificado,atualizado_em=now() where id=p_vendedor_id; if not found then raise exception 'Vendedor não encontrado.'; end if; end $$;


ALTER FUNCTION "public"."atualizar_verificacao_vendedor_admin"("p_vendedor_id" "uuid", "p_verificado" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."avaliar_compatibilidade_veiculo_encomenda"("p_veiculo_id" "uuid", "p_encomenda_id" "uuid") RETURNS TABLE("estado" "text", "motivos" "text"[])
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_encomenda public.encomendas%rowtype;
  v_destino public.enderecos_entrega_encomenda%rowtype;
  v_veiculo public.veiculos_entrega%rowtype;
  v_requisitos record;
  v_motivos text[] := array[]::text[];
  v_destino_canonico boolean;
  v_cobertura boolean;
begin
  select * into v_encomenda from public.encomendas where id = p_encomenda_id;
  if not found then return query select 'incompativel'::text, array['encomenda_inexistente']::text[]; return; end if;
  if v_encomenda.modalidade_recebimento <> 'entrega' then return query select 'incompativel'::text, array['modalidade_nao_e_entrega']::text[]; return; end if;
  select * into v_destino from public.enderecos_entrega_encomenda where encomenda_id = p_encomenda_id;
  if not found then return query select 'dados_incompletos'::text, array['destino_ausente']::text[]; return; end if;
  select * into v_veiculo from public.veiculos_entrega where id = p_veiculo_id;
  if not found then return query select 'incompativel'::text, array['veiculo_inexistente']::text[]; return; end if;

  if not public.entregador_pode_receber_entregas(v_veiculo.parceiro_id) then v_motivos := array_append(v_motivos, 'entregador_nao_elegivel'); end if;
  if not public.veiculo_operacional_para_entregas(v_veiculo.id) then v_motivos := array_append(v_motivos, 'veiculo_nao_operacional'); end if;
  select * into v_requisitos from public.calcular_requisitos_logisticos_encomenda(p_encomenda_id);

  if not v_requisitos.peso_total_conhecido then
    v_motivos := array_append(v_motivos, 'peso_carga_desconhecido');
  elsif v_veiculo.capacidade_kg is null then
    v_motivos := array_append(v_motivos, 'capacidade_peso_veiculo_desconhecida');
  elsif v_requisitos.peso_total_kg > v_veiculo.capacidade_kg then
    v_motivos := array_append(v_motivos, 'capacidade_peso_insuficiente');
  end if;
  if not v_requisitos.volume_total_conhecido then
    v_motivos := array_append(v_motivos, 'volume_carga_desconhecido');
  elsif v_veiculo.capacidade_volume_m3 is null then
    v_motivos := array_append(v_motivos, 'capacidade_volume_veiculo_desconhecida');
  elsif v_requisitos.volume_total_m3 > v_veiculo.capacidade_volume_m3 then
    v_motivos := array_append(v_motivos, 'capacidade_volume_insuficiente');
  end if;
  if not v_requisitos.requisitos_especiais_conhecidos then v_motivos := array_append(v_motivos, 'requisitos_especiais_desconhecidos'); end if;
  if v_requisitos.requer_refrigeracao is true and v_veiculo.possui_refrigeracao is not true then v_motivos := array_append(v_motivos, 'refrigeracao_indisponivel'); end if;
  if v_requisitos.requer_caixa_carga is true and v_veiculo.possui_caixa_carga is not true then v_motivos := array_append(v_motivos, 'caixa_carga_indisponivel'); end if;
  if v_requisitos.requer_paletes is true and v_veiculo.aceita_paletes is not true then v_motivos := array_append(v_motivos, 'paletes_nao_suportadas'); end if;

  select public.territorio_angola_valido(v_destino.provincia, v_destino.municipio) into v_destino_canonico;
  if not v_destino_canonico then
    v_motivos := array_append(v_motivos, 'destino_territorial_invalido');
  else
    select exists (
      select 1 from public.areas_cobertura_entrega a
      where a.parceiro_id = v_veiculo.parceiro_id and a.ativo
        and public.normalizar_texto_territorial(a.provincia) = public.normalizar_texto_territorial(v_destino.provincia)
        and public.normalizar_texto_territorial(a.municipio) = public.normalizar_texto_territorial(v_destino.municipio)
        and (nullif(btrim(a.bairro), '') is null or public.normalizar_texto_territorial(a.bairro) = public.normalizar_texto_territorial(v_destino.bairro))
    ) into v_cobertura;
    if not v_cobertura then v_motivos := array_append(v_motivos, 'fora_area_cobertura'); end if;
  end if;

  select coalesce(array_agg(distinct motivo order by motivo), array[]::text[]) into v_motivos from unnest(v_motivos) as motivo;
  if cardinality(v_motivos) = 0 then
    return query select 'compativel'::text, v_motivos;
  elsif v_motivos && array['entregador_nao_elegivel', 'veiculo_nao_operacional', 'capacidade_peso_insuficiente', 'capacidade_volume_insuficiente', 'refrigeracao_indisponivel', 'caixa_carga_indisponivel', 'paletes_nao_suportadas', 'fora_area_cobertura']::text[] then
    return query select 'incompativel'::text, v_motivos;
  elsif v_motivos && array['destino_ausente', 'peso_carga_desconhecido', 'capacidade_peso_veiculo_desconhecida', 'volume_carga_desconhecido', 'capacidade_volume_veiculo_desconhecida', 'requisitos_especiais_desconhecidos', 'destino_territorial_invalido']::text[] then
    return query select 'dados_incompletos'::text, v_motivos;
  else
    return query select 'incompativel'::text, v_motivos;
  end if;
end;
$$;


ALTER FUNCTION "public"."avaliar_compatibilidade_veiculo_encomenda"("p_veiculo_id" "uuid", "p_encomenda_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."avaliar_compatibilidade_veiculo_encomenda"("p_veiculo_id" "uuid", "p_encomenda_id" "uuid") IS 'Avaliação interna determinística de veículo × encomenda. Desconhecido não equivale a zero ou falso; não atribui, reserva nem tarifa entregas.';



CREATE OR REPLACE FUNCTION "public"."bloquear_conclusao_com_disputa_ativa"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if old.estado = 'levantada'
    and new.estado = 'concluida'
    and public.encomenda_tem_disputa_ativa(old.id) then
    raise exception 'A encomenda possui um problema em análise e não pode ser concluída.';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."bloquear_conclusao_com_disputa_ativa"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcular_hash_intencao_checkout"("p_intencao" "jsonb") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select encode(extensions.digest(convert_to(p_intencao::text, 'UTF8'), 'sha256'), 'hex');
$$;


ALTER FUNCTION "public"."calcular_hash_intencao_checkout"("p_intencao" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcular_requisitos_logisticos_encomenda"("p_encomenda_id" "uuid") RETURNS TABLE("peso_total_kg" numeric, "peso_total_conhecido" boolean, "volume_total_m3" numeric, "volume_total_conhecido" boolean, "requer_refrigeracao" boolean, "requer_caixa_carga" boolean, "requer_paletes" boolean, "requisitos_especiais_conhecidos" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with itens as (
    select
      i.quantidade,
      i.unidade,
      i.peso_por_unidade_comercial_kg_snapshot,
      i.volume_por_unidade_comercial_m3_snapshot,
      i.requer_refrigeracao_snapshot,
      i.requer_caixa_carga_snapshot,
      i.requer_paletes_snapshot,
      case
        when lower(btrim(i.unidade)) = 'kg' then i.quantidade
        when i.peso_por_unidade_comercial_kg_snapshot is not null
          then i.quantidade * i.peso_por_unidade_comercial_kg_snapshot
        else null
      end as peso_item_kg,
      case
        when i.volume_por_unidade_comercial_m3_snapshot is not null
          then i.quantidade * i.volume_por_unidade_comercial_m3_snapshot
        else null
      end as volume_item_m3
    from public.itens_encomenda i
    where i.encomenda_id = p_encomenda_id
  )
  select
    case when count(*) > 0 and count(peso_item_kg) = count(*) then sum(peso_item_kg) else null end,
    count(*) > 0 and count(peso_item_kg) = count(*),
    case when count(*) > 0 and count(volume_item_m3) = count(*) then sum(volume_item_m3) else null end,
    count(*) > 0 and count(volume_item_m3) = count(*),
    case
      when bool_or(requer_refrigeracao_snapshot is true) then true
      when count(*) = 0 or count(*) filter (where requer_refrigeracao_snapshot is null) > 0 then null
      else false
    end,
    case
      when bool_or(requer_caixa_carga_snapshot is true) then true
      when count(*) = 0 or count(*) filter (where requer_caixa_carga_snapshot is null) > 0 then null
      else false
    end,
    case
      when bool_or(requer_paletes_snapshot is true) then true
      when count(*) = 0 or count(*) filter (where requer_paletes_snapshot is null) > 0 then null
      else false
    end,
    count(*) > 0
      and count(*) filter (where requer_refrigeracao_snapshot is null) = 0
      and count(*) filter (where requer_caixa_carga_snapshot is null) = 0
      and count(*) filter (where requer_paletes_snapshot is null) = 0
  from itens;
$$;


ALTER FUNCTION "public"."calcular_requisitos_logisticos_encomenda"("p_encomenda_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calcular_requisitos_logisticos_encomenda"("p_encomenda_id" "uuid") IS 'Agregado interno de carga. Matching automático futuro deve rejeitar peso_total_conhecido=false, volume_total_conhecido=false ou requisitos_especiais_conhecidos=false; desconhecido não significa requisito zero.';



CREATE OR REPLACE FUNCTION "public"."calcular_valores_financeiros_efetivos"("p_pagamento_id" "uuid") RETURNS TABLE("pagamento_id" "uuid", "base_comissionavel_centimos" bigint, "reembolsos_produtos_centimos" bigint, "comissao_efetiva_centimos" bigint, "valor_vendedor_efetivo_centimos" bigint, "valor_logistica_efetivo_centimos" bigint, "reembolso_total_aprovado_centimos" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with pagamento as (
    select p.*, e.estado as estado_encomenda
    from public.pagamentos p join public.encomendas e on e.id = p.encomenda_id
    where p.id = p_pagamento_id
  ), reembolsos as (
    select r.pagamento_id,
      coalesce(sum(r.valor_produtos_aprovado_centimos) filter (where r.estado in ('aprovado', 'processando', 'concluido')), 0)::bigint as produtos,
      coalesce(sum(r.valor_entrega_aprovado_centimos) filter (where r.estado in ('aprovado', 'processando', 'concluido')), 0)::bigint as entrega,
      coalesce(sum(r.valor_aprovado_centimos) filter (where r.estado in ('aprovado', 'processando', 'concluido')), 0)::bigint as total
    from public.reembolsos_pagamento r where r.pagamento_id = p_pagamento_id group by r.pagamento_id
  ), valores as (
    select p.*, coalesce(r.produtos, 0) as produtos_reembolsados, coalesce(r.entrega, 0) as entrega_reembolsada, coalesce(r.total, 0) as total_reembolsado,
      case when p.estado_encomenda in ('cancelada', 'recusada') then 0 else p.subtotal_centimos - p.desconto_centimos - coalesce(r.produtos, 0) end as base_efetiva
    from pagamento p left join reembolsos r on r.pagamento_id = p.id
  )
  select id, base_efetiva, produtos_reembolsados,
    (base_efetiva * comissao_bps_snapshot + 5000) / 10000,
    base_efetiva - ((base_efetiva * comissao_bps_snapshot + 5000) / 10000),
    case when estado_encomenda in ('cancelada', 'recusada') then 0 else valor_logistica_centimos - entrega_reembolsada end,
    total_reembolsado
  from valores;
$$;


ALTER FUNCTION "public"."calcular_valores_financeiros_efetivos"("p_pagamento_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirmar_chegada_destino_entregador"("p_atribuicao_id" "uuid") RETURNS "public"."atribuicoes_entrega_encomenda"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_atribuicao public.atribuicoes_entrega_encomenda%rowtype; v_encomenda public.encomendas%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select a.* into v_atribuicao from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id where a.id=p_atribuicao_id and p.user_id=auth.uid() for update;
  if not found then raise exception 'Tarefa não encontrada ou sem permissão.'; end if;
  select * into v_encomenda from public.encomendas where id=v_atribuicao.encomenda_id for update;
  if v_atribuicao.estado='chegou_destino' and v_encomenda.estado='chegou_destino' then return v_atribuicao; end if;
  if (v_atribuicao.estado='chegou_destino') <> (v_encomenda.estado='chegou_destino') then raise exception 'Inconsistência de integridade na chegada ao destino.'; end if;
  if v_encomenda.modalidade_recebimento <> 'entrega' or v_atribuicao.estado <> 'recolhida' or v_encomenda.estado <> 'recolhida' then raise exception 'A chegada ao destino não pode ser confirmada no estado atual.'; end if;
  update public.atribuicoes_entrega_encomenda set estado='chegou_destino',chegou_destino_em=now() where id=v_atribuicao.id returning * into v_atribuicao;
  update public.encomendas set estado='chegou_destino' where id=v_encomenda.id;
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(v_encomenda.id,'entregador_chegou_destino','recolhida','chegou_destino','entregador',auth.uid(),jsonb_build_object('atribuicao_id',v_atribuicao.id));
  return v_atribuicao;
end;
$$;


ALTER FUNCTION "public"."confirmar_chegada_destino_entregador"("p_atribuicao_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirmar_chegada_origem_entregador"("p_atribuicao_id" "uuid") RETURNS "public"."atribuicoes_entrega_encomenda"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."confirmar_chegada_origem_entregador"("p_atribuicao_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirmar_recolha_encomenda_vendedor"("p_atribuicao_id" "uuid") RETURNS "public"."atribuicoes_entrega_encomenda"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."confirmar_recolha_encomenda_vendedor"("p_atribuicao_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consultar_estado_codigo_levantamento_admin"("p_encomenda_id" "uuid") RETURNS TABLE("encomenda_id" "uuid", "expira_em" timestamp with time zone, "tentativas" smallint, "max_tentativas" smallint, "bloqueado_em" timestamp with time zone, "usado_em" timestamp with time zone, "geracoes" smallint, "criado_em" timestamp with time zone, "atualizado_em" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    c.encomenda_id, c.expira_em, c.tentativas, c.max_tentativas,
    c.bloqueado_em, c.usado_em, c.geracoes, c.criado_em, c.atualizado_em
  from public.codigos_levantamento c
  where c.encomenda_id = p_encomenda_id
    and public.eh_admin();
$$;


ALTER FUNCTION "public"."consultar_estado_codigo_levantamento_admin"("p_encomenda_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."contar_notificacoes_nao_lidas"() RETURNS bigint
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  return (
    select count(*)
    from public.notificacoes n
    where n.utilizador_id = auth.uid()
      and not n.lida
  );
end;
$$;


ALTER FUNCTION "public"."contar_notificacoes_nao_lidas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_area_cobertura_entrega"("p_provincia" "text", "p_municipio" "text", "p_bairro" "text" DEFAULT NULL::"text") RETURNS "public"."areas_cobertura_entrega"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_parceiro_id uuid; v_area public.areas_cobertura_entrega%rowtype;
begin
  select id into v_parceiro_id from public.parceiros_entrega where user_id = auth.uid();
  if v_parceiro_id is null then raise exception 'Parceiro de entrega não encontrado.'; end if;
  if not public.territorio_angola_valido(p_provincia, p_municipio) then raise exception 'Selecione uma província e um município válidos.'; end if;

  select * into v_area
  from public.areas_cobertura_entrega
  where parceiro_id = v_parceiro_id
    and provincia = btrim(p_provincia)
    and municipio = btrim(p_municipio)
    and bairro is not distinct from nullif(btrim(p_bairro), '')
  for update;

  if found then
    update public.areas_cobertura_entrega
    set ativo = true
    where id = v_area.id
    returning * into v_area;
    return v_area;
  end if;

  insert into public.areas_cobertura_entrega(parceiro_id,provincia,municipio,bairro,ativo)
  values(v_parceiro_id,btrim(p_provincia),btrim(p_municipio),nullif(btrim(p_bairro),''),true)
  returning * into v_area;
  return v_area;
end; $$;


ALTER FUNCTION "public"."criar_area_cobertura_entrega"("p_provincia" "text", "p_municipio" "text", "p_bairro" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_encomenda_entrega"("p_itens" "jsonb", "p_destinatario_nome" "text", "p_destinatario_telefone" "text", "p_provincia" "text", "p_municipio" "text", "p_bairro" "text", "p_endereco_detalhado" "text", "p_ponto_referencia" "text" DEFAULT NULL::"text", "p_instrucoes_entrega" "text" DEFAULT NULL::"text", "p_observacoes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.garantir_perfil_comprador();
  perform public.validar_compra_produto_alheio(p_itens);
  return public.criar_encomenda_entrega_base_v1(
    p_itens, p_destinatario_nome, p_destinatario_telefone, p_provincia, p_municipio,
    p_bairro, p_endereco_detalhado, p_ponto_referencia, p_instrucoes_entrega, p_observacoes
  );
end;
$$;


ALTER FUNCTION "public"."criar_encomenda_entrega"("p_itens" "jsonb", "p_destinatario_nome" "text", "p_destinatario_telefone" "text", "p_provincia" "text", "p_municipio" "text", "p_bairro" "text", "p_endereco_detalhado" "text", "p_ponto_referencia" "text", "p_instrucoes_entrega" "text", "p_observacoes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_encomenda_entrega"("p_itens" "jsonb", "p_destinatario_nome" "text", "p_destinatario_telefone" "text", "p_provincia" "text", "p_municipio" "text", "p_bairro" "text", "p_endereco_detalhado" "text", "p_ponto_referencia" "text", "p_instrucoes_entrega" "text", "p_observacoes" "text", "p_idempotency_key" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_itens jsonb;
  v_hash text;
  v_registo public.idempotencia_checkout_encomenda%rowtype;
  v_resultado jsonb;
  v_encomenda public.encomendas%rowtype;
  v_pagamento public.pagamentos%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão antes de criar a encomenda.';
  end if;
  if p_idempotency_key is null then
    raise exception 'Não foi possível identificar esta tentativa de encomenda. Tente novamente.';
  end if;

  v_itens := public.normalizar_itens_checkout_idempotencia(p_itens);
  v_hash := public.calcular_hash_intencao_checkout(jsonb_build_object(
    'modalidade_recebimento', 'entrega',
    'itens', v_itens,
    'destinatario_nome', nullif(btrim(p_destinatario_nome), ''),
    'destinatario_telefone', nullif(btrim(p_destinatario_telefone), ''),
    'provincia', nullif(btrim(p_provincia), ''),
    'municipio', nullif(btrim(p_municipio), ''),
    'bairro', nullif(btrim(p_bairro), ''),
    'endereco_detalhado', nullif(btrim(p_endereco_detalhado), ''),
    'ponto_referencia', nullif(btrim(p_ponto_referencia), ''),
    'instrucoes_entrega', nullif(btrim(p_instrucoes_entrega), ''),
    'observacoes_cliente', nullif(btrim(p_observacoes), '')
  ));

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':entrega:' || p_idempotency_key::text, 0));
  select * into v_registo
  from public.idempotencia_checkout_encomenda
  where cliente_id = auth.uid()
    and modalidade_recebimento = 'entrega'
    and chave_idempotencia = p_idempotency_key
  for update;

  if found then
    if v_registo.payload_hash <> v_hash then
      raise exception 'Esta chave de idempotência já foi usada com dados diferentes.';
    end if;
    if v_registo.encomenda_id is null then
      raise exception 'Esta tentativa de encomenda ainda está a ser processada. Tente novamente.';
    end if;
    select * into v_encomenda from public.encomendas where id = v_registo.encomenda_id;
    select * into v_pagamento from public.pagamentos where encomenda_id = v_registo.encomenda_id;
    if not found or v_encomenda.id is null then
      raise exception 'Não foi possível recuperar a encomenda desta tentativa.';
    end if;
    return jsonb_build_object(
      'id', v_encomenda.id,
      'codigo_publico', v_encomenda.codigo_publico,
      'total_centimos', v_encomenda.total_centimos,
      'vendedor_id', v_encomenda.vendedor_id,
      'pagamento_id', v_pagamento.id,
      'estado_pagamento', v_pagamento.estado
    );
  end if;

  perform public.garantir_perfil_comprador();
  insert into public.idempotencia_checkout_encomenda (
    cliente_id, modalidade_recebimento, chave_idempotencia, payload_hash
  ) values (auth.uid(), 'entrega', p_idempotency_key, v_hash);

  v_resultado := public.criar_encomenda_entrega(
    p_itens,
    p_destinatario_nome,
    p_destinatario_telefone,
    p_provincia,
    p_municipio,
    p_bairro,
    p_endereco_detalhado,
    p_ponto_referencia,
    p_instrucoes_entrega,
    p_observacoes
  );

  update public.idempotencia_checkout_encomenda
  set encomenda_id = (v_resultado ->> 'id')::uuid, concluida_em = now()
  where cliente_id = auth.uid()
    and modalidade_recebimento = 'entrega'
    and chave_idempotencia = p_idempotency_key;

  return v_resultado;
end;
$$;


ALTER FUNCTION "public"."criar_encomenda_entrega"("p_itens" "jsonb", "p_destinatario_nome" "text", "p_destinatario_telefone" "text", "p_provincia" "text", "p_municipio" "text", "p_bairro" "text", "p_endereco_detalhado" "text", "p_ponto_referencia" "text", "p_instrucoes_entrega" "text", "p_observacoes" "text", "p_idempotency_key" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_encomenda_entrega_base_v1"("p_itens" "jsonb", "p_destinatario_nome" "text", "p_destinatario_telefone" "text", "p_provincia" "text", "p_municipio" "text", "p_bairro" "text", "p_endereco_detalhado" "text", "p_ponto_referencia" "text" DEFAULT NULL::"text", "p_instrucoes_entrega" "text" DEFAULT NULL::"text", "p_observacoes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_cliente public.clientes%rowtype;
  v_item jsonb;
  v_produto record;
  v_produto_id uuid;
  v_quantidade numeric;
  v_preco numeric;
  v_tipo_venda text;
  v_tipo_preco text;
  v_minimo_retalho numeric;
  v_minimo_grosso numeric;
  v_valor_unitario_centimos bigint;
  v_subtotal_item_centimos bigint;
  v_subtotal_centimos bigint := 0;
  v_vendedor_id uuid := null;
  v_itens_preparados jsonb := '[]'::jsonb;
  v_codigo_publico text;
  v_tentativas integer := 0;
  v_encomenda public.encomendas%rowtype;
  v_destinatario_nome text;
  v_destinatario_telefone text;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão antes de criar a encomenda.';
  end if;

  if not public.territorio_angola_valido(p_provincia,p_municipio) then raise exception 'A província e o município indicados não formam um território válido.'; end if;
  if nullif(btrim(p_destinatario_nome),'') is null or nullif(btrim(p_destinatario_telefone),'') is null or nullif(btrim(p_bairro),'') is null or nullif(btrim(p_endereco_detalhado),'') is null then raise exception 'Indique nome, telefone, bairro e endereço detalhado para a entrega.'; end if;

  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Indique pelo menos um produto para a encomenda.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_itens) item
    group by item ->> 'produto_id'
    having count(*) > 1
  ) then
    raise exception 'Não repita o mesmo produto na encomenda.';
  end if;

  select * into v_cliente
  from public.clientes
  where id = auth.uid()
    and coalesce(conta_ativa, true) = true;

  if not found then
    raise exception 'É necessária uma conta de cliente ativa para criar encomendas.';
  end if;

  v_destinatario_nome := coalesce(nullif(btrim(p_destinatario_nome), ''), nullif(btrim(v_cliente.nome), ''));
  v_destinatario_telefone := coalesce(nullif(btrim(p_destinatario_telefone), ''), nullif(btrim(v_cliente.telefone), ''));
  if v_destinatario_nome is null or v_destinatario_telefone is null then
    raise exception 'Indique nome e telefone de contacto para a entrega.';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    if coalesce(jsonb_typeof(v_item), '') <> 'object'
      or nullif(btrim(v_item ->> 'produto_id'), '') is null
      or coalesce(jsonb_typeof(v_item -> 'quantidade'), '') <> 'number' then
      raise exception 'Cada item deve indicar produto e quantidade válidos.';
    end if;

    v_produto_id := (v_item ->> 'produto_id')::uuid;
    v_quantidade := (v_item ->> 'quantidade')::numeric;
    if v_quantidade <= 0 or v_quantidade <> trunc(v_quantidade, 3) then
      raise exception 'A quantidade deve ser superior a zero e ter no máximo três casas decimais.';
    end if;

    select
      p.id, p.vendedor_id, p.nome_produto, p.descricao, p.imagem_url,
      p.unidade, p.preco_aproximado, p.preco_promocional, p.preco_grosso,
      p.quantidade_minima, p.quantidade_minima_grosso,
      lower(btrim(coalesce(p.tipo_venda, 'retalho'))) as tipo_venda,
      v.status_aprovacao, v.conta_ativa, v.provincia, v.municipio,
      coalesce(v.bairro, v.mercado_bairro) as bairro,
      v.endereco_detalhado, v.mercado_bairro
    into v_produto
    from public.produtos p
    join public.vendedores v on v.id = p.vendedor_id
    where p.id = v_produto_id
      and p.publicado = true
      and p.disponivel = true
    for share of p, v;

    if not found then
      raise exception 'O produto selecionado não existe ou não está disponível.';
    end if;

    if v_produto.status_aprovacao <> 'aprovado' or coalesce(v_produto.conta_ativa, true) = false then
      raise exception 'O vendedor deste produto não está disponível para receber encomendas.';
    end if;

    v_tipo_venda := v_produto.tipo_venda;
    if v_tipo_venda not in ('retalho', 'grosso', 'ambos') then
      raise exception 'O produto possui um tipo de venda inválido.';
    end if;

    -- As unidades existentes já distinguem medidas contínuas das unidades
    -- comerciais indivisíveis. Não se cria aqui um motor de conversão.
    if lower(btrim(coalesce(v_produto.unidade, 'unidade'))) in ('unidade', 'animal', 'saco', 'caixa')
      and v_quantidade <> trunc(v_quantidade) then
      raise exception 'A unidade de venda deste produto aceita apenas quantidades inteiras.';
    end if;

    v_minimo_retalho := coalesce(v_produto.quantidade_minima, 1);
    if v_minimo_retalho <= 0 then
      raise exception 'O produto possui uma quantidade mínima de retalho inválida.';
    end if;

    -- Política transacional: promoção é uma condição do retalho. O grossista
    -- usa uma tabela independente quando ela está completa; nunca escolhemos
    -- silenciosamente o menor dos dois preços.
    if v_tipo_venda = 'retalho' then
      if v_quantidade < v_minimo_retalho then
        raise exception 'A quantidade solicitada é inferior ao mínimo de retalho definido para o produto.';
      end if;

      if v_produto.preco_promocional is not null
        and v_produto.preco_promocional > 0
        and (v_produto.preco_aproximado is null or v_produto.preco_promocional < v_produto.preco_aproximado) then
        v_preco := v_produto.preco_promocional;
        v_tipo_preco := 'promocional';
      else
        v_preco := v_produto.preco_aproximado;
        v_tipo_preco := 'normal';
      end if;

    elsif v_tipo_venda = 'grosso' then
      -- Nos produtos exclusivamente grossistas legados, o único campo de
      -- preço preenchido é frequentemente preco_aproximado, apesar do nome.
      -- Nesse contexto ele é o preço comercial de grosso já mostrado no site.
      v_minimo_grosso := coalesce(v_produto.quantidade_minima_grosso, v_minimo_retalho);
      if v_minimo_grosso <= 0 or v_quantidade < v_minimo_grosso then
        raise exception 'A quantidade solicitada é inferior ao mínimo de grosso definido para o produto.';
      end if;

      v_preco := coalesce(nullif(v_produto.preco_grosso, 0), v_produto.preco_aproximado);
      v_tipo_preco := 'grosso';

    else
      -- Um produto "ambos" só passa ao preço grossista quando preço e mínimo
      -- grossistas foram configurados. Caso contrário continua em retalho.
      if v_produto.preco_grosso is not null
        and v_produto.preco_grosso > 0
        and v_produto.quantidade_minima_grosso is not null
        and v_produto.quantidade_minima_grosso > 0
        and v_quantidade >= v_produto.quantidade_minima_grosso then
        v_preco := v_produto.preco_grosso;
        v_tipo_preco := 'grosso';
      else
        if v_quantidade < v_minimo_retalho then
          raise exception 'A quantidade solicitada é inferior ao mínimo de retalho definido para o produto.';
        end if;

        if v_produto.preco_promocional is not null
          and v_produto.preco_promocional > 0
          and (v_produto.preco_aproximado is null or v_produto.preco_promocional < v_produto.preco_aproximado) then
          v_preco := v_produto.preco_promocional;
          v_tipo_preco := 'promocional';
        else
          v_preco := v_produto.preco_aproximado;
          v_tipo_preco := 'normal';
        end if;
      end if;
    end if;

    if v_vendedor_id is null then
      v_vendedor_id := v_produto.vendedor_id;
    elsif v_vendedor_id <> v_produto.vendedor_id then
      raise exception 'Uma encomenda só pode conter produtos do mesmo vendedor.';
    end if;

    if v_preco is null or v_preco <= 0 then
      raise exception 'O produto selecionado não possui um preço comercial válido para este modo de venda.';
    end if;

    -- O catálogo usa numeric em Kwanzas. A conversão acontece no servidor,
    -- para cêntimos inteiros, e o subtotal da linha é arredondado uma única vez.
    v_valor_unitario_centimos := round(v_preco * 100)::bigint;
    v_subtotal_item_centimos := round(v_valor_unitario_centimos * v_quantidade)::bigint;
    v_subtotal_centimos := v_subtotal_centimos + v_subtotal_item_centimos;

    v_itens_preparados := v_itens_preparados || jsonb_build_array(jsonb_build_object(
      'produto_id', v_produto.id,
      'vendedor_id', v_produto.vendedor_id,
      'quantidade', v_quantidade,
      'unidade', coalesce(v_produto.unidade, 'unidade'),
      'tipo_preco_snapshot', v_tipo_preco,
      'valor_unitario_centimos', v_valor_unitario_centimos,
      'subtotal_centimos', v_subtotal_item_centimos,
      'nome_produto_snapshot', v_produto.nome_produto,
      'descricao_snapshot', v_produto.descricao,
      'imagem_principal_snapshot', v_produto.imagem_url,
      'provincia', v_produto.provincia,
      'municipio', v_produto.municipio,
      'bairro', v_produto.bairro,
      'endereco_levantamento', v_produto.endereco_detalhado,
      'ponto_referencia', v_produto.mercado_bairro
    ));
  end loop;

  loop
    v_tentativas := v_tentativas + 1;
    v_codigo_publico := public.gerar_codigo_publico_encomenda();
    begin
      insert into public.encomendas (
        codigo_publico, cliente_id, vendedor_id, modalidade_recebimento, moeda,
        subtotal_centimos, desconto_centimos, entrega_centimos, total_centimos,
        destinatario_nome, destinatario_telefone, provincia, municipio, bairro,
        endereco_levantamento, ponto_referencia,
        observacoes_cliente
      ) values (
        v_codigo_publico, v_cliente.id, v_vendedor_id, 'entrega', 'AOA',
        v_subtotal_centimos, 0, 0, v_subtotal_centimos,
        v_destinatario_nome, v_destinatario_telefone,
        (v_itens_preparados -> 0 ->> 'provincia'),
        (v_itens_preparados -> 0 ->> 'municipio'),
        (v_itens_preparados -> 0 ->> 'bairro'),
        (v_itens_preparados -> 0 ->> 'endereco_levantamento'),
        (v_itens_preparados -> 0 ->> 'ponto_referencia'),
        nullif(btrim(p_observacoes), '')
      ) returning * into v_encomenda;
      exit;
    exception when unique_violation then
      if v_tentativas >= 5 then
        raise exception 'Não foi possível gerar o código público da encomenda. Tente novamente.';
      end if;
    end;
  end loop;

  insert into public.enderecos_entrega_encomenda (encomenda_id,destinatario_nome,destinatario_telefone,provincia,municipio,bairro,endereco_detalhado,ponto_referencia,instrucoes_entrega) values (v_encomenda.id,v_destinatario_nome,v_destinatario_telefone,btrim(p_provincia),btrim(p_municipio),btrim(p_bairro),btrim(p_endereco_detalhado),nullif(btrim(p_ponto_referencia),''),nullif(btrim(p_instrucoes_entrega),''));

  insert into public.itens_encomenda (
    encomenda_id, produto_id, vendedor_id, quantidade, unidade, tipo_preco_snapshot,
    valor_unitario_centimos, subtotal_centimos, nome_produto_snapshot,
    descricao_snapshot, imagem_principal_snapshot
  )
  select
    v_encomenda.id,
    (item ->> 'produto_id')::uuid,
    (item ->> 'vendedor_id')::uuid,
    (item ->> 'quantidade')::numeric,
    item ->> 'unidade',
    item ->> 'tipo_preco_snapshot',
    (item ->> 'valor_unitario_centimos')::bigint,
    (item ->> 'subtotal_centimos')::bigint,
    item ->> 'nome_produto_snapshot',
    nullif(item ->> 'descricao_snapshot', ''),
    nullif(item ->> 'imagem_principal_snapshot', '')
  from jsonb_array_elements(v_itens_preparados) item;

  insert into public.eventos_encomenda (
    encomenda_id, tipo_evento, estado_novo, ator_tipo, utilizador_id, metadados
  ) values (
    v_encomenda.id, 'encomenda_criada', 'aguardando_confirmacao', 'cliente', auth.uid(),
    jsonb_build_object('quantidade_itens', jsonb_array_length(v_itens_preparados))
  );

  perform public.criar_pagamento_encomenda(v_encomenda.id,gen_random_uuid());
  perform public.criar_tentativa_pagamento((select id from public.pagamentos where encomenda_id=v_encomenda.id),'pagamento_na_entrega',gen_random_uuid());
  return jsonb_build_object('id',v_encomenda.id,'codigo_publico',v_encomenda.codigo_publico,'total_centimos',v_encomenda.total_centimos,'vendedor_id',v_encomenda.vendedor_id,'pagamento_id',(select id from public.pagamentos where encomenda_id=v_encomenda.id),'estado_pagamento','pendente');
end;
$$;


ALTER FUNCTION "public"."criar_encomenda_entrega_base_v1"("p_itens" "jsonb", "p_destinatario_nome" "text", "p_destinatario_telefone" "text", "p_provincia" "text", "p_municipio" "text", "p_bairro" "text", "p_endereco_detalhado" "text", "p_ponto_referencia" "text", "p_instrucoes_entrega" "text", "p_observacoes" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."encomendas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo_publico" "text" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "vendedor_id" "uuid" NOT NULL,
    "estado" "text" DEFAULT 'aguardando_confirmacao'::"text" NOT NULL,
    "modalidade_recebimento" "text" DEFAULT 'levantamento'::"text" NOT NULL,
    "moeda" character(3) DEFAULT 'AOA'::"bpchar" NOT NULL,
    "subtotal_centimos" bigint NOT NULL,
    "desconto_centimos" bigint DEFAULT 0 NOT NULL,
    "entrega_centimos" bigint DEFAULT 0 NOT NULL,
    "total_centimos" bigint NOT NULL,
    "destinatario_nome" "text" NOT NULL,
    "destinatario_telefone" "text" NOT NULL,
    "provincia" "text",
    "municipio" "text",
    "bairro" "text",
    "endereco_levantamento" "text",
    "ponto_referencia" "text",
    "observacoes_cliente" "text",
    "motivo_recusa" "text",
    "motivo_cancelamento" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confirmado_em" timestamp with time zone,
    "recusado_em" timestamp with time zone,
    "concluido_em" timestamp with time zone,
    "cancelado_em" timestamp with time zone,
    CONSTRAINT "encomendas_codigo_publico_check" CHECK (("codigo_publico" ~ '^ANG-[0-9]{4}-[A-F0-9]{8}$'::"text")),
    CONSTRAINT "encomendas_desconto_centimos_check" CHECK (("desconto_centimos" >= 0)),
    CONSTRAINT "encomendas_desconto_nao_supera_subtotal" CHECK (("desconto_centimos" <= "subtotal_centimos")),
    CONSTRAINT "encomendas_entrega_centimos_check" CHECK (("entrega_centimos" >= 0)),
    CONSTRAINT "encomendas_entrega_sem_tarifa_v1_check" CHECK ((("modalidade_recebimento" <> 'entrega'::"text") OR ("entrega_centimos" = 0))),
    CONSTRAINT "encomendas_estado_check" CHECK (("estado" = ANY (ARRAY['aguardando_confirmacao'::"text", 'confirmada'::"text", 'em_preparacao'::"text", 'pronta_para_levantamento'::"text", 'levantada'::"text", 'recolhida'::"text", 'chegou_destino'::"text", 'concluida'::"text", 'recusada'::"text", 'cancelada'::"text"]))),
    CONSTRAINT "encomendas_modalidade_recebimento_check" CHECK (("modalidade_recebimento" = ANY (ARRAY['levantamento'::"text", 'entrega'::"text"]))),
    CONSTRAINT "encomendas_moeda_check" CHECK (("moeda" = 'AOA'::"bpchar")),
    CONSTRAINT "encomendas_subtotal_centimos_check" CHECK (("subtotal_centimos" >= 0)),
    CONSTRAINT "encomendas_total_centimos_check" CHECK (("total_centimos" >= 0)),
    CONSTRAINT "encomendas_total_consistente" CHECK (("total_centimos" = (("subtotal_centimos" - "desconto_centimos") + "entrega_centimos")))
);

ALTER TABLE ONLY "public"."encomendas" REPLICA IDENTITY FULL;


ALTER TABLE "public"."encomendas" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_encomenda_levantamento"("p_itens" "jsonb", "p_modalidade" "text" DEFAULT 'levantamento'::"text", "p_nome_destinatario" "text" DEFAULT NULL::"text", "p_telefone_destinatario" "text" DEFAULT NULL::"text", "p_observacoes_cliente" "text" DEFAULT NULL::"text") RETURNS "public"."encomendas"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.garantir_perfil_comprador();
  perform public.validar_compra_produto_alheio(p_itens);
  return public.criar_encomenda_levantamento_base_v1(
    p_itens, p_modalidade, p_nome_destinatario, p_telefone_destinatario, p_observacoes_cliente
  );
end;
$$;


ALTER FUNCTION "public"."criar_encomenda_levantamento"("p_itens" "jsonb", "p_modalidade" "text", "p_nome_destinatario" "text", "p_telefone_destinatario" "text", "p_observacoes_cliente" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_encomenda_levantamento"("p_itens" "jsonb", "p_modalidade" "text", "p_nome_destinatario" "text", "p_telefone_destinatario" "text", "p_observacoes_cliente" "text", "p_idempotency_key" "uuid") RETURNS "public"."encomendas"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_itens jsonb;
  v_hash text;
  v_registo public.idempotencia_checkout_encomenda%rowtype;
  v_encomenda public.encomendas%rowtype;
  v_pagamento_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão antes de criar a encomenda.';
  end if;
  if p_idempotency_key is null then
    raise exception 'Não foi possível identificar esta tentativa de encomenda. Tente novamente.';
  end if;
  if coalesce(btrim(p_modalidade), '') <> 'levantamento' then
    raise exception 'A entrega ainda não está disponível. Escolha levantamento no local.';
  end if;

  v_itens := public.normalizar_itens_checkout_idempotencia(p_itens);
  v_hash := public.calcular_hash_intencao_checkout(jsonb_build_object(
    'modalidade_recebimento', 'levantamento',
    'itens', v_itens,
    'destinatario_nome', nullif(btrim(p_nome_destinatario), ''),
    'destinatario_telefone', nullif(btrim(p_telefone_destinatario), ''),
    'observacoes_cliente', nullif(btrim(p_observacoes_cliente), '')
  ));

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':levantamento:' || p_idempotency_key::text, 0));
  select * into v_registo
  from public.idempotencia_checkout_encomenda
  where cliente_id = auth.uid()
    and modalidade_recebimento = 'levantamento'
    and chave_idempotencia = p_idempotency_key
  for update;

  if found then
    if v_registo.payload_hash <> v_hash then
      raise exception 'Esta chave de idempotência já foi usada com dados diferentes.';
    end if;
    if v_registo.encomenda_id is null then
      raise exception 'Esta tentativa de encomenda ainda está a ser processada. Tente novamente.';
    end if;
    select * into v_encomenda from public.encomendas where id = v_registo.encomenda_id;
    if not found then
      raise exception 'Não foi possível recuperar a encomenda desta tentativa.';
    end if;
    return v_encomenda;
  end if;

  perform public.garantir_perfil_comprador();
  insert into public.idempotencia_checkout_encomenda (
    cliente_id, modalidade_recebimento, chave_idempotencia, payload_hash
  ) values (auth.uid(), 'levantamento', p_idempotency_key, v_hash);

  -- A implementação aplicada continua a ser a fonte de verdade para catálogo,
  -- preço, vendedor elegível, itens e evento comercial.
  v_encomenda := public.criar_encomenda_levantamento(
    p_itens,
    p_modalidade,
    p_nome_destinatario,
    p_telefone_destinatario,
    p_observacoes_cliente
  );

  perform public.criar_pagamento_encomenda(v_encomenda.id, gen_random_uuid());
  select id into v_pagamento_id from public.pagamentos where encomenda_id = v_encomenda.id for update;
  if v_pagamento_id is null then
    raise exception 'Não foi possível preparar o pagamento desta encomenda.';
  end if;
  perform public.criar_tentativa_pagamento(v_pagamento_id, 'pagamento_no_levantamento', gen_random_uuid());

  update public.idempotencia_checkout_encomenda
  set encomenda_id = v_encomenda.id, concluida_em = now()
  where cliente_id = auth.uid()
    and modalidade_recebimento = 'levantamento'
    and chave_idempotencia = p_idempotency_key;

  return v_encomenda;
end;
$$;


ALTER FUNCTION "public"."criar_encomenda_levantamento"("p_itens" "jsonb", "p_modalidade" "text", "p_nome_destinatario" "text", "p_telefone_destinatario" "text", "p_observacoes_cliente" "text", "p_idempotency_key" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_encomenda_levantamento_base_v1"("p_itens" "jsonb", "p_modalidade" "text" DEFAULT 'levantamento'::"text", "p_nome_destinatario" "text" DEFAULT NULL::"text", "p_telefone_destinatario" "text" DEFAULT NULL::"text", "p_observacoes_cliente" "text" DEFAULT NULL::"text") RETURNS "public"."encomendas"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_cliente public.clientes%rowtype;
  v_item jsonb;
  v_produto record;
  v_produto_id uuid;
  v_quantidade numeric;
  v_preco numeric;
  v_tipo_venda text;
  v_tipo_preco text;
  v_minimo_retalho numeric;
  v_minimo_grosso numeric;
  v_valor_unitario_centimos bigint;
  v_subtotal_item_centimos bigint;
  v_subtotal_centimos bigint := 0;
  v_vendedor_id uuid := null;
  v_itens_preparados jsonb := '[]'::jsonb;
  v_codigo_publico text;
  v_tentativas integer := 0;
  v_encomenda public.encomendas%rowtype;
  v_destinatario_nome text;
  v_destinatario_telefone text;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão antes de criar a encomenda.';
  end if;

  if coalesce(p_modalidade, '') <> 'levantamento' then
    raise exception 'A entrega ainda não está disponível. Escolha levantamento no local.';
  end if;

  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Indique pelo menos um produto para a encomenda.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_itens) item
    group by item ->> 'produto_id'
    having count(*) > 1
  ) then
    raise exception 'Não repita o mesmo produto na encomenda.';
  end if;

  select * into v_cliente
  from public.clientes
  where id = auth.uid()
    and coalesce(conta_ativa, true) = true;

  if not found then
    raise exception 'É necessária uma conta de cliente ativa para criar encomendas.';
  end if;

  v_destinatario_nome := coalesce(nullif(btrim(p_nome_destinatario), ''), nullif(btrim(v_cliente.nome), ''));
  v_destinatario_telefone := coalesce(nullif(btrim(p_telefone_destinatario), ''), nullif(btrim(v_cliente.telefone), ''));
  if v_destinatario_nome is null or v_destinatario_telefone is null then
    raise exception 'Indique nome e telefone de contacto para o levantamento.';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    if coalesce(jsonb_typeof(v_item), '') <> 'object'
      or nullif(btrim(v_item ->> 'produto_id'), '') is null
      or coalesce(jsonb_typeof(v_item -> 'quantidade'), '') <> 'number' then
      raise exception 'Cada item deve indicar produto e quantidade válidos.';
    end if;

    v_produto_id := (v_item ->> 'produto_id')::uuid;
    v_quantidade := (v_item ->> 'quantidade')::numeric;
    if v_quantidade <= 0 or v_quantidade <> trunc(v_quantidade, 3) then
      raise exception 'A quantidade deve ser superior a zero e ter no máximo três casas decimais.';
    end if;

    select
      p.id, p.vendedor_id, p.nome_produto, p.descricao, p.imagem_url,
      p.unidade, p.preco_aproximado, p.preco_promocional, p.preco_grosso,
      p.quantidade_minima, p.quantidade_minima_grosso,
      lower(btrim(coalesce(p.tipo_venda, 'retalho'))) as tipo_venda,
      v.status_aprovacao, v.conta_ativa, v.provincia, v.municipio,
      coalesce(v.bairro, v.mercado_bairro) as bairro,
      v.endereco_detalhado, v.mercado_bairro
    into v_produto
    from public.produtos p
    join public.vendedores v on v.id = p.vendedor_id
    where p.id = v_produto_id
      and p.publicado = true
      and p.disponivel = true
    for share of p, v;

    if not found then
      raise exception 'O produto selecionado não existe ou não está disponível.';
    end if;

    if v_produto.status_aprovacao <> 'aprovado' or coalesce(v_produto.conta_ativa, true) = false then
      raise exception 'O vendedor deste produto não está disponível para receber encomendas.';
    end if;

    v_tipo_venda := v_produto.tipo_venda;
    if v_tipo_venda not in ('retalho', 'grosso', 'ambos') then
      raise exception 'O produto possui um tipo de venda inválido.';
    end if;

    -- As unidades existentes já distinguem medidas contínuas das unidades
    -- comerciais indivisíveis. Não se cria aqui um motor de conversão.
    if lower(btrim(coalesce(v_produto.unidade, 'unidade'))) in ('unidade', 'animal', 'saco', 'caixa')
      and v_quantidade <> trunc(v_quantidade) then
      raise exception 'A unidade de venda deste produto aceita apenas quantidades inteiras.';
    end if;

    v_minimo_retalho := coalesce(v_produto.quantidade_minima, 1);
    if v_minimo_retalho <= 0 then
      raise exception 'O produto possui uma quantidade mínima de retalho inválida.';
    end if;

    -- Política transacional: promoção é uma condição do retalho. O grossista
    -- usa uma tabela independente quando ela está completa; nunca escolhemos
    -- silenciosamente o menor dos dois preços.
    if v_tipo_venda = 'retalho' then
      if v_quantidade < v_minimo_retalho then
        raise exception 'A quantidade solicitada é inferior ao mínimo de retalho definido para o produto.';
      end if;

      if v_produto.preco_promocional is not null
        and v_produto.preco_promocional > 0
        and (v_produto.preco_aproximado is null or v_produto.preco_promocional < v_produto.preco_aproximado) then
        v_preco := v_produto.preco_promocional;
        v_tipo_preco := 'promocional';
      else
        v_preco := v_produto.preco_aproximado;
        v_tipo_preco := 'normal';
      end if;

    elsif v_tipo_venda = 'grosso' then
      -- Nos produtos exclusivamente grossistas legados, o único campo de
      -- preço preenchido é frequentemente preco_aproximado, apesar do nome.
      -- Nesse contexto ele é o preço comercial de grosso já mostrado no site.
      v_minimo_grosso := coalesce(v_produto.quantidade_minima_grosso, v_minimo_retalho);
      if v_minimo_grosso <= 0 or v_quantidade < v_minimo_grosso then
        raise exception 'A quantidade solicitada é inferior ao mínimo de grosso definido para o produto.';
      end if;

      v_preco := coalesce(nullif(v_produto.preco_grosso, 0), v_produto.preco_aproximado);
      v_tipo_preco := 'grosso';

    else
      -- Um produto "ambos" só passa ao preço grossista quando preço e mínimo
      -- grossistas foram configurados. Caso contrário continua em retalho.
      if v_produto.preco_grosso is not null
        and v_produto.preco_grosso > 0
        and v_produto.quantidade_minima_grosso is not null
        and v_produto.quantidade_minima_grosso > 0
        and v_quantidade >= v_produto.quantidade_minima_grosso then
        v_preco := v_produto.preco_grosso;
        v_tipo_preco := 'grosso';
      else
        if v_quantidade < v_minimo_retalho then
          raise exception 'A quantidade solicitada é inferior ao mínimo de retalho definido para o produto.';
        end if;

        if v_produto.preco_promocional is not null
          and v_produto.preco_promocional > 0
          and (v_produto.preco_aproximado is null or v_produto.preco_promocional < v_produto.preco_aproximado) then
          v_preco := v_produto.preco_promocional;
          v_tipo_preco := 'promocional';
        else
          v_preco := v_produto.preco_aproximado;
          v_tipo_preco := 'normal';
        end if;
      end if;
    end if;

    if v_vendedor_id is null then
      v_vendedor_id := v_produto.vendedor_id;
    elsif v_vendedor_id <> v_produto.vendedor_id then
      raise exception 'Uma encomenda só pode conter produtos do mesmo vendedor.';
    end if;

    if v_preco is null or v_preco <= 0 then
      raise exception 'O produto selecionado não possui um preço comercial válido para este modo de venda.';
    end if;

    -- O catálogo usa numeric em Kwanzas. A conversão acontece no servidor,
    -- para cêntimos inteiros, e o subtotal da linha é arredondado uma única vez.
    v_valor_unitario_centimos := round(v_preco * 100)::bigint;
    v_subtotal_item_centimos := round(v_valor_unitario_centimos * v_quantidade)::bigint;
    v_subtotal_centimos := v_subtotal_centimos + v_subtotal_item_centimos;

    v_itens_preparados := v_itens_preparados || jsonb_build_array(jsonb_build_object(
      'produto_id', v_produto.id,
      'vendedor_id', v_produto.vendedor_id,
      'quantidade', v_quantidade,
      'unidade', coalesce(v_produto.unidade, 'unidade'),
      'tipo_preco_snapshot', v_tipo_preco,
      'valor_unitario_centimos', v_valor_unitario_centimos,
      'subtotal_centimos', v_subtotal_item_centimos,
      'nome_produto_snapshot', v_produto.nome_produto,
      'descricao_snapshot', v_produto.descricao,
      'imagem_principal_snapshot', v_produto.imagem_url,
      'provincia', v_produto.provincia,
      'municipio', v_produto.municipio,
      'bairro', v_produto.bairro,
      'endereco_levantamento', v_produto.endereco_detalhado,
      'ponto_referencia', v_produto.mercado_bairro
    ));
  end loop;

  loop
    v_tentativas := v_tentativas + 1;
    v_codigo_publico := public.gerar_codigo_publico_encomenda();
    begin
      insert into public.encomendas (
        codigo_publico, cliente_id, vendedor_id, modalidade_recebimento, moeda,
        subtotal_centimos, desconto_centimos, entrega_centimos, total_centimos,
        destinatario_nome, destinatario_telefone, provincia, municipio, bairro,
        endereco_levantamento, ponto_referencia,
        observacoes_cliente
      ) values (
        v_codigo_publico, v_cliente.id, v_vendedor_id, 'levantamento', 'AOA',
        v_subtotal_centimos, 0, 0, v_subtotal_centimos,
        v_destinatario_nome, v_destinatario_telefone,
        (v_itens_preparados -> 0 ->> 'provincia'),
        (v_itens_preparados -> 0 ->> 'municipio'),
        (v_itens_preparados -> 0 ->> 'bairro'),
        (v_itens_preparados -> 0 ->> 'endereco_levantamento'),
        (v_itens_preparados -> 0 ->> 'ponto_referencia'),
        nullif(btrim(p_observacoes_cliente), '')
      ) returning * into v_encomenda;
      exit;
    exception when unique_violation then
      if v_tentativas >= 5 then
        raise exception 'Não foi possível gerar o código público da encomenda. Tente novamente.';
      end if;
    end;
  end loop;

  insert into public.itens_encomenda (
    encomenda_id, produto_id, vendedor_id, quantidade, unidade, tipo_preco_snapshot,
    valor_unitario_centimos, subtotal_centimos, nome_produto_snapshot,
    descricao_snapshot, imagem_principal_snapshot
  )
  select
    v_encomenda.id,
    (item ->> 'produto_id')::uuid,
    (item ->> 'vendedor_id')::uuid,
    (item ->> 'quantidade')::numeric,
    item ->> 'unidade',
    item ->> 'tipo_preco_snapshot',
    (item ->> 'valor_unitario_centimos')::bigint,
    (item ->> 'subtotal_centimos')::bigint,
    item ->> 'nome_produto_snapshot',
    nullif(item ->> 'descricao_snapshot', ''),
    nullif(item ->> 'imagem_principal_snapshot', '')
  from jsonb_array_elements(v_itens_preparados) item;

  insert into public.eventos_encomenda (
    encomenda_id, tipo_evento, estado_novo, ator_tipo, utilizador_id, metadados
  ) values (
    v_encomenda.id, 'encomenda_criada', 'aguardando_confirmacao', 'cliente', auth.uid(),
    jsonb_build_object('quantidade_itens', jsonb_array_length(v_itens_preparados))
  );

  return v_encomenda;
end;
$$;


ALTER FUNCTION "public"."criar_encomenda_levantamento_base_v1"("p_itens" "jsonb", "p_modalidade" "text", "p_nome_destinatario" "text", "p_telefone_destinatario" "text", "p_observacoes_cliente" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_notificacao"("p_utilizador_id" "uuid", "p_contexto" "text", "p_tipo" "text", "p_titulo" "text", "p_mensagem" "text", "p_entidade_tipo" "text" DEFAULT NULL::"text", "p_entidade_id" "uuid" DEFAULT NULL::"uuid", "p_url_destino" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT NULL::"jsonb", "p_chave" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if p_utilizador_id is null then
    raise exception 'Destinatário da notificação é obrigatório.';
  end if;

  if p_contexto not in ('compra', 'venda', 'entrega') then
    raise exception 'Contexto de notificação inválido.';
  end if;

  if p_url_destino is not null
    and (left(p_url_destino, 1) <> '/' or left(p_url_destino, 2) = '//') then
    raise exception 'A ligação da notificação deve ser um caminho interno.';
  end if;

  insert into public.notificacoes (
    utilizador_id, contexto, tipo, titulo, mensagem,
    entidade_tipo, entidade_id, url_destino, metadata, chave_idempotencia
  ) values (
    p_utilizador_id, p_contexto, p_tipo, p_titulo, p_mensagem,
    p_entidade_tipo, p_entidade_id, p_url_destino,
    coalesce(p_metadata, '{}'::jsonb), p_chave
  )
  on conflict (chave_idempotencia) where chave_idempotencia is not null do nothing
  returning id into v_id;

  if v_id is null and p_chave is not null then
    select id into v_id
    from public.notificacoes
    where chave_idempotencia = p_chave;
  end if;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."criar_notificacao"("p_utilizador_id" "uuid", "p_contexto" "text", "p_tipo" "text", "p_titulo" "text", "p_mensagem" "text", "p_entidade_tipo" "text", "p_entidade_id" "uuid", "p_url_destino" "text", "p_metadata" "jsonb", "p_chave" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pagamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "encomenda_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "vendedor_id" "uuid" NOT NULL,
    "moeda" character(3) NOT NULL,
    "estado" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "referencia_interna" "text" NOT NULL,
    "chave_idempotencia_criacao" "uuid" NOT NULL,
    "subtotal_centimos" bigint NOT NULL,
    "desconto_centimos" bigint DEFAULT 0 NOT NULL,
    "entrega_centimos" bigint DEFAULT 0 NOT NULL,
    "taxa_processador_centimos" bigint DEFAULT 0 NOT NULL,
    "comissao_angrolink_centimos" bigint DEFAULT 0 NOT NULL,
    "valor_vendedor_centimos" bigint NOT NULL,
    "valor_logistica_centimos" bigint DEFAULT 0 NOT NULL,
    "valor_total_centimos" bigint NOT NULL,
    "total_cliente_centimos" bigint NOT NULL,
    "comissao_bps_snapshot" integer NOT NULL,
    "confirmado_em" timestamp with time zone,
    "falhado_em" timestamp with time zone,
    "cancelado_em" timestamp with time zone,
    "expirado_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pagamentos_comercio_consistente" CHECK ((("subtotal_centimos" - "desconto_centimos") = ("valor_vendedor_centimos" + "comissao_angrolink_centimos"))),
    CONSTRAINT "pagamentos_comissao_angrolink_centimos_check" CHECK (("comissao_angrolink_centimos" >= 0)),
    CONSTRAINT "pagamentos_comissao_bps_snapshot_check" CHECK ((("comissao_bps_snapshot" >= 0) AND ("comissao_bps_snapshot" <= 10000))),
    CONSTRAINT "pagamentos_desconto_centimos_check" CHECK (("desconto_centimos" >= 0)),
    CONSTRAINT "pagamentos_desconto_valido" CHECK (("desconto_centimos" <= "subtotal_centimos")),
    CONSTRAINT "pagamentos_divisao_consistente" CHECK (("total_cliente_centimos" = ((("valor_vendedor_centimos" + "comissao_angrolink_centimos") + "valor_logistica_centimos") + "taxa_processador_centimos"))),
    CONSTRAINT "pagamentos_entrega_centimos_check" CHECK (("entrega_centimos" >= 0)),
    CONSTRAINT "pagamentos_estado_check" CHECK (("estado" = ANY (ARRAY['pendente'::"text", 'a_processar'::"text", 'confirmado'::"text", 'falhado'::"text", 'cancelado'::"text", 'expirado'::"text", 'reembolsado_parcialmente'::"text", 'reembolsado'::"text"]))),
    CONSTRAINT "pagamentos_logistica_consistente" CHECK (("valor_logistica_centimos" = "entrega_centimos")),
    CONSTRAINT "pagamentos_marcos_estado_consistentes" CHECK (((("estado" <> 'confirmado'::"text") OR ("confirmado_em" IS NOT NULL)) AND (("estado" <> 'falhado'::"text") OR ("falhado_em" IS NOT NULL)) AND (("estado" <> 'cancelado'::"text") OR ("cancelado_em" IS NOT NULL)) AND (("estado" <> 'expirado'::"text") OR ("expirado_em" IS NOT NULL)))),
    CONSTRAINT "pagamentos_moeda_check" CHECK (("moeda" = 'AOA'::"bpchar")),
    CONSTRAINT "pagamentos_subtotal_centimos_check" CHECK (("subtotal_centimos" >= 0)),
    CONSTRAINT "pagamentos_taxa_processador_centimos_check" CHECK (("taxa_processador_centimos" >= 0)),
    CONSTRAINT "pagamentos_total_cliente_centimos_check" CHECK (("total_cliente_centimos" >= 0)),
    CONSTRAINT "pagamentos_total_cliente_consistente" CHECK (("total_cliente_centimos" = ((("subtotal_centimos" - "desconto_centimos") + "entrega_centimos") + "taxa_processador_centimos"))),
    CONSTRAINT "pagamentos_valor_logistica_centimos_check" CHECK (("valor_logistica_centimos" >= 0)),
    CONSTRAINT "pagamentos_valor_total_centimos_check" CHECK (("valor_total_centimos" >= 0)),
    CONSTRAINT "pagamentos_valor_total_consistente" CHECK (("valor_total_centimos" = "total_cliente_centimos")),
    CONSTRAINT "pagamentos_valor_vendedor_centimos_check" CHECK (("valor_vendedor_centimos" >= 0))
);


ALTER TABLE "public"."pagamentos" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_pagamento_encomenda"("p_encomenda_id" "uuid", "p_chave_idempotencia" "uuid") RETURNS "public"."pagamentos"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_encomenda public.encomendas%rowtype;
  v_existente public.pagamentos%rowtype;
  v_config public.configuracoes_financeiras%rowtype;
  v_pagamento public.pagamentos%rowtype;
  v_referencia text;
  v_tentativas integer := 0;
  v_comercio_centimos bigint;
  v_comissao_centimos bigint;
begin
  if auth.uid() is null then raise exception 'Sessão inválida. Inicie sessão antes de iniciar o pagamento.'; end if;
  if p_chave_idempotencia is null then raise exception 'É necessária uma chave de idempotência válida.'; end if;

  select * into v_encomenda from public.encomendas where id = p_encomenda_id and cliente_id = auth.uid() for update;
  if not found then raise exception 'Encomenda não encontrada ou sem permissão para iniciar pagamento.'; end if;
  if v_encomenda.estado in ('recusada', 'cancelada', 'concluida') then raise exception 'Esta encomenda não aceita novos pagamentos no estado atual.'; end if;

  select * into v_existente from public.pagamentos where chave_idempotencia_criacao = p_chave_idempotencia;
  if found then
    if v_existente.cliente_id <> auth.uid() or v_existente.encomenda_id <> p_encomenda_id then raise exception 'A chave de idempotência não pode ser reutilizada.'; end if;
    return v_existente;
  end if;
  select * into v_existente from public.pagamentos where encomenda_id = p_encomenda_id;
  if found then return v_existente; end if;

  select * into v_config from public.configuracoes_financeiras where chave = 'padrao' and ativo = true for share;
  if not found then raise exception 'A configuração financeira padrão não está disponível.'; end if;
  v_comercio_centimos := v_encomenda.subtotal_centimos - v_encomenda.desconto_centimos;
  v_comissao_centimos := (v_comercio_centimos * v_config.comissao_bps + 5000) / 10000;

  loop
    v_tentativas := v_tentativas + 1; v_referencia := public.gerar_referencia_pagamento_interna();
    begin
      insert into public.pagamentos (
        encomenda_id, cliente_id, vendedor_id, moeda, referencia_interna, chave_idempotencia_criacao,
        subtotal_centimos, desconto_centimos, entrega_centimos, taxa_processador_centimos,
        comissao_angrolink_centimos, valor_vendedor_centimos, valor_logistica_centimos,
        valor_total_centimos, total_cliente_centimos, comissao_bps_snapshot
      ) values (
        v_encomenda.id, v_encomenda.cliente_id, v_encomenda.vendedor_id, v_encomenda.moeda, v_referencia, p_chave_idempotencia,
        v_encomenda.subtotal_centimos, v_encomenda.desconto_centimos, v_encomenda.entrega_centimos, 0,
        v_comissao_centimos, v_comercio_centimos - v_comissao_centimos, v_encomenda.entrega_centimos,
        v_encomenda.total_centimos, v_encomenda.total_centimos, v_config.comissao_bps
      ) returning * into v_pagamento;
      exit;
    exception when unique_violation then
      select * into v_existente from public.pagamentos where encomenda_id = p_encomenda_id;
      if found then return v_existente; end if;
      if v_tentativas >= 5 then raise exception 'Não foi possível gerar referência interna de pagamento. Tente novamente.'; end if;
    end;
  end loop;

  insert into public.eventos_pagamento (pagamento_id, encomenda_id, tipo_evento, estado_novo, ator_tipo, utilizador_id)
  values (v_pagamento.id, v_pagamento.encomenda_id, 'pagamento_criado', v_pagamento.estado, 'cliente', auth.uid());
  return v_pagamento;
end;
$$;


ALTER FUNCTION "public"."criar_pagamento_encomenda"("p_encomenda_id" "uuid", "p_chave_idempotencia" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_pedido_parceiro_entrega"("p_dados" "jsonb", "p_veiculo" "jsonb", "p_documentos" "jsonb", "p_area" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_parceiro_id uuid;
  v_veiculo_id uuid;
  v_existente public.parceiros_entrega%rowtype;
  v_tipo_veiculo text := lower(coalesce(p_veiculo->>'tipo_veiculo', ''));
  v_total_documentos integer := coalesce(jsonb_array_length(p_documentos), 0);
  v_minimo_documentos integer := case when lower(coalesce(p_veiculo->>'tipo_veiculo', '')) = 'mota' then 4 else 6 end;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão novamente antes de enviar o pedido.';
  end if;

  if v_tipo_veiculo not in ('mota', 'carro', 'carrinha', 'camiao') then
    raise exception 'Indique um tipo de veículo válido.';
  end if;

  if v_total_documentos < v_minimo_documentos
    or exists (
      select 1
      from jsonb_array_elements(p_documentos) documento
      where nullif(trim(documento->>'tipo_documento'), '') is null
         or nullif(trim(documento->>'frente_path'), '') is null
         or nullif(trim(documento->>'verso_path'), '') is null
    ) then
    raise exception 'Envie frente e verso de todos os documentos obrigatórios.';
  end if;

  select * into v_existente
  from public.parceiros_entrega
  where user_id = auth.uid()
  for update;

  if found then
    if v_existente.estado not in ('rascunho', 'documentos_pendentes')
      and (
        exists (select 1 from public.veiculos_entrega where parceiro_id = v_existente.id)
        or exists (select 1 from public.documentos_parceiro_entrega where parceiro_id = v_existente.id)
      ) then
      raise exception 'Esta conta já tem um pedido de parceria de entregas em tratamento.';
    end if;

    -- Corrige cadastros antigos que ficaram em análise sem veículo nem
    -- documentos: não há informação a preservar e o parceiro pode reenviar.
    delete from public.parceiros_entrega where id = v_existente.id;
  end if;

  insert into public.parceiros_entrega (
    user_id, nome_completo, email, telefone, provincia, municipio, bairro,
    zona_base, foto_perfil_url, contacto_emergencia, termos_aceites_em,
    estado, disponibilidade
  ) values (
    auth.uid(),
    nullif(trim(p_dados->>'nome_completo'), ''),
    nullif(trim(p_dados->>'email'), ''),
    nullif(trim(p_dados->>'telefone'), ''),
    nullif(trim(p_dados->>'provincia'), ''),
    nullif(trim(p_dados->>'municipio'), ''),
    nullif(trim(p_dados->>'bairro'), ''),
    nullif(trim(p_dados->>'zona_base'), ''),
    nullif(trim(p_dados->>'foto_perfil_url'), ''),
    nullif(trim(p_dados->>'contacto_emergencia'), ''),
    now(), 'rascunho', false
  ) returning id into v_parceiro_id;

  insert into public.veiculos_entrega (
    parceiro_id, tipo_veiculo, marca, modelo, cor, ano, matricula,
    tipo_carrocaria, capacidade_kg, capacidade_volume_m3,
    possui_caixa_carga, aceita_paletes, possui_refrigeracao, foto_veiculo_path
  ) values (
    v_parceiro_id, v_tipo_veiculo, nullif(trim(p_veiculo->>'marca'), ''),
    nullif(trim(p_veiculo->>'modelo'), ''), nullif(trim(p_veiculo->>'cor'), ''),
    nullif(p_veiculo->>'ano', '')::integer, upper(nullif(trim(p_veiculo->>'matricula'), '')),
    nullif(trim(p_veiculo->>'tipo_carrocaria'), ''),
    nullif(p_veiculo->>'capacidade_kg', '')::numeric,
    nullif(p_veiculo->>'capacidade_volume_m3', '')::numeric,
    coalesce((p_veiculo->>'possui_caixa_carga')::boolean, false),
    coalesce((p_veiculo->>'aceita_paletes')::boolean, false),
    coalesce((p_veiculo->>'possui_refrigeracao')::boolean, false),
    nullif(trim(p_veiculo->>'foto_veiculo_path'), '')
  ) returning id into v_veiculo_id;

  insert into public.areas_cobertura_entrega (parceiro_id, provincia, municipio, bairro)
  values (
    v_parceiro_id, nullif(trim(p_area->>'provincia'), ''),
    nullif(trim(p_area->>'municipio'), ''), nullif(trim(p_area->>'bairro'), '')
  );

  insert into public.documentos_parceiro_entrega (
    parceiro_id, veiculo_id, tipo_documento, frente_path, verso_path, estado
  )
  select
    v_parceiro_id,
    case when documento->>'tipo_documento' in ('bi', 'carta_conducao') then null else v_veiculo_id end,
    documento->>'tipo_documento', documento->>'frente_path', documento->>'verso_path', 'pendente'
  from jsonb_array_elements(p_documentos) documento;

  -- Permite a transição exclusivamente dentro desta operação controlada.
  perform set_config('angrolink.submeter_parceiro', 'true', true);
  update public.parceiros_entrega
  set estado = 'em_analise', disponibilidade = false, atualizado_em = now()
  where id = v_parceiro_id;

  return v_parceiro_id;
end;
$$;


ALTER FUNCTION "public"."criar_pedido_parceiro_entrega"("p_dados" "jsonb", "p_veiculo" "jsonb", "p_documentos" "jsonb", "p_area" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tentativas_pagamento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pagamento_id" "uuid" NOT NULL,
    "metodo" "text" NOT NULL,
    "provedor" "text",
    "estado" "text" DEFAULT 'criada'::"text" NOT NULL,
    "referencia_interna" "text" NOT NULL,
    "referencia_externa" "text",
    "chave_idempotencia" "uuid" NOT NULL,
    "iniciado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confirmado_em" timestamp with time zone,
    "falhado_em" timestamp with time zone,
    "expirado_em" timestamp with time zone,
    "cancelado_em" timestamp with time zone,
    "codigo_erro" "text",
    "mensagem_erro" "text",
    "metadados" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tentativas_pagamento_estado_check" CHECK (("estado" = ANY (ARRAY['criada'::"text", 'pendente'::"text", 'a_processar'::"text", 'confirmada'::"text", 'falhada'::"text", 'expirada'::"text", 'cancelada'::"text"]))),
    CONSTRAINT "tentativas_pagamento_marcos_estado_consistentes" CHECK (((("estado" <> 'confirmada'::"text") OR ("confirmado_em" IS NOT NULL)) AND (("estado" <> 'falhada'::"text") OR ("falhado_em" IS NOT NULL)) AND (("estado" <> 'expirada'::"text") OR ("expirado_em" IS NOT NULL)) AND (("estado" <> 'cancelada'::"text") OR ("cancelado_em" IS NOT NULL)))),
    CONSTRAINT "tentativas_pagamento_metodo_check" CHECK (("metodo" = ANY (ARRAY['online'::"text", 'pagamento_na_entrega'::"text", 'digital_na_entrega'::"text", 'pagamento_no_levantamento'::"text"])))
);


ALTER TABLE "public"."tentativas_pagamento" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_tentativa_pagamento"("p_pagamento_id" "uuid", "p_metodo" "text", "p_chave_idempotencia" "uuid") RETURNS "public"."tentativas_pagamento"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_pagamento public.pagamentos%rowtype;
  v_existente public.tentativas_pagamento%rowtype;
  v_tentativa public.tentativas_pagamento%rowtype;
  v_referencia text;
  v_tentativas integer := 0;
begin
  if auth.uid() is null then raise exception 'Sessão inválida. Inicie sessão antes de iniciar uma tentativa.'; end if;
  if p_chave_idempotencia is null then raise exception 'É necessária uma chave de idempotência válida.'; end if;
  if coalesce(btrim(p_metodo), '') not in ('online', 'pagamento_na_entrega', 'digital_na_entrega', 'pagamento_no_levantamento') then raise exception 'Método de pagamento inválido.'; end if;

  select * into v_pagamento from public.pagamentos where id = p_pagamento_id and cliente_id = auth.uid() for update;
  if not found then raise exception 'Pagamento não encontrado ou sem permissão.'; end if;
  if v_pagamento.estado in ('confirmado', 'reembolsado_parcialmente', 'reembolsado', 'cancelado') then raise exception 'Este pagamento não aceita novas tentativas.'; end if;

  select * into v_existente from public.tentativas_pagamento where chave_idempotencia = p_chave_idempotencia;
  if found then
    if v_existente.pagamento_id <> v_pagamento.id then raise exception 'A chave de idempotência não pode ser reutilizada.'; end if;
    return v_existente;
  end if;

  loop
    v_tentativas := v_tentativas + 1; v_referencia := public.gerar_referencia_tentativa_pagamento_interna();
    begin
      insert into public.tentativas_pagamento (pagamento_id, metodo, referencia_interna, chave_idempotencia)
      values (v_pagamento.id, btrim(p_metodo), v_referencia, p_chave_idempotencia)
      returning * into v_tentativa;
      exit;
    exception when unique_violation then
      select * into v_existente from public.tentativas_pagamento where chave_idempotencia = p_chave_idempotencia;
      if found and v_existente.pagamento_id = v_pagamento.id then return v_existente; end if;
      if v_tentativas >= 5 then raise exception 'Não foi possível gerar referência interna da tentativa. Tente novamente.'; end if;
    end;
  end loop;

  insert into public.eventos_pagamento (pagamento_id, tentativa_pagamento_id, encomenda_id, tipo_evento, estado_novo, ator_tipo, utilizador_id, metadados)
  values (v_pagamento.id, v_tentativa.id, v_pagamento.encomenda_id, 'tentativa_criada', v_tentativa.estado, 'cliente', auth.uid(), jsonb_build_object('metodo', v_tentativa.metodo));
  return v_tentativa;
end;
$$;


ALTER FUNCTION "public"."criar_tentativa_pagamento"("p_pagamento_id" "uuid", "p_metodo" "text", "p_chave_idempotencia" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_versao_inicial_documento_parceiro"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_id uuid;
begin
  insert into public.versoes_documento_parceiro_entrega(documento_id,parceiro_id,veiculo_id,numero_versao,frente_path,verso_path,numero_documento_snapshot,validade_snapshot,estado,analisado_por,analisado_em,motivo_rejeicao)
  values(new.id,new.parceiro_id,new.veiculo_id,1,new.frente_path,new.verso_path,new.numero_documento,new.validade,new.estado,new.analisado_por,new.analisado_em,new.motivo_rejeicao) returning id into v_id;
  update public.documentos_parceiro_entrega set versao_atual_id=v_id where id=new.id;
  insert into public.eventos_documento_parceiro_entrega(documento_id,versao_id,parceiro_id,ator_tipo,utilizador_id,evento,estado_novo)
  values(new.id,v_id,new.parceiro_id,'sistema',auth.uid(),'enviado',new.estado);
  return new;
end; $$;


ALTER FUNCTION "public"."criar_versao_inicial_documento_parceiro"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."desativar_minha_conta"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Desativar vendedor, se existir
  update public.vendedores
  set
    conta_ativa = false,
    status_aprovacao = 'suspenso',
    verificado = false,
    pode_destacar = false,
    atualizado_em = now()
  where user_id = auth.uid();

  -- Ocultar produtos do vendedor
  update public.produtos p
  set
    publicado = false,
    disponivel = false,
    destaque = false,
    destaque_inicio = null,
    destaque_ate = null,
    tipo_destaque = null
  where exists (
    select 1
    from public.vendedores v
    where v.id = p.vendedor_id
      and v.user_id = auth.uid()
  );

  -- Ocultar serviços do vendedor
  update public.servicos s
  set
    publicado = false,
    disponivel = false,
    destaque = false,
    destaque_inicio = null,
    destaque_ate = null,
    tipo_destaque = null
  where exists (
    select 1
    from public.vendedores v
    where v.id = s.vendedor_id
      and v.user_id = auth.uid()
  );

  -- Desativar cliente, se existir
  update public.clientes
  set
    conta_ativa = false,
    atualizado_em = now()
  where id = auth.uid();
end;
$$;


ALTER FUNCTION "public"."desativar_minha_conta"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."destacar_produto_gratis"("produto_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  vendedor_uuid uuid;
  destaque_ativo_ate timestamptz;
  proximo_destaque timestamptz;
  nova_data_fim timestamptz;
begin
  select vendedor_id
  into vendedor_uuid
  from public.produtos
  where id = produto_uuid;

  if vendedor_uuid is null then
    raise exception 'Produto não encontrado.';
  end if;

  if not exists (
    select 1
    from public.vendedores v
    where v.id = vendedor_uuid
      and v.user_id = auth.uid()
      and v.status_aprovacao = 'aprovado'
  ) then
    raise exception 'Apenas vendedores aprovados podem destacar produtos.';
  end if;

  select destaque_ate
  into destaque_ativo_ate
  from public.produtos
  where vendedor_id = vendedor_uuid
    and destaque = true
    and destaque_ate is not null
    and destaque_ate > now()
  order by destaque_ate desc
  limit 1;

  select proximo_destaque_produto_em
  into proximo_destaque
  from public.vendedores
  where id = vendedor_uuid;

  if destaque_ativo_ate is null then
    if proximo_destaque is not null and proximo_destaque > now() then
      raise exception 'Ainda está em período de espera para destacar outro produto.';
    end if;

    nova_data_fim := now() + interval '7 days';

    update public.vendedores
    set proximo_destaque_produto_em = now() + interval '14 days'
    where id = vendedor_uuid;
  else
    nova_data_fim := destaque_ativo_ate;
  end if;

  update public.produtos
  set
    destaque = false,
    destaque_inicio = null,
    destaque_ate = null,
    tipo_destaque = null
  where vendedor_id = vendedor_uuid
    and destaque = true;

  update public.produtos
  set
    destaque = true,
    destaque_inicio = now(),
    destaque_ate = nova_data_fim,
    tipo_destaque = 'gratuito'
  where id = produto_uuid
    and vendedor_id = vendedor_uuid;
end;
$$;


ALTER FUNCTION "public"."destacar_produto_gratis"("produto_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."destacar_servico_gratis"("servico_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  vendedor_uuid uuid;
  destaque_ativo_ate timestamptz;
  proximo_destaque timestamptz;
  nova_data_fim timestamptz;
begin
  select vendedor_id
  into vendedor_uuid
  from public.servicos
  where id = servico_uuid;

  if vendedor_uuid is null then
    raise exception 'Serviço não encontrado.';
  end if;

  if not exists (
    select 1
    from public.vendedores v
    where v.id = vendedor_uuid
      and v.user_id = auth.uid()
      and v.status_aprovacao = 'aprovado'
  ) then
    raise exception 'Apenas vendedores aprovados podem destacar serviços.';
  end if;

  select destaque_ate
  into destaque_ativo_ate
  from public.servicos
  where vendedor_id = vendedor_uuid
    and destaque = true
    and destaque_ate is not null
    and destaque_ate > now()
  order by destaque_ate desc
  limit 1;

  select proximo_destaque_servico_em
  into proximo_destaque
  from public.vendedores
  where id = vendedor_uuid;

  if destaque_ativo_ate is null then
    if proximo_destaque is not null and proximo_destaque > now() then
      raise exception 'Ainda está em período de espera para destacar outro serviço.';
    end if;

    nova_data_fim := now() + interval '7 days';

    update public.vendedores
    set proximo_destaque_servico_em = now() + interval '14 days'
    where id = vendedor_uuid;
  else
    nova_data_fim := destaque_ativo_ate;
  end if;

  update public.servicos
  set
    destaque = false,
    destaque_inicio = null,
    destaque_ate = null,
    tipo_destaque = null
  where vendedor_id = vendedor_uuid
    and destaque = true;

  update public.servicos
  set
    destaque = true,
    destaque_inicio = now(),
    destaque_ate = nova_data_fim,
    tipo_destaque = 'gratuito'
  where id = servico_uuid
    and vendedor_id = vendedor_uuid;
end;
$$;


ALTER FUNCTION "public"."destacar_servico_gratis"("servico_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."eh_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.administradores
    where user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."eh_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."eliminar_vendedor_admin"("p_vendedor_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ begin if not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if; delete from public.vendedores where id=p_vendedor_id; if not found then raise exception 'Vendedor não encontrado.'; end if; end $$;


ALTER FUNCTION "public"."eliminar_vendedor_admin"("p_vendedor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."encomenda_tem_disputa_ativa"("p_encomenda_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.disputas_encomenda d
    where d.encomenda_id = p_encomenda_id
      and d.estado in ('aberta', 'em_analise')
  );
$$;


ALTER FUNCTION "public"."encomenda_tem_disputa_ativa"("p_encomenda_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."entregador_pode_receber_entregas"("p_parceiro_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select cardinality(public.motivos_elegibilidade_entregador(p_parceiro_id)) = 0;
$$;


ALTER FUNCTION "public"."entregador_pode_receber_entregas"("p_parceiro_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expirar_destaques_antigos"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.produtos
  set
    destaque = false,
    destaque_inicio = null,
    destaque_ate = null,
    tipo_destaque = null
  where destaque = true
    and destaque_ate is not null
    and destaque_ate < now();

  update public.servicos
  set
    destaque = false,
    destaque_inicio = null,
    destaque_ate = null,
    tipo_destaque = null
  where destaque = true
    and destaque_ate is not null
    and destaque_ate < now();
end;
$$;


ALTER FUNCTION "public"."expirar_destaques_antigos"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clientes" (
    "id" "uuid" NOT NULL,
    "nome" "text",
    "telefone" "text",
    "email" "text",
    "provincia" "text",
    "municipio" "text",
    "foto_perfil" "text",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "atualizado_em" timestamp with time zone DEFAULT "now"(),
    "tipo_comprador" "text" DEFAULT 'casa'::"text",
    "conta_ativa" boolean DEFAULT true,
    "email_login" "text",
    "indicativo_telefone" "text",
    "telefone_nacional" "text",
    CONSTRAINT "clientes_tipo_comprador_check" CHECK (("tipo_comprador" = ANY (ARRAY['casa'::"text", 'negocio'::"text"])))
);


ALTER TABLE "public"."clientes" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."garantir_perfil_comprador"() RETURNS "public"."clientes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_cliente public.clientes%rowtype;
  v_vendedor public.vendedores%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão antes de criar a encomenda.';
  end if;

  select * into v_cliente
  from public.clientes
  where id = auth.uid()
  for update;

  if found then
    if coalesce(v_cliente.conta_ativa, true) = false then
      raise exception 'A conta de comprador está desativada.';
    end if;
    return v_cliente;
  end if;

  select * into v_vendedor
  from public.vendedores
  where user_id = auth.uid()
    and coalesce(conta_ativa, true) = true
  for update;

  if not found then
    raise exception 'É necessária uma conta de comprador ativa para criar encomendas.';
  end if;

  insert into public.clientes (
    id, nome, email, telefone, provincia, municipio, conta_ativa, tipo_comprador
  ) values (
    auth.uid(),
    nullif(btrim(coalesce(v_vendedor.nome_responsavel, v_vendedor.nome_comercial)), ''),
    nullif(btrim(v_vendedor.email), ''),
    nullif(btrim(coalesce(v_vendedor.telefone_whatsapp, v_vendedor.whatsapp)), ''),
    nullif(btrim(v_vendedor.provincia), ''),
    nullif(btrim(v_vendedor.municipio), ''),
    true,
    null
  )
  on conflict (id) do nothing;

  select * into v_cliente
  from public.clientes
  where id = auth.uid()
  for update;

  if not found or coalesce(v_cliente.conta_ativa, true) = false then
    raise exception 'Não foi possível preparar uma identidade de comprador ativa.';
  end if;

  return v_cliente;
end;
$$;


ALTER FUNCTION "public"."garantir_perfil_comprador"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gerar_codigo_publico_encomenda"() RETURNS "text"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  select format(
    'ANG-%s-%s',
    to_char(current_date, 'YYYY'),
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  );
$$;


ALTER FUNCTION "public"."gerar_codigo_publico_encomenda"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gerar_otp_entrega_aleatorio"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare v_bytes bytea := extensions.gen_random_bytes(4); v_valor bigint;
begin
  v_valor := (get_byte(v_bytes, 0)::bigint << 24) + (get_byte(v_bytes, 1)::bigint << 16) + (get_byte(v_bytes, 2)::bigint << 8) + get_byte(v_bytes, 3)::bigint;
  return lpad((v_valor % 1000000)::text, 6, '0');
end;
$$;


ALTER FUNCTION "public"."gerar_otp_entrega_aleatorio"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gerar_otp_levantamento_aleatorio"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_bytes bytea := extensions.gen_random_bytes(4);
  v_valor bigint;
begin
  v_valor :=
    (get_byte(v_bytes, 0)::bigint << 24)
    + (get_byte(v_bytes, 1)::bigint << 16)
    + (get_byte(v_bytes, 2)::bigint << 8)
    + get_byte(v_bytes, 3)::bigint;

  return lpad((v_valor % 1000000)::text, 6, '0');
end;
$$;


ALTER FUNCTION "public"."gerar_otp_levantamento_aleatorio"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gerar_referencia_pagamento_interna"() RETURNS "text"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  select format('PGT-%s-%s', to_char(current_date, 'YYYY'), upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)));
$$;


ALTER FUNCTION "public"."gerar_referencia_pagamento_interna"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gerar_referencia_tentativa_pagamento_interna"() RETURNS "text"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  select format('TPT-%s-%s', to_char(current_date, 'YYYY'), upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)));
$$;


ALTER FUNCTION "public"."gerar_referencia_tentativa_pagamento_interna"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (
    id,
    email,
    papel
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'papel',
      'cliente'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (
    id,
    nome,
    email,
    papel
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'papel', 'cliente')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hash_intervencao_entrega_admin"("p_payload" "jsonb") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select encode(extensions.digest(convert_to(p_payload::text, 'UTF8'), 'sha256'), 'hex');
$$;


ALTER FUNCTION "public"."hash_intervencao_entrega_admin"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."incrementar_clique_whatsapp_produto"("produto_id_param" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin

update produtos
set cliques_whatsapp = coalesce(cliques_whatsapp,0)+1
where id = produto_id_param;

end;
$$;


ALTER FUNCTION "public"."incrementar_clique_whatsapp_produto"("produto_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."incrementar_clique_whatsapp_servico"("servico_id_param" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin

update servicos
set cliques_whatsapp = coalesce(cliques_whatsapp,0)+1
where id = servico_id_param;

end;
$$;


ALTER FUNCTION "public"."incrementar_clique_whatsapp_servico"("servico_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."incrementar_visualizacao_produto"("produto_id_param" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin

update produtos
set visualizacoes = coalesce(visualizacoes,0)+1
where id = produto_id_param;

end;
$$;


ALTER FUNCTION "public"."incrementar_visualizacao_produto"("produto_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."incrementar_visualizacao_servico"("servico_id_param" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin

update servicos
set visualizacoes = coalesce(visualizacoes,0)+1
where id = servico_id_param;

end;
$$;


ALTER FUNCTION "public"."incrementar_visualizacao_servico"("servico_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COALESCE(auth.jwt() ->> 'email', '') = 'admin@angrolink.ao';
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_atual"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and papel = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin_atual"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_dono_vendedor"("vendedor_uuid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vendedores
    WHERE id = vendedor_uuid
      AND user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_dono_vendedor"("vendedor_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_vendedor_aprovado"("vendedor_uuid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vendedores
    WHERE id = vendedor_uuid
      AND user_id = auth.uid()
      AND status_aprovacao = 'aprovado'
  );
$$;


ALTER FUNCTION "public"."is_vendedor_aprovado"("vendedor_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_vendedor_publico_aprovado"("vendedor_uuid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.vendedores
    where id = vendedor_uuid
      and status_aprovacao = 'aprovado'
  );
$$;


ALTER FUNCTION "public"."is_vendedor_publico_aprovado"("vendedor_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."libertar_atribuicao_entrega_admin"("p_atribuicao_id" "uuid", "p_motivo" "text", "p_chave_idempotencia" "uuid") RETURNS "public"."atribuicoes_entrega_encomenda"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_motivo text := nullif(btrim(p_motivo), ''); v_hash text;
  v_idempotencia public.idempotencia_intervencao_entrega_admin%rowtype;
  v_atribuicao public.atribuicoes_entrega_encomenda%rowtype; v_encomenda public.encomendas%rowtype;
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if p_atribuicao_id is null or p_chave_idempotencia is null or v_motivo is null or char_length(v_motivo) not between 3 and 500 then
    raise exception 'Indique um motivo entre 3 e 500 caracteres.';
  end if;
  v_hash := public.hash_intervencao_entrega_admin(jsonb_build_object('atribuicao_id', p_atribuicao_id, 'motivo', v_motivo));
  insert into public.idempotencia_intervencao_entrega_admin(administrador_id,operacao,chave_idempotencia,payload_hash)
  values(auth.uid(),'libertar_atribuicao',p_chave_idempotencia,v_hash)
  on conflict (administrador_id,operacao,chave_idempotencia) do nothing;
  select * into v_idempotencia from public.idempotencia_intervencao_entrega_admin
  where administrador_id=auth.uid() and operacao='libertar_atribuicao' and chave_idempotencia=p_chave_idempotencia for update;
  if v_idempotencia.payload_hash <> v_hash then raise exception 'A chave de idempotência já foi usada com dados diferentes.'; end if;
  if v_idempotencia.atribuicao_id is not null then
    select * into v_atribuicao from public.atribuicoes_entrega_encomenda where id=v_idempotencia.atribuicao_id;
    return v_atribuicao;
  end if;
  select * into v_atribuicao from public.atribuicoes_entrega_encomenda where id=p_atribuicao_id for update;
  if not found then raise exception 'Atribuição não encontrada.'; end if;
  select * into v_encomenda from public.encomendas where id=v_atribuicao.encomenda_id for update;
  if v_encomenda.modalidade_recebimento <> 'entrega' or v_encomenda.estado <> 'pronta_para_levantamento' then raise exception 'Esta encomenda já não pode ter a atribuição libertada.'; end if;
  if v_atribuicao.estado not in ('atribuida','aceite','chegou_origem') or v_atribuicao.recolhida_em is not null then
    raise exception 'Não é possível libertar esta tarefa porque a mercadoria já foi recolhida ou a atribuição não está ativa.';
  end if;
  update public.atribuicoes_entrega_encomenda set estado='cancelada',cancelado_em=now(),motivo_cancelamento=v_motivo
  where id=v_atribuicao.id returning * into v_atribuicao;
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados)
  values(v_encomenda.id,'atribuicao_liberada_admin',v_encomenda.estado,v_encomenda.estado,'admin',auth.uid(),jsonb_build_object('atribuicao_id',v_atribuicao.id,'motivo',v_motivo));
  update public.idempotencia_intervencao_entrega_admin set atribuicao_id=v_atribuicao.id,concluida_em=now() where id=v_idempotencia.id;
  return v_atribuicao;
end;
$$;


ALTER FUNCTION "public"."libertar_atribuicao_entrega_admin"("p_atribuicao_id" "uuid", "p_motivo" "text", "p_chave_idempotencia" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_areas_cobertura_entregador_admin"("p_parceiro_id" "uuid", "p_limite" integer DEFAULT 25, "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if not exists (select 1 from public.parceiros_entrega where id = p_parceiro_id) then raise exception 'Entregador não encontrado.'; end if;
  return (
    with base as (
      select a.id, a.provincia, a.municipio, a.bairro, a.ativo, a.criado_em
      from public.areas_cobertura_entrega a where a.parceiro_id = p_parceiro_id
    ), pagina as (
      select * from base order by criado_em desc, id limit v_limite offset v_offset
    ), itens as (
      select coalesce(jsonb_agg(jsonb_build_object(
        'area_id', id, 'provincia', provincia, 'municipio', municipio, 'bairro', bairro,
        'ativo', ativo, 'criado_em', criado_em
      ) order by criado_em desc, id), '[]'::jsonb) as dados from pagina
    ) select jsonb_build_object('itens', itens.dados, 'paginacao', jsonb_build_object(
      'total_resultados', (select count(*) from base), 'limite', v_limite, 'offset', v_offset
    )) from itens
  );
end;
$$;


ALTER FUNCTION "public"."listar_areas_cobertura_entregador_admin"("p_parceiro_id" "uuid", "p_limite" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_compatibilidade_logistica_encomenda_admin"("p_encomenda_id" "uuid") RETURNS TABLE("parceiro_id" "uuid", "parceiro_nome" "text", "veiculo_id" "uuid", "tipo_veiculo" "text", "matricula" "text", "capacidade_kg" numeric, "capacidade_volume_m3" numeric, "possui_refrigeracao" boolean, "possui_caixa_carga" boolean, "aceita_paletes" boolean, "areas_cobertura" "jsonb", "estado" "text", "motivos" "text"[])
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_modalidade text;
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;
  select e.modalidade_recebimento into v_modalidade
  from public.encomendas e where e.id = p_encomenda_id;
  if not found then raise exception 'Encomenda não encontrada.'; end if;
  if v_modalidade <> 'entrega' then return; end if;

  return query
  select p.id, p.nome_completo, v.id, v.tipo_veiculo, v.matricula,
    v.capacidade_kg, v.capacidade_volume_m3, v.possui_refrigeracao,
    v.possui_caixa_carga, v.aceita_paletes,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'provincia', a.provincia, 'municipio', a.municipio, 'bairro', a.bairro
      ) order by a.provincia, a.municipio, a.bairro)
      from public.areas_cobertura_entrega a
      where a.parceiro_id = p.id and a.ativo
    ), '[]'::jsonb), compatibilidade.estado, compatibilidade.motivos
  from public.veiculos_entrega v
  join public.parceiros_entrega p on p.id = v.parceiro_id
  cross join lateral public.avaliar_compatibilidade_veiculo_encomenda(v.id, p_encomenda_id) compatibilidade
  order by
    case compatibilidade.estado when 'compativel' then 1 when 'dados_incompletos' then 2 else 3 end,
    p.nome_completo, v.matricula, v.id;
end;
$$;


ALTER FUNCTION "public"."listar_compatibilidade_logistica_encomenda_admin"("p_encomenda_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_compradores_admin"("p_tipo_comprador" "text" DEFAULT NULL::"text", "p_conta_ativa" boolean DEFAULT NULL::boolean, "p_provincia" "text" DEFAULT NULL::"text", "p_municipio" "text" DEFAULT NULL::"text", "p_com_disputas" boolean DEFAULT NULL::boolean, "p_com_cancelamentos" boolean DEFAULT NULL::boolean, "p_registo_recente" boolean DEFAULT NULL::boolean, "p_pesquisa" "text" DEFAULT NULL::"text", "p_limite" integer DEFAULT 25, "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_pesquisa text := nullif(btrim(p_pesquisa), '');
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  if p_tipo_comprador is not null and p_tipo_comprador not in ('casa', 'negocio') then
    raise exception 'Tipo de comprador inválido.';
  end if;

  return (
    with base as (
      select
        c.id as cliente_id,
        c.id as user_id,
        coalesce(nullif(btrim(c.nome), ''), nullif(btrim(pr.nome), ''), 'Comprador sem nome') as nome,
        c.foto_perfil as foto_url,
        c.email,
        c.telefone,
        c.tipo_comprador,
        c.provincia,
        c.municipio,
        coalesce(c.conta_ativa, false) as conta_ativa,
        coalesce(c.criado_em, au.created_at) as criado_em,
        coalesce(en.total, 0)::bigint as total_encomendas,
        coalesce(en.concluidas, 0)::bigint as encomendas_concluidas,
        coalesce(en.canceladas, 0)::bigint as encomendas_canceladas,
        coalesce(di.total, 0)::bigint as total_disputas,
        coalesce(pg.total, 0)::bigint as total_pagamentos,
        atividade.ultima_atividade_em,
        concat_ws(' ', c.nome, c.email, c.telefone, c.telefone_nacional) as texto_pesquisa
      from public.clientes c
      join auth.users au on au.id = c.id
      left join public.profiles pr on pr.id = c.id
      left join lateral (
        select
          count(*) as total,
          count(*) filter (where e.estado = 'concluida') as concluidas,
          count(*) filter (where e.estado = 'cancelada') as canceladas,
          max(e.atualizado_em) as ultima_encomenda_em
        from public.encomendas e
        where e.cliente_id = c.id
      ) en on true
      left join lateral (
        select count(*) as total, max(d.atualizado_em) as ultima_disputa_em
        from public.disputas_encomenda d
        where d.cliente_id = c.id
      ) di on true
      left join lateral (
        select count(*) as total, max(p.criado_em) as ultimo_pagamento_em
        from public.pagamentos p
        where p.cliente_id = c.id
      ) pg on true
      left join lateral (
        select max(x.ocorrido_em) as ultima_atividade_em
        from (
          select c.criado_em as ocorrido_em
          union all select en.ultima_encomenda_em
          union all select di.ultima_disputa_em
          union all select pg.ultimo_pagamento_em
          union all select max(h.criado_em) from public.historico_contactos h where h.cliente_id = c.id
          union all select max(hs.criado_em) from public.historico_contactos_servicos hs where hs.cliente_id = c.id
          union all select max(f.criado_em) from public.favoritos f where f.utilizador_id = c.id
        ) x
      ) atividade on true
    ), filtrados as (
      select * from base
      where (p_tipo_comprador is null or tipo_comprador = p_tipo_comprador)
        and (p_conta_ativa is null or conta_ativa = p_conta_ativa)
        and (p_provincia is null or provincia = p_provincia)
        and (p_municipio is null or municipio = p_municipio)
        and (p_com_disputas is null or (total_disputas > 0) = p_com_disputas)
        and (p_com_cancelamentos is null or (encomendas_canceladas > 0) = p_com_cancelamentos)
        and (p_registo_recente is not true or criado_em >= now() - interval '30 days')
        and (v_pesquisa is null or lower(texto_pesquisa) like '%' || lower(v_pesquisa) || '%')
    ), contagens as (
      select
        count(*)::bigint as total,
        count(*) filter (where conta_ativa)::bigint as ativos,
        count(*) filter (where not conta_ativa)::bigint as inativos,
        count(*) filter (where tipo_comprador = 'casa')::bigint as casa,
        count(*) filter (where tipo_comprador = 'negocio')::bigint as negocio,
        count(*) filter (where total_disputas > 0)::bigint as com_disputas
      from base
    ), total_filtrado as (
      select count(*)::bigint as total_resultados from filtrados
    ), pagina as (
      select * from filtrados
      order by coalesce(ultima_atividade_em, criado_em) desc, cliente_id
      limit v_limite offset v_offset
    ), itens as (
      select coalesce(jsonb_agg(jsonb_build_object(
        'cliente_id', cliente_id,
        'user_id', user_id,
        'nome', nome,
        'foto_url', foto_url,
        'email', email,
        'telefone', telefone,
        'tipo_comprador', tipo_comprador,
        'provincia', provincia,
        'municipio', municipio,
        'conta_ativa', conta_ativa,
        'criado_em', criado_em,
        'total_encomendas', total_encomendas,
        'encomendas_concluidas', encomendas_concluidas,
        'encomendas_canceladas', encomendas_canceladas,
        'total_disputas', total_disputas,
        'total_pagamentos', total_pagamentos,
        'ultima_atividade_em', ultima_atividade_em
      ) order by coalesce(ultima_atividade_em, criado_em) desc, cliente_id), '[]'::jsonb) as dados
      from pagina
    )
    select jsonb_build_object(
      'itens', i.dados,
      'paginacao', jsonb_build_object(
        'total_resultados', t.total_resultados,
        'limite', v_limite,
        'offset', v_offset
      ),
      'contagens', jsonb_build_object(
        'total', c.total,
        'ativos', c.ativos,
        'inativos', c.inativos,
        'casa', c.casa,
        'negocio', c.negocio,
        'com_disputas', c.com_disputas
      )
    )
    from itens i
    cross join contagens c
    cross join total_filtrado t
  );
end;
$$;


ALTER FUNCTION "public"."listar_compradores_admin"("p_tipo_comprador" "text", "p_conta_ativa" boolean, "p_provincia" "text", "p_municipio" "text", "p_com_disputas" boolean, "p_com_cancelamentos" boolean, "p_registo_recente" boolean, "p_pesquisa" "text", "p_limite" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_contactos_produtos_vendedor"() RETURNS TABLE("id" "uuid", "cliente_id" "uuid", "vendedor_id" "uuid", "produto_id" "uuid", "criado_em" timestamp with time zone, "atualizado_em" timestamp with time zone, "clientes" "jsonb", "produtos" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
 select h.id,h.cliente_id,h.vendedor_id,h.produto_id,h.criado_em,h.atualizado_em,jsonb_build_object('nome',c.nome,'telefone',c.telefone,'foto_perfil',c.foto_perfil),jsonb_build_object('id',p.id,'nome_produto',p.nome_produto,'imagem_url',p.imagem_url)
 from public.historico_contactos h join public.vendedores v on v.id=h.vendedor_id left join public.clientes c on c.id=h.cliente_id left join public.produtos p on p.id=h.produto_id where v.user_id=auth.uid() order by h.atualizado_em desc $$;


ALTER FUNCTION "public"."listar_contactos_produtos_vendedor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_contactos_servicos_vendedor"() RETURNS TABLE("id" "uuid", "cliente_id" "uuid", "vendedor_id" "uuid", "servico_id" "uuid", "criado_em" timestamp with time zone, "atualizado_em" timestamp with time zone, "clientes" "jsonb", "servicos" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
 select h.id,h.cliente_id,h.vendedor_id,h.servico_id,h.criado_em,h.atualizado_em,jsonb_build_object('nome',c.nome,'telefone',c.telefone,'foto_perfil',c.foto_perfil),jsonb_build_object('id',s.id,'nome_servico',s.nome_servico,'imagem_url',s.imagem_url)
 from public.historico_contactos_servicos h join public.vendedores v on v.id=h.vendedor_id left join public.clientes c on c.id=h.cliente_id left join public.servicos s on s.id=h.servico_id where v.user_id=auth.uid() order by h.atualizado_em desc $$;


ALTER FUNCTION "public"."listar_contactos_servicos_vendedor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_disputas_admin"("p_estado" "text" DEFAULT NULL::"text") RETURNS TABLE("disputa_id" "uuid", "encomenda_id" "uuid", "codigo_publico" "text", "cliente_nome" "text", "vendedor_nome" "text", "tipo_problema" "text", "estado" "text", "descricao_resumida" "text", "valor_reclamado_centimos" bigint, "pagamento_id" "uuid", "criado_em" timestamp with time zone, "atualizado_em" timestamp with time zone, "responsavel_admin_id" "uuid")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  return query
  select d.id, d.encomenda_id, e.codigo_publico, c.nome, v.nome_comercial,
    d.tipo_problema, d.estado, left(d.descricao, 240), d.valor_reclamado_centimos,
    d.pagamento_id, d.criado_em, d.atualizado_em, d.analisado_por
  from public.disputas_encomenda d
  join public.encomendas e on e.id = d.encomenda_id
  join public.clientes c on c.id = d.cliente_id
  join public.vendedores v on v.id = d.vendedor_id
  where p_estado is null or d.estado = p_estado
  order by d.atualizado_em desc;
end;
$$;


ALTER FUNCTION "public"."listar_disputas_admin"("p_estado" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_disputas_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer DEFAULT 25, "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100); v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if not exists (select 1 from public.vendedores where id = p_vendedor_id) then raise exception 'Vendedor não encontrado.'; end if;
  return (with base as (
    select d.id, d.encomenda_id, e.codigo_publico, c.id cliente_id, c.nome cliente_nome, d.tipo_problema, d.estado, d.criado_em, d.atualizado_em
    from public.disputas_encomenda d join public.encomendas e on e.id=d.encomenda_id join public.clientes c on c.id=d.cliente_id
    where d.vendedor_id=p_vendedor_id
  ), pagina as (select * from base order by atualizado_em desc,id limit v_limite offset v_offset), itens as (
    select coalesce(jsonb_agg(jsonb_build_object('disputa_id',id,'encomenda_id',encomenda_id,'codigo_publico',codigo_publico,
      'cliente_id',cliente_id,'cliente_nome',cliente_nome,'tipo',tipo_problema,'estado',estado,'criado_em',criado_em,'atualizado_em',atualizado_em)
      order by atualizado_em desc,id),'[]'::jsonb) dados from pagina
  ) select jsonb_build_object('itens',itens.dados,'paginacao',jsonb_build_object('total_resultados',(select count(*) from base),'limite',v_limite,'offset',v_offset)) from itens);
end;
$$;


ALTER FUNCTION "public"."listar_disputas_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_documentos_entregador_admin"("p_parceiro_id" "uuid", "p_limite" integer DEFAULT 25, "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if not exists (select 1 from public.parceiros_entrega where id = p_parceiro_id) then raise exception 'Entregador não encontrado.'; end if;
  return (
    with base as (
      select d.id, d.tipo_documento, d.numero_documento, d.validade, d.estado,
        d.veiculo_id, v.matricula as veiculo_matricula,
        d.frente_path is not null as frente_disponivel, d.verso_path is not null as verso_disponivel,
        d.criado_em, d.atualizado_em, d.analisado_por, d.analisado_em, d.motivo_rejeicao
      from public.documentos_parceiro_entrega d
      left join public.veiculos_entrega v on v.id = d.veiculo_id
      where d.parceiro_id = p_parceiro_id
    ), pagina as (
      select * from base order by criado_em desc, id limit v_limite offset v_offset
    ), itens as (
      select coalesce(jsonb_agg(jsonb_build_object(
        'documento_id', id, 'tipo_documento', tipo_documento, 'numero_documento', numero_documento,
        'validade', validade, 'estado', estado, 'veiculo_id', veiculo_id,
        'veiculo_matricula', veiculo_matricula, 'frente_disponivel', frente_disponivel,
        'verso_disponivel', verso_disponivel, 'criado_em', criado_em, 'atualizado_em', atualizado_em,
        'analisado_por', analisado_por, 'analisado_em', analisado_em, 'motivo_rejeicao', motivo_rejeicao
      ) order by criado_em desc, id), '[]'::jsonb) as dados
      from pagina
    ) select jsonb_build_object('itens', itens.dados, 'paginacao', jsonb_build_object(
      'total_resultados', (select count(*) from base), 'limite', v_limite, 'offset', v_offset
    )) from itens
  );
end;
$$;


ALTER FUNCTION "public"."listar_documentos_entregador_admin"("p_parceiro_id" "uuid", "p_limite" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_encomendas_admin"("p_estado" "text" DEFAULT NULL::"text", "p_cliente_id" "uuid" DEFAULT NULL::"uuid", "p_vendedor_id" "uuid" DEFAULT NULL::"uuid", "p_estado_pagamento" "text" DEFAULT NULL::"text", "p_com_disputa" boolean DEFAULT NULL::boolean, "p_de" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_ate" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("encomenda_id" "uuid", "codigo_publico" "text", "criado_em" timestamp with time zone, "atualizado_em" timestamp with time zone, "estado" "text", "modalidade" "text", "cliente_id" "uuid", "cliente_nome" "text", "vendedor_id" "uuid", "vendedor_nome" "text", "quantidade_itens" bigint, "subtotal_centimos" bigint, "desconto_centimos" bigint, "entrega_centimos" bigint, "total_centimos" bigint, "estado_pagamento" "text", "tem_disputa" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  return query
  select e.id, e.codigo_publico, e.criado_em, e.atualizado_em, e.estado,
    e.modalidade_recebimento, e.cliente_id, c.nome, e.vendedor_id, v.nome_comercial,
    count(i.id), e.subtotal_centimos, e.desconto_centimos, e.entrega_centimos,
    e.total_centimos, p.estado, public.encomenda_tem_disputa_ativa(e.id)
  from public.encomendas e
  join public.clientes c on c.id = e.cliente_id
  join public.vendedores v on v.id = e.vendedor_id
  left join public.itens_encomenda i on i.encomenda_id = e.id
  left join public.pagamentos p on p.encomenda_id = e.id
  where (p_estado is null or e.estado = p_estado)
    and (p_cliente_id is null or e.cliente_id = p_cliente_id)
    and (p_vendedor_id is null or e.vendedor_id = p_vendedor_id)
    and (p_estado_pagamento is null or p.estado = p_estado_pagamento)
    and (p_com_disputa is null or public.encomenda_tem_disputa_ativa(e.id) = p_com_disputa)
    and (p_de is null or e.criado_em >= p_de)
    and (p_ate is null or e.criado_em <= p_ate)
  group by e.id, c.nome, v.nome_comercial, p.estado
  order by e.atualizado_em desc;
end;
$$;


ALTER FUNCTION "public"."listar_encomendas_admin"("p_estado" "text", "p_cliente_id" "uuid", "p_vendedor_id" "uuid", "p_estado_pagamento" "text", "p_com_disputa" boolean, "p_de" timestamp with time zone, "p_ate" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_encomendas_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer DEFAULT 25, "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100); v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if not exists (select 1 from public.vendedores where id = p_vendedor_id) then raise exception 'Vendedor não encontrado.'; end if;
  return (with base as (
    select e.id, e.codigo_publico, c.id cliente_id, c.nome cliente_nome, e.criado_em, e.estado, e.total_centimos,
      pg.estado estado_pagamento, exists(select 1 from public.disputas_encomenda d where d.encomenda_id=e.id) tem_disputa
    from public.encomendas e join public.clientes c on c.id=e.cliente_id left join public.pagamentos pg on pg.encomenda_id=e.id
    where e.vendedor_id=p_vendedor_id
  ), pagina as (select * from base order by criado_em desc,id limit v_limite offset v_offset), itens as (
    select coalesce(jsonb_agg(jsonb_build_object('encomenda_id',id,'codigo_publico',codigo_publico,'cliente_id',cliente_id,
      'cliente_nome',cliente_nome,'criado_em',criado_em,'estado',estado,'total_centimos',total_centimos,
      'estado_pagamento',estado_pagamento,'tem_disputa',tem_disputa) order by criado_em desc,id),'[]'::jsonb) dados from pagina
  ) select jsonb_build_object('itens',itens.dados,'paginacao',jsonb_build_object('total_resultados',(select count(*) from base),'limite',v_limite,'offset',v_offset)) from itens);
end;
$$;


ALTER FUNCTION "public"."listar_encomendas_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_financeiro_admin"() RETURNS TABLE("pagamento_id" "uuid", "encomenda_id" "uuid", "codigo_publico" "text", "cliente_nome" "text", "vendedor_nome" "text", "estado_pagamento" "text", "metodo" "text", "subtotal_centimos" bigint, "desconto_centimos" bigint, "entrega_centimos" bigint, "total_centimos" bigint, "comissao_snapshot_centimos" bigint, "comissao_efetiva_centimos" bigint, "valor_vendedor_snapshot_centimos" bigint, "valor_vendedor_efetivo_centimos" bigint, "total_reembolsado_centimos" bigint, "estado_repasse" "text", "referencia_interna" "text", "criado_em" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  return query
  select p.id, p.encomenda_id, e.codigo_publico, c.nome, v.nome_comercial,
    p.estado, t.metodo, p.subtotal_centimos, p.desconto_centimos, p.entrega_centimos,
    p.total_cliente_centimos, p.comissao_angrolink_centimos, x.comissao_efetiva_centimos,
    p.valor_vendedor_centimos, x.valor_vendedor_efetivo_centimos,
    x.reembolso_total_aprovado_centimos, r.estado, p.referencia_interna, p.criado_em
  from public.pagamentos p
  join public.encomendas e on e.id = p.encomenda_id
  join public.clientes c on c.id = p.cliente_id
  join public.vendedores v on v.id = p.vendedor_id
  join lateral public.calcular_valores_financeiros_efetivos(p.id) x on true
  left join lateral (
    select tt.metodo from public.tentativas_pagamento tt
    where tt.pagamento_id = p.id order by tt.criado_em desc limit 1
  ) t on true
  left join public.repasses_vendedor r on r.pagamento_id = p.id
  order by p.criado_em desc;
end;
$$;


ALTER FUNCTION "public"."listar_financeiro_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_historico_documental_entregador_admin"("p_parceiro_id" "uuid", "p_limite" integer DEFAULT 25, "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  return (
    with documentos as (
      select
        d.id as documento_id,
        d.tipo_documento,
        d.veiculo_id,
        ve.matricula as veiculo_matricula,
        d.versao_atual_id,
        atual.numero_versao as versao_atual,
        coalesce(atual.estado, d.estado) as estado_atual,
        coalesce(atual.validade_snapshot, d.validade) as validade_atual,
        coalesce(atual.criado_em, d.atualizado_em, d.criado_em) as atualizado_em,
        count(versao.id)::integer as total_versoes
      from public.documentos_parceiro_entrega d
      left join public.versoes_documento_parceiro_entrega atual
        on atual.id = d.versao_atual_id
      left join public.versoes_documento_parceiro_entrega versao
        on versao.documento_id = d.id
      left join public.veiculos_entrega ve
        on ve.id = d.veiculo_id
      where d.parceiro_id = p_parceiro_id
      group by d.id, d.tipo_documento, d.veiculo_id, ve.matricula, d.versao_atual_id,
        atual.numero_versao, atual.estado, d.estado, atual.validade_snapshot, d.validade,
        atual.criado_em, d.atualizado_em, d.criado_em
    ), pagina as (
      select *
      from documentos
      order by atualizado_em desc nulls last, documento_id
      limit v_limite offset v_offset
    )
    select jsonb_build_object(
      'itens', coalesce(
        (
          select jsonb_agg(jsonb_build_object(
          'documento_id', p.documento_id,
          'tipo_documento', p.tipo_documento,
          'veiculo_id', p.veiculo_id,
          'veiculo_matricula', p.veiculo_matricula,
          'versao_atual_id', p.versao_atual_id,
          'versao_atual', p.versao_atual,
          'total_versoes', p.total_versoes,
          'estado_atual', p.estado_atual,
          'validade_atual', p.validade_atual,
          'atualizado_em', p.atualizado_em,
          'versoes', coalesce(
            (
              select jsonb_agg(jsonb_build_object(
              'versao_id', v.id,
              'numero_versao', v.numero_versao,
              'estado', v.estado,
              'numero_documento', v.numero_documento_snapshot,
              'validade', v.validade_snapshot,
              'criado_em', v.criado_em,
              'analisado_por', v.analisado_por,
              'analisado_em', v.analisado_em,
              'motivo_rejeicao', v.motivo_rejeicao,
              'substituido_em', v.substituido_em,
              'frente_disponivel', (v.frente_path is not null),
              'verso_disponivel', (v.verso_path is not null)
              ) order by v.numero_versao desc)
              from public.versoes_documento_parceiro_entrega v
              where v.documento_id = p.documento_id
            ),
            '[]'::jsonb
          ),
          'eventos', coalesce(
            (
              select jsonb_agg(jsonb_build_object(
              'evento_id', e.id,
              'versao_id', e.versao_id,
              'ator_tipo', e.ator_tipo,
              'utilizador_id', e.utilizador_id,
              'evento', e.evento,
              'estado_anterior', e.estado_anterior,
              'estado_novo', e.estado_novo,
              'motivo', e.motivo,
              'criado_em', e.criado_em
              ) order by e.criado_em, e.id)
              from public.eventos_documento_parceiro_entrega e
              where e.documento_id = p.documento_id
            ),
            '[]'::jsonb
          )
          ) order by p.atualizado_em desc nulls last, p.documento_id)
          from pagina p
        ),
        '[]'::jsonb
      ),
      'paginacao', jsonb_build_object(
        'total_resultados', (select count(*) from documentos),
        'limite', v_limite,
        'offset', v_offset
      )
    )
  );
end;
$$;


ALTER FUNCTION "public"."listar_historico_documental_entregador_admin"("p_parceiro_id" "uuid", "p_limite" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_historico_documental_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer DEFAULT 25, "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100); v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if not exists (select 1 from public.vendedores where id = p_vendedor_id) then raise exception 'Vendedor não encontrado.'; end if;
  return (with base as (
    select de.evento, de.documento_id, de.estado_anterior, de.estado_novo, de.motivo_rejeicao, de.realizado_por, de.criado_em, de.id
    from public.documentos_vendedor_eventos de where de.vendedor_id=p_vendedor_id
  ), pagina as (select * from base order by criado_em desc,id limit v_limite offset v_offset), itens as (
    select coalesce(jsonb_agg(jsonb_build_object('evento',evento,'documento_id',documento_id,'estado_anterior',estado_anterior,
      'estado_novo',estado_novo,'motivo_rejeicao',motivo_rejeicao,'realizado_por',realizado_por,'criado_em',criado_em)
      order by criado_em desc,id),'[]'::jsonb) dados from pagina
  ) select jsonb_build_object('itens',itens.dados,'paginacao',jsonb_build_object('total_resultados',(select count(*) from base),'limite',v_limite,'offset',v_offset)) from itens);
end;
$$;


ALTER FUNCTION "public"."listar_historico_documental_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_municipios_angola"("p_provincia_id" "uuid") RETURNS TABLE("id" "uuid", "codigo_oficial" "text", "nome" "text", "provincia_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select m.id, m.codigo_oficial, m.nome, m.provincia_id
  from public.municipios_angola m join public.provincias_angola p on p.id = m.provincia_id
  where m.provincia_id = p_provincia_id and p.ativo and m.ativo
  order by m.numero_oficial, m.nome;
$$;


ALTER FUNCTION "public"."listar_municipios_angola"("p_provincia_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notificacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "utilizador_id" "uuid" NOT NULL,
    "contexto" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "mensagem" "text" NOT NULL,
    "entidade_tipo" "text",
    "entidade_id" "uuid",
    "url_destino" "text",
    "lida" boolean DEFAULT false NOT NULL,
    "lida_em" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "chave_idempotencia" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notificacoes_contexto_check" CHECK (("contexto" = ANY (ARRAY['compra'::"text", 'venda'::"text", 'entrega'::"text"]))),
    CONSTRAINT "notificacoes_url_destino_check" CHECK ((("url_destino" IS NULL) OR (("left"("url_destino", 1) = '/'::"text") AND ("left"("url_destino", 2) <> '//'::"text"))))
);


ALTER TABLE "public"."notificacoes" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_notificacoes"("p_limite" integer DEFAULT 20, "p_antes_de" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS SETOF "public"."notificacoes"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  return query
  select n.*
  from public.notificacoes n
  where n.utilizador_id = auth.uid()
    and (p_antes_de is null or n.criado_em < p_antes_de)
  order by n.criado_em desc
  limit least(greatest(coalesce(p_limite, 20), 1), 100);
end;
$$;


ALTER FUNCTION "public"."listar_notificacoes"("p_limite" integer, "p_antes_de" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_pagamentos_cliente"() RETURNS TABLE("id" "uuid", "encomenda_id" "uuid", "referencia_interna" "text", "moeda" character, "estado" "text", "total_cliente_centimos" bigint, "criado_em" timestamp with time zone, "confirmado_em" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p.id, p.encomenda_id, p.referencia_interna, p.moeda, p.estado, p.total_cliente_centimos, p.criado_em, p.confirmado_em
  from public.pagamentos p where p.cliente_id = auth.uid() order by p.criado_em desc;
$$;


ALTER FUNCTION "public"."listar_pagamentos_cliente"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_produtos_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer DEFAULT 25, "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100); v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if not exists (select 1 from public.vendedores where id = p_vendedor_id) then raise exception 'Vendedor não encontrado.'; end if;
  return (with base as (
    select p.id, p.nome_produto, p.categoria_id, p.preco_aproximado, p.preco_promocional, p.preco_grosso, p.tipo_venda,
      coalesce(p.publicado,false) publicado, coalesce(p.disponivel,false) disponivel, coalesce(p.destaque,false) destaque,
      coalesce(p.visualizacoes,0) visualizacoes, coalesce(p.cliques_whatsapp,0) cliques_whatsapp, p.criado_em
    from public.produtos p where p.vendedor_id = p_vendedor_id
  ), pagina as (select * from base order by criado_em desc, id limit v_limite offset v_offset), itens as (
    select coalesce(jsonb_agg(jsonb_build_object('produto_id',id,'nome',nome_produto,'categoria_id',categoria_id,
      'preco_base',preco_aproximado,'preco_promocional',preco_promocional,'preco_grosso',preco_grosso,'tipo_venda',tipo_venda,
      'publicado',publicado,'disponivel',disponivel,'destaque',destaque,'visualizacoes',visualizacoes,'cliques_whatsapp',cliques_whatsapp,
      'criado_em',criado_em) order by criado_em desc, id), '[]'::jsonb) dados from pagina
  ) select jsonb_build_object('itens',itens.dados,'paginacao',jsonb_build_object('total_resultados',(select count(*) from base),'limite',v_limite,'offset',v_offset)) from itens);
end;
$$;


ALTER FUNCTION "public"."listar_produtos_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_provincias_angola"() RETURNS TABLE("id" "uuid", "codigo_oficial" "text", "nome" "text", "ordem" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p.id, p.codigo_oficial, p.nome, p.ordem
  from public.provincias_angola p where p.ativo order by p.ordem, p.nome;
$$;


ALTER FUNCTION "public"."listar_provincias_angola"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_resumo_financeiro_vendedor"() RETURNS TABLE("pagamento_id" "uuid", "encomenda_id" "uuid", "referencia_interna" "text", "moeda" character, "estado_pagamento" "text", "valor_vendedor_centimos" bigint, "estado_repasse" "text", "valor_repasse_centimos" bigint, "disponivel_em" timestamp with time zone, "processado_em" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p.id, p.encomenda_id, p.referencia_interna, p.moeda, p.estado, p.valor_vendedor_centimos, r.estado, r.valor_centimos, r.disponivel_em, r.processado_em
  from public.pagamentos p join public.vendedores v on v.id = p.vendedor_id left join public.repasses_vendedor r on r.pagamento_id = p.id
  where v.user_id = auth.uid() order by p.criado_em desc;
$$;


ALTER FUNCTION "public"."listar_resumo_financeiro_vendedor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_servicos_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer DEFAULT 25, "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100); v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if not exists (select 1 from public.vendedores where id = p_vendedor_id) then raise exception 'Vendedor não encontrado.'; end if;
  return (with base as (
    select s.id, s.nome_servico, s.tipo_servico, s.preco_estimado, coalesce(s.publicado,false) publicado,
      coalesce(s.disponivel,false) disponivel, coalesce(s.destaque,false) destaque, coalesce(s.visualizacoes,0) visualizacoes,
      coalesce(s.cliques_whatsapp,0) cliques_whatsapp, s.criado_em from public.servicos s where s.vendedor_id = p_vendedor_id
  ), pagina as (select * from base order by criado_em desc, id limit v_limite offset v_offset), itens as (
    select coalesce(jsonb_agg(jsonb_build_object('servico_id',id,'nome',nome_servico,'tipo_servico',tipo_servico,
      'preco_estimado',preco_estimado,'publicado',publicado,'disponivel',disponivel,'destaque',destaque,
      'visualizacoes',visualizacoes,'cliques_whatsapp',cliques_whatsapp,'criado_em',criado_em) order by criado_em desc,id), '[]'::jsonb) dados from pagina
  ) select jsonb_build_object('itens',itens.dados,'paginacao',jsonb_build_object('total_resultados',(select count(*) from base),'limite',v_limite,'offset',v_offset)) from itens);
end;
$$;


ALTER FUNCTION "public"."listar_servicos_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_tarefas_entregador"() RETURNS TABLE("id" "uuid", "encomenda_id" "uuid", "codigo_publico" "text", "estado" "text", "atribuido_em" timestamp with time zone, "aceite_em" timestamp with time zone, "recusado_em" timestamp with time zone, "motivo_recusa" "text", "tipo_veiculo" "text", "matricula" "text", "origem" "jsonb", "destino" "jsonb", "quantidade_itens" integer, "requisitos_logisticos" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  return query select a.id,e.id,e.codigo_publico,a.estado,a.atribuido_em,a.aceite_em,a.recusado_em,a.motivo_recusa,v.tipo_veiculo,v.matricula,
    jsonb_build_object('provincia',e.provincia,'municipio',e.municipio,'bairro',e.bairro,'endereco',e.endereco_levantamento),
    jsonb_build_object('provincia',d.provincia,'municipio',d.municipio,'bairro',d.bairro,'endereco',d.endereco_detalhado),
    (select count(*)::integer from public.itens_encomenda i where i.encomenda_id=e.id),
    coalesce((select jsonb_build_object('peso_total_kg',r.peso_total_kg,'peso_total_conhecido',r.peso_total_conhecido,'volume_total_m3',r.volume_total_m3,'volume_total_conhecido',r.volume_total_conhecido,'requer_refrigeracao',r.requer_refrigeracao,'requer_caixa_carga',r.requer_caixa_carga,'requer_paletes',r.requer_paletes) from public.calcular_requisitos_logisticos_encomenda(e.id) r),'{}'::jsonb)
  from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id join public.encomendas e on e.id=a.encomenda_id join public.veiculos_entrega v on v.id=a.veiculo_id left join public.enderecos_entrega_encomenda d on d.encomenda_id=e.id where p.user_id=auth.uid() order by a.atribuido_em desc;
end; $$;


ALTER FUNCTION "public"."listar_tarefas_entregador"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_utilizadores_admin"("p_papel" "text" DEFAULT NULL::"text", "p_estado" "text" DEFAULT NULL::"text", "p_provincia" "text" DEFAULT NULL::"text", "p_registo_recente" boolean DEFAULT NULL::boolean, "p_pesquisa" "text" DEFAULT NULL::"text", "p_limite" integer DEFAULT 25, "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_pesquisa text := nullif(btrim(p_pesquisa), '');
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  if p_papel is not null and p_papel not in ('cliente', 'vendedor', 'parceiro_entrega', 'admin') then
    raise exception 'Filtro de papel inválido.';
  end if;

  if p_estado is not null and p_estado not in ('ativo', 'pendente', 'suspenso', 'rejeitado', 'inativo') then
    raise exception 'Filtro de estado inválido.';
  end if;

  return (
  with base as (
    select
      au.id as base_user_id,
      array_remove(array[
        case when c.id is not null then 'cliente' end,
        case when v.id is not null then 'vendedor' end,
        case when pe.id is not null then 'parceiro_entrega' end,
        case when a.user_id is not null then 'admin' end
      ], null)::text[] as base_papeis,
      coalesce(
        nullif(btrim(pr.nome), ''),
        nullif(btrim(c.nome), ''),
        nullif(btrim(v.nome_responsavel), ''),
        nullif(btrim(v.nome_comercial), ''),
        nullif(btrim(pe.nome_completo), ''),
        nullif(split_part(au.email, '@', 1), ''),
        'Utilizador sem nome'
      ) as base_nome,
      coalesce(c.foto_perfil, v.foto_perfil) as base_foto_url,
      coalesce(c.email, v.email, pe.email, au.email) as base_email,
      coalesce(c.telefone, v.telefone_whatsapp, v.whatsapp, pe.telefone) as base_telefone,
      coalesce(c.provincia, v.provincia, pe.provincia) as base_provincia,
      coalesce(c.municipio, v.municipio, pe.municipio) as base_municipio,
      au.created_at as base_criado_em,
      jsonb_build_object(
        'cliente', case when c.id is null then null when coalesce(c.conta_ativa, false) then 'ativo' else 'inativo' end,
        'vendedor', case when v.id is null then null when v.status_aprovacao = 'aprovado' and coalesce(v.conta_ativa, false) then 'ativo' when v.status_aprovacao = 'pendente' then 'pendente' when v.status_aprovacao = 'suspenso' then 'suspenso' when v.status_aprovacao = 'rejeitado' then 'rejeitado' else 'inativo' end,
        'parceiro_entrega', case when pe.id is null then null when pe.estado = 'aprovado' then 'ativo' when pe.estado in ('rascunho', 'documentos_pendentes', 'em_analise') then 'pendente' when pe.estado in ('suspenso', 'documentacao_expirada') then 'suspenso' when pe.estado = 'rejeitado' then 'rejeitado' else 'inativo' end,
        -- A pertença a administradores é a autorização administrativa real atual.
        'admin', case when a.user_id is null then null else 'ativo' end
      ) as base_estados_papeis,
      exists (
        select 1 from public.documentos_vendedor dv
        where dv.vendedor_id = v.id and dv.estado in ('pendente', 'em_analise', 'rejeitado', 'expirado')
      ) or exists (
        select 1 from public.documentos_parceiro_entrega dp
        where dp.parceiro_id = pe.id and dp.estado in ('pendente', 'rejeitado', 'expirado')
      ) as base_pendencia_documental,
      jsonb_build_object(
        'vendedor', exists (
          select 1 from public.documentos_vendedor dv
          where dv.vendedor_id = v.id and dv.estado in ('pendente', 'em_analise', 'rejeitado', 'expirado')
        ),
        'parceiro_entrega', exists (
          select 1 from public.documentos_parceiro_entrega dp
          where dp.parceiro_id = pe.id and dp.estado in ('pendente', 'rejeitado', 'expirado')
        )
      ) as base_pendencias_documentais_papeis,
      concat_ws(' ', c.nome, v.nome_responsavel, v.nome_comercial, pe.nome_completo,
        c.email, v.email, pe.email, au.email,
        c.telefone, v.telefone_whatsapp, v.whatsapp, pe.telefone) as base_pesquisa
    from auth.users au
    left join public.profiles pr on pr.id = au.id and pr.ativo and pr.apagado_em is null
    left join lateral (
      select * from public.clientes where id = au.id order by criado_em desc limit 1
    ) c on true
    left join lateral (
      select * from public.vendedores where user_id = au.id order by criado_em desc limit 1
    ) v on true
    left join lateral (
      select * from public.parceiros_entrega where user_id = au.id order by criado_em desc limit 1
    ) pe on true
    left join public.administradores a on a.user_id = au.id
    where c.id is not null or v.id is not null or pe.id is not null or a.user_id is not null
  ), filtrados_secundarios as (
    select * from base
    where (p_provincia is null or base_provincia = p_provincia)
      and (p_registo_recente is not true or base_criado_em >= now() - interval '30 days')
      and (v_pesquisa is null or lower(base_pesquisa) like '%' || lower(v_pesquisa) || '%')
  ), contagens_globais as (
    select
      count(*) as c_total,
      count(*) filter (where 'cliente' = any(base_papeis)) as c_clientes,
      count(*) filter (where 'vendedor' = any(base_papeis)) as c_vendedores,
      count(*) filter (where 'parceiro_entrega' = any(base_papeis)) as c_parceiros,
      count(*) filter (where 'admin' = any(base_papeis)) as c_admins
    from base
  ), filtrados as (
    select * from filtrados_secundarios
    where (p_papel is null or p_papel = any(base_papeis))
      and (
        p_estado is null
        or (p_papel is not null and base_estados_papeis ->> p_papel = p_estado)
        or (p_papel is null and exists (
          select 1 from jsonb_each_text(base_estados_papeis) estado_papel
          where estado_papel.value = p_estado
        ))
      )
  ), total_filtrado as (
    select count(*) as c_total_resultados from filtrados
  ), pagina as (
    select * from filtrados
    order by base_criado_em desc, base_user_id
    limit v_limite offset v_offset
  ), itens as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', base_user_id,
      'papeis', base_papeis,
      'nome_apresentacao', base_nome,
      'foto_url', base_foto_url,
      'estados_papeis', base_estados_papeis,
      'email', base_email,
      'telefone', base_telefone,
      'provincia', base_provincia,
      'municipio', base_municipio,
      'criado_em', base_criado_em,
      'tem_pendencia_documental', base_pendencia_documental,
      'pendencias_documentais_papeis', base_pendencias_documentais_papeis
    ) order by base_criado_em desc, base_user_id), '[]'::jsonb) as dados
    from pagina
  )
  select jsonb_build_object(
    'itens', i.dados,
    'paginacao', jsonb_build_object(
      'total_resultados', t.c_total_resultados,
      'limite', v_limite,
      'offset', v_offset
    ),
    'contagens', jsonb_build_object(
      'total_global', c.c_total,
      'clientes', c.c_clientes,
      'vendedores', c.c_vendedores,
      'parceiros_entrega', c.c_parceiros,
      'administradores', c.c_admins
    )
  )
  from itens i
  cross join contagens_globais c
  cross join total_filtrado t
  );
end;
$$;


ALTER FUNCTION "public"."listar_utilizadores_admin"("p_papel" "text", "p_estado" "text", "p_provincia" "text", "p_registo_recente" boolean, "p_pesquisa" "text", "p_limite" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_veiculos_compativeis_encomenda"("p_encomenda_id" "uuid") RETURNS TABLE("parceiro_id" "uuid", "veiculo_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select v.parceiro_id, v.id
  from public.veiculos_entrega v
  cross join lateral public.avaliar_compatibilidade_veiculo_encomenda(v.id, p_encomenda_id) a
  where a.estado = 'compativel'
  order by v.parceiro_id, v.id;
$$;


ALTER FUNCTION "public"."listar_veiculos_compativeis_encomenda"("p_encomenda_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_veiculos_entregador_admin"("p_parceiro_id" "uuid", "p_limite" integer DEFAULT 25, "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if not exists (select 1 from public.parceiros_entrega where id = p_parceiro_id) then raise exception 'Entregador não encontrado.'; end if;
  return (
    with base as (
      select v.id, v.tipo_veiculo, v.marca, v.modelo, v.cor, v.ano, v.matricula,
        v.tipo_carrocaria, v.capacidade_kg, v.capacidade_volume_m3, v.possui_caixa_carga,
        v.aceita_paletes, v.possui_refrigeracao, v.estado_verificacao, v.motivo_rejeicao,
        v.foto_veiculo_path is not null as foto_disponivel, v.criado_em, v.atualizado_em
      from public.veiculos_entrega v
      where v.parceiro_id = p_parceiro_id
    ), pagina as (
      select * from base order by criado_em desc, id limit v_limite offset v_offset
    ), itens as (
      select coalesce(jsonb_agg(jsonb_build_object(
        'veiculo_id', id, 'tipo_veiculo', tipo_veiculo, 'marca', marca, 'modelo', modelo,
        'cor', cor, 'ano', ano, 'matricula', matricula, 'tipo_carrocaria', tipo_carrocaria,
        'capacidade_kg', capacidade_kg, 'capacidade_volume_m3', capacidade_volume_m3,
        'possui_caixa_carga', possui_caixa_carga, 'aceita_paletes', aceita_paletes,
        'possui_refrigeracao', possui_refrigeracao, 'estado_verificacao', estado_verificacao,
        'motivo_rejeicao', motivo_rejeicao, 'foto_disponivel', foto_disponivel,
        'criado_em', criado_em, 'atualizado_em', atualizado_em
      ) order by criado_em desc, id), '[]'::jsonb) as dados
      from pagina
    ) select jsonb_build_object('itens', itens.dados, 'paginacao', jsonb_build_object(
      'total_resultados', (select count(*) from base), 'limite', v_limite, 'offset', v_offset
    )) from itens
  );
end;
$$;


ALTER FUNCTION "public"."listar_veiculos_entregador_admin"("p_parceiro_id" "uuid", "p_limite" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."listar_vendedores_admin"() RETURNS TABLE("id" "uuid", "nome_comercial" "text", "descricao" "text", "telefone_whatsapp" "text", "whatsapp" "text", "provincia" "text", "municipio" "text", "bairro" "text", "mercado_bairro" "text", "endereco_detalhado" "text", "tipo_vendedor" "text", "verificado" boolean, "foto_perfil" "text", "user_id" "uuid", "nome_responsavel" "text", "email" "text", "email_login" "text", "indicativo_telefone" "text", "telefone_nacional" "text", "status_aprovacao" "text", "motivo_rejeicao" "text", "conta_ativa" boolean, "pode_destacar" boolean, "plano" "text", "aprovado_em" timestamp with time zone, "aprovado_por" "uuid", "criado_em" timestamp without time zone, "atualizado_em" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ begin if not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if; return query select v.id,v.nome_comercial,v.descricao,v.telefone_whatsapp,v.whatsapp,v.provincia,v.municipio,v.bairro,v.mercado_bairro,v.endereco_detalhado,v.tipo_vendedor,v.verificado,v.foto_perfil,v.user_id,v.nome_responsavel,v.email,v.email_login,v.indicativo_telefone,v.telefone_nacional,v.status_aprovacao,v.motivo_rejeicao,v.conta_ativa,v.pode_destacar,v.plano,v.aprovado_em,v.aprovado_por,v.criado_em,v.atualizado_em from public.vendedores v order by v.criado_em desc; end $$;


ALTER FUNCTION "public"."listar_vendedores_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."marcar_notificacao_como_lida"("p_notificacao_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  update public.notificacoes
  set lida = true,
      lida_em = coalesce(lida_em, now())
  where id = p_notificacao_id
    and utilizador_id = auth.uid();
end;
$$;


ALTER FUNCTION "public"."marcar_notificacao_como_lida"("p_notificacao_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."marcar_todas_notificacoes_como_lidas"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  update public.notificacoes
  set lida = true,
      lida_em = coalesce(lida_em, now())
  where utilizador_id = auth.uid()
    and not lida;
end;
$$;


ALTER FUNCTION "public"."marcar_todas_notificacoes_como_lidas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."motivos_compatibilidade_veiculo_encomenda"("p_veiculo_id" "uuid", "p_encomenda_id" "uuid") RETURNS "text"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select a.motivos
  from public.avaliar_compatibilidade_veiculo_encomenda(p_veiculo_id, p_encomenda_id) a;
$$;


ALTER FUNCTION "public"."motivos_compatibilidade_veiculo_encomenda"("p_veiculo_id" "uuid", "p_encomenda_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."motivos_elegibilidade_entregador"("p_parceiro_id" "uuid") RETURNS "text"[]
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_parceiro public.parceiros_entrega%rowtype;
  v_motivos text[] := array[]::text[];
begin
  select * into v_parceiro from public.parceiros_entrega where id = p_parceiro_id;
  if not found then return array['parceiro_inexistente']; end if;

  if v_parceiro.estado <> 'aprovado' then
    v_motivos := array_append(v_motivos, 'parceiro_nao_aprovado');
  end if;
  if not v_parceiro.disponibilidade then
    v_motivos := array_append(v_motivos, 'indisponivel');
  end if;
  if not exists (
    select 1 from public.areas_cobertura_entrega a
    where a.parceiro_id = v_parceiro.id and a.ativo
  ) then
    v_motivos := array_append(v_motivos, 'sem_area_ativa');
  end if;

  select coalesce(array_agg(codigo order by codigo), array[]::text[]) into v_motivos
  from (
    select distinct unnest(v_motivos) as codigo
    union
    select distinct case
      when d.id is null or atual.id is null then 'documento_em_falta:' || r.tipo_documento
      when atual.estado = 'pendente' then 'documento_pendente:' || r.tipo_documento
      when atual.estado = 'rejeitado' then 'documento_rejeitado:' || r.tipo_documento
      when atual.estado = 'expirado' then 'documento_expirado:' || r.tipo_documento
      when r.validade_obrigatoria and atual.validade_snapshot is null then 'validade_em_falta:' || r.tipo_documento
      when atual.validade_snapshot is not null and atual.validade_snapshot < current_date then 'documento_expirado:' || r.tipo_documento
      else null
    end as codigo
    from public.requisitos_documentos_entrega r
    left join lateral (
      select d0.* from public.documentos_parceiro_entrega d0
      where d0.parceiro_id = v_parceiro.id
        and d0.veiculo_id is null
        and d0.tipo_documento = r.tipo_documento
      order by d0.atualizado_em desc, d0.id desc limit 1
    ) d on true
    left join public.versoes_documento_parceiro_entrega atual on atual.id = d.versao_atual_id
    where r.ativo and r.escopo = 'pessoal'
  ) motivos
  where codigo is not null;

  if not exists (select 1 from public.veiculos_entrega v where v.parceiro_id = v_parceiro.id) then
    v_motivos := array_append(v_motivos, 'sem_veiculo');
  elsif not exists (
    select 1 from public.veiculos_entrega v
    where v.parceiro_id = v_parceiro.id and v.estado_verificacao = 'aprovado'
  ) then
    v_motivos := array_append(v_motivos, case when exists (
      select 1 from public.veiculos_entrega v
      where v.parceiro_id = v_parceiro.id and v.estado_verificacao = 'rejeitado'
    ) then 'veiculo_rejeitado' else 'sem_veiculo_aprovado' end);
  elsif not exists (
    select 1 from public.veiculos_entrega v
    where v.parceiro_id = v_parceiro.id
      and public.veiculo_operacional_para_entregas(v.id)
  ) then
    v_motivos := array_append(v_motivos, 'sem_veiculo_operacional');
  end if;

  select coalesce(array_agg(distinct codigo order by codigo), array[]::text[]) into v_motivos
  from unnest(v_motivos) as codigo;
  return v_motivos;
end;
$$;


ALTER FUNCTION "public"."motivos_elegibilidade_entregador"("p_parceiro_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."motivos_operacionais_veiculo_entrega"("p_veiculo_id" "uuid") RETURNS "text"[]
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_veiculo public.veiculos_entrega%rowtype;
  v_motivos text[] := array[]::text[];
begin
  select * into v_veiculo from public.veiculos_entrega where id = p_veiculo_id;
  if not found then return array['veiculo_inexistente']; end if;

  if v_veiculo.estado_verificacao <> 'aprovado' then
    v_motivos := array_append(v_motivos, 'veiculo_' || v_veiculo.estado_verificacao);
  end if;

  select coalesce(array_agg(codigo order by codigo), array[]::text[]) into v_motivos
  from (
    select distinct unnest(v_motivos) as codigo
    union
    select distinct case
      when d.id is null or atual.id is null then 'documento_em_falta:' || r.tipo_documento
      when atual.estado = 'pendente' then 'documento_pendente:' || r.tipo_documento
      when atual.estado = 'rejeitado' then 'documento_rejeitado:' || r.tipo_documento
      when atual.estado = 'expirado' then 'documento_expirado:' || r.tipo_documento
      when r.validade_obrigatoria and atual.validade_snapshot is null then 'validade_em_falta:' || r.tipo_documento
      when atual.validade_snapshot is not null and atual.validade_snapshot < current_date then 'documento_expirado:' || r.tipo_documento
      else null
    end as codigo
    from public.requisitos_documentos_entrega r
    left join lateral (
      select d0.* from public.documentos_parceiro_entrega d0
      where d0.parceiro_id = v_veiculo.parceiro_id
        and d0.veiculo_id = v_veiculo.id
        and d0.tipo_documento = r.tipo_documento
      order by d0.atualizado_em desc, d0.id desc limit 1
    ) d on true
    left join public.versoes_documento_parceiro_entrega atual on atual.id = d.versao_atual_id
    where r.ativo and r.escopo = 'veiculo' and r.tipo_veiculo = v_veiculo.tipo_veiculo
  ) motivos
  where codigo is not null;
  return v_motivos;
end;
$$;


ALTER FUNCTION "public"."motivos_operacionais_veiculo_entrega"("p_veiculo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalizar_itens_checkout_idempotencia"("p_itens" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_item jsonb;
  v_produto_id uuid;
  v_quantidade numeric;
  v_produtos uuid[] := '{}'::uuid[];
  v_normalizados jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Indique pelo menos um produto para a encomenda.';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens) loop
    if coalesce(jsonb_typeof(v_item), '') <> 'object'
      or nullif(btrim(v_item ->> 'produto_id'), '') is null
      or coalesce(jsonb_typeof(v_item -> 'quantidade'), '') <> 'number' then
      raise exception 'Cada item deve indicar produto e quantidade válidos.';
    end if;

    begin
      v_produto_id := (v_item ->> 'produto_id')::uuid;
      v_quantidade := (v_item ->> 'quantidade')::numeric;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Cada item deve indicar produto e quantidade válidos.';
    end;

    if v_quantidade is null or v_quantidade <= 0 or v_quantidade <> trunc(v_quantidade, 3) then
      raise exception 'A quantidade deve ser superior a zero e ter no máximo três casas decimais.';
    end if;
    if v_produto_id = any(v_produtos) then
      raise exception 'Não repita o mesmo produto na encomenda.';
    end if;

    v_produtos := array_append(v_produtos, v_produto_id);
    v_normalizados := v_normalizados || jsonb_build_array(
      jsonb_build_object('produto_id', v_produto_id, 'quantidade', v_quantidade)
    );
  end loop;

  select coalesce(jsonb_agg(item order by (item ->> 'produto_id')::uuid), '[]'::jsonb)
    into v_normalizados
  from jsonb_array_elements(v_normalizados) item;

  return v_normalizados;
end;
$$;


ALTER FUNCTION "public"."normalizar_itens_checkout_idempotencia"("p_itens" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalizar_texto_territorial"("p_texto" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT
    SET "search_path" TO 'public'
    AS $$
  select nullif(lower(regexp_replace(btrim(p_texto), '\s+', ' ', 'g')), '');
$$;


ALTER FUNCTION "public"."normalizar_texto_territorial"("p_texto" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notificar_ciclo_entrega_fase_1"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare e public.encomendas%rowtype; destino uuid; atribuicao uuid; url_compra text; url_venda text;
begin
 begin
  select * into e from public.encomendas where id=new.encomenda_id; if not found then return new; end if;
  select case when exists(select 1 from public.vendedores v where v.user_id=e.cliente_id) then '/dashboard/compras/'||e.id else '/dashboard/encomendas/'||e.id end into url_compra; url_venda:='/dashboard/encomendas/'||e.id; atribuicao:=nullif(new.metadados->>'atribuicao_id','')::uuid;
  if new.tipo_evento='entregador_chegou_origem' then select user_id into destino from public.vendedores where id=e.vendedor_id; if destino is not null then perform public.criar_notificacao(destino,'venda','entregador_chegou_origem','Entregador chegou para recolha','O entregador chegou para recolher esta encomenda.','encomenda',e.id,url_venda,'{}'::jsonb,'encomenda:'||new.id||':vendedor'); end if;
  elsif new.tipo_evento='encomenda_recolhida' then if e.cliente_id is not null then perform public.criar_notificacao(e.cliente_id,'compra','encomenda_recolhida','Encomenda em transporte','A tua encomenda foi recolhida e está a caminho do destino.','encomenda',e.id,url_compra,'{}'::jsonb,'encomenda:'||new.id||':cliente'); end if; select user_id into destino from public.vendedores where id=e.vendedor_id; if destino is not null then perform public.criar_notificacao(destino,'venda','encomenda_recolhida','Encomenda em transporte','A encomenda foi entregue ao transportador.','encomenda',e.id,url_venda,'{}'::jsonb,'encomenda:'||new.id||':vendedor'); end if; select p.user_id into destino from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id where a.id=atribuicao; if destino is not null then perform public.criar_notificacao(destino,'entrega','encomenda_recolhida','Recolha confirmada','O vendedor confirmou a entrega da encomenda.','atribuicao_entrega',atribuicao,'/dashboard/tarefas/'||atribuicao,'{}'::jsonb,'encomenda:'||new.id||':entregador'); end if;
  elsif new.tipo_evento='entregador_chegou_destino' then if e.cliente_id is not null then perform public.criar_notificacao(e.cliente_id,'compra','entregador_chegou_destino','Entregador chegou ao destino','O entregador chegou ao destino com a tua encomenda.','encomenda',e.id,url_compra,'{}'::jsonb,'encomenda:'||new.id||':cliente'); end if; select user_id into destino from public.vendedores where id=e.vendedor_id; if destino is not null then perform public.criar_notificacao(destino,'venda','entregador_chegou_destino','Entregador chegou ao destino','O entregador chegou ao destino da encomenda.','encomenda',e.id,url_venda,'{}'::jsonb,'encomenda:'||new.id||':vendedor'); end if;
  elsif new.tipo_evento='entrega_confirmada' then if e.cliente_id is not null then perform public.criar_notificacao(e.cliente_id,'compra','entrega_confirmada','Encomenda entregue','A tua encomenda foi entregue com sucesso.','encomenda',e.id,url_compra,'{}'::jsonb,'encomenda:'||new.id||':cliente'); end if; select user_id into destino from public.vendedores where id=e.vendedor_id; if destino is not null then perform public.criar_notificacao(destino,'venda','entrega_confirmada','Encomenda entregue','A encomenda foi entregue ao comprador.','encomenda',e.id,url_venda,'{}'::jsonb,'encomenda:'||new.id||':vendedor'); end if; select p.user_id into destino from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id where a.id=atribuicao; if destino is not null then perform public.criar_notificacao(destino,'entrega','entrega_confirmada','Entrega concluída','A entrega foi concluída com sucesso.','atribuicao_entrega',atribuicao,'/dashboard/tarefas/'||atribuicao,'{}'::jsonb,'encomenda:'||new.id||':entregador'); end if;
  end if;
 exception when others then raise warning 'Não foi possível criar a notificação do evento %: %',new.id,sqlerrm; end;
 return new;
end;
$$;


ALTER FUNCTION "public"."notificar_ciclo_entrega_fase_1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notificar_evento_encomenda"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_encomenda public.encomendas%rowtype;
  v_destinatario_id uuid;
  v_atribuicao_id uuid;
  v_url_comprador text;
  v_url_vendedor text;
begin
  begin
    select * into v_encomenda
    from public.encomendas
    where id = new.encomenda_id;

    if not found then
      raise warning 'Notificação ignorada: encomenda do evento % não encontrada.', new.id;
      return new;
    end if;

    select case when exists (
      select 1 from public.vendedores v where v.user_id = v_encomenda.cliente_id
    ) then '/dashboard/compras/' || v_encomenda.id
    else '/dashboard/encomendas/' || v_encomenda.id end
    into v_url_comprador;
    v_url_vendedor := '/dashboard/encomendas/' || v_encomenda.id;

    if new.tipo_evento = 'encomenda_criada' then
      select v.user_id into v_destinatario_id from public.vendedores v where v.id = v_encomenda.vendedor_id;
      if v_destinatario_id is not null then
        perform public.criar_notificacao(v_destinatario_id, 'venda', 'nova_encomenda', 'Nova encomenda recebida', 'Recebeste uma nova encomenda.', 'encomenda', v_encomenda.id, v_url_vendedor, '{}'::jsonb, 'encomenda:' || new.id || ':vendedor');
      end if;
    elsif new.tipo_evento = 'entregador_atribuido' then
      begin
        v_atribuicao_id := nullif(new.metadados ->> 'atribuicao_id', '')::uuid;
      exception when invalid_text_representation then
        raise warning 'Notificação de entrega ignorada: atribuição inválida no evento %.', new.id;
        return new;
      end;
      if v_atribuicao_id is null then
        raise warning 'Notificação de entrega ignorada: atribuição ausente no evento %.', new.id;
        return new;
      end if;
      select p.user_id into v_destinatario_id
      from public.atribuicoes_entrega_encomenda a
      join public.parceiros_entrega p on p.id = a.parceiro_entrega_id
      where a.id = v_atribuicao_id;
      if v_destinatario_id is not null then
        perform public.criar_notificacao(v_destinatario_id, 'entrega', 'nova_tarefa', 'Nova entrega atribuída', 'Tens uma nova tarefa de entrega para analisar.', 'atribuicao_entrega', v_atribuicao_id, '/dashboard/tarefas/' || v_atribuicao_id, '{}'::jsonb, 'encomenda:' || new.id || ':entregador');
      end if;
      if v_encomenda.cliente_id is not null then
        perform public.criar_notificacao(v_encomenda.cliente_id, 'compra', 'entregador_atribuido', 'Entregador atribuído', 'Foi atribuído um entregador à tua encomenda. Aguardamos a confirmação da tarefa.', 'encomenda', v_encomenda.id, v_url_comprador, '{}'::jsonb, 'encomenda:' || new.id || ':cliente');
      end if;
      select v.user_id into v_destinatario_id from public.vendedores v where v.id = v_encomenda.vendedor_id;
      if v_destinatario_id is not null then
        perform public.criar_notificacao(v_destinatario_id, 'venda', 'entregador_atribuido', 'Entregador atribuído', 'Foi atribuído um entregador à tua encomenda.', 'encomenda', v_encomenda.id, v_url_vendedor, '{}'::jsonb, 'encomenda:' || new.id || ':vendedor');
      end if;
    elsif new.tipo_evento in ('vendedor_confirmou', 'vendedor_recusou', 'pronta_para_levantamento', 'entregador_aceitou', 'entregador_recusou') then
      if new.tipo_evento in ('entregador_aceitou', 'entregador_recusou') and v_encomenda.modalidade_recebimento <> 'entrega' then
        raise warning 'Notificação logística ignorada: evento % não pertence a uma entrega.', new.id;
        return new;
      end if;
      if v_encomenda.cliente_id is not null then
        if new.tipo_evento = 'vendedor_confirmou' then
          perform public.criar_notificacao(v_encomenda.cliente_id, 'compra', new.tipo_evento, 'Encomenda confirmada', 'O vendedor confirmou a tua encomenda.', 'encomenda', v_encomenda.id, v_url_comprador, '{}'::jsonb, 'encomenda:' || new.id || ':cliente');
        elsif new.tipo_evento = 'vendedor_recusou' then
          perform public.criar_notificacao(v_encomenda.cliente_id, 'compra', new.tipo_evento, 'Encomenda recusada', 'O vendedor não conseguiu aceitar a tua encomenda.', 'encomenda', v_encomenda.id, v_url_comprador, '{}'::jsonb, 'encomenda:' || new.id || ':cliente');
        elsif new.tipo_evento = 'pronta_para_levantamento' then
          perform public.criar_notificacao(v_encomenda.cliente_id, 'compra', new.tipo_evento, 'Encomenda pronta', case when v_encomenda.modalidade_recebimento = 'entrega' then 'A tua encomenda está pronta para recolha pelo entregador.' else 'A tua encomenda está pronta para levantamento.' end, 'encomenda', v_encomenda.id, v_url_comprador, '{}'::jsonb, 'encomenda:' || new.id || ':cliente');
        elsif new.tipo_evento = 'entregador_aceitou' then
          perform public.criar_notificacao(v_encomenda.cliente_id, 'compra', new.tipo_evento, 'Entregador confirmado', 'O entregador aceitou a tua tarefa de entrega.', 'encomenda', v_encomenda.id, v_url_comprador, '{}'::jsonb, 'encomenda:' || new.id || ':cliente');
        else
          perform public.criar_notificacao(v_encomenda.cliente_id, 'compra', new.tipo_evento, 'A procurar outro entregador', 'Estamos a procurar outro entregador para a tua encomenda.', 'encomenda', v_encomenda.id, v_url_comprador, '{}'::jsonb, 'encomenda:' || new.id || ':cliente');
        end if;
      end if;
      if new.tipo_evento in ('entregador_aceitou', 'entregador_recusou') then
        select v.user_id into v_destinatario_id from public.vendedores v where v.id = v_encomenda.vendedor_id;
        if v_destinatario_id is not null then
          if new.tipo_evento = 'entregador_aceitou' then
            perform public.criar_notificacao(v_destinatario_id, 'venda', new.tipo_evento, 'Entregador aceitou a tarefa', 'O entregador aceitou a tarefa da tua encomenda.', 'encomenda', v_encomenda.id, v_url_vendedor, '{}'::jsonb, 'encomenda:' || new.id || ':vendedor');
          else
            perform public.criar_notificacao(v_destinatario_id, 'venda', new.tipo_evento, 'Entregador recusou a tarefa', 'O entregador recusou a tarefa. A encomenda aguarda nova atribuição.', 'encomenda', v_encomenda.id, v_url_vendedor, '{}'::jsonb, 'encomenda:' || new.id || ':vendedor');
          end if;
        end if;
      end if;
    end if;
  exception when others then
    raise warning 'Não foi possível criar a notificação do evento %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;


ALTER FUNCTION "public"."notificar_evento_encomenda"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notificar_intervencao_admin_entrega"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare e public.encomendas%rowtype; a public.atribuicoes_entrega_encomenda%rowtype; destino uuid; atribuicao uuid:=nullif(new.metadados->>'atribuicao_id','')::uuid; url_compra text;
begin
    select * into e from public.encomendas where id=new.encomenda_id; if not found then raise exception 'Encomenda da intervenção não encontrada.'; end if;
    select case when exists(select 1 from public.vendedores v where v.user_id=e.cliente_id) then '/dashboard/compras/'||e.id else '/dashboard/encomendas/'||e.id end into url_compra;
    select * into a from public.atribuicoes_entrega_encomenda where id=atribuicao;
    if new.tipo_evento='atribuicao_liberada_admin' then
      select p.user_id into destino from public.parceiros_entrega p where p.id=a.parceiro_entrega_id; if destino is not null then perform public.criar_notificacao(destino,'entrega','atribuicao_liberada_admin','Tarefa retirada','A tarefa foi retirada pela operação ANGROLINK.','atribuicao_entrega',a.id,'/dashboard/tarefas/'||a.id,'{}'::jsonb,'intervencao:'||new.id||':entregador'); end if;
      if e.cliente_id is not null then perform public.criar_notificacao(e.cliente_id,'compra','entrega_reorganizada','Entrega em reorganização','Estamos a reorganizar a entrega da tua encomenda.','encomenda',e.id,url_compra,'{}'::jsonb,'intervencao:'||new.id||':cliente'); end if;
      select user_id into destino from public.vendedores where id=e.vendedor_id; if destino is not null then perform public.criar_notificacao(destino,'venda','entrega_reorganizada','Entrega em reorganização','Estamos a reorganizar a entrega desta encomenda.','encomenda',e.id,'/dashboard/encomendas/'||e.id,'{}'::jsonb,'intervencao:'||new.id||':vendedor'); end if;
    elsif new.tipo_evento='incidente_operacional_aberto' then
      if e.cliente_id is not null then perform public.criar_notificacao(e.cliente_id,'compra','incidente_entrega','Entrega acompanhada','A entrega está a ser acompanhada pela equipa ANGROLINK.','encomenda',e.id,url_compra,'{}'::jsonb,'intervencao:'||new.id||':cliente'); end if;
      select user_id into destino from public.vendedores where id=e.vendedor_id; if destino is not null then perform public.criar_notificacao(destino,'venda','incidente_entrega','Entrega acompanhada','A entrega está a ser acompanhada pela equipa ANGROLINK.','encomenda',e.id,'/dashboard/encomendas/'||e.id,'{}'::jsonb,'intervencao:'||new.id||':vendedor'); end if;
      select p.user_id into destino from public.parceiros_entrega p where p.id=a.parceiro_entrega_id; if destino is not null then perform public.criar_notificacao(destino,'entrega','incidente_entrega','Ocorrência sinalizada','A operação ANGROLINK registou uma ocorrência nesta tarefa.','atribuicao_entrega',a.id,'/dashboard/tarefas/'||a.id,'{}'::jsonb,'intervencao:'||new.id||':entregador'); end if;
    end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."notificar_intervencao_admin_entrega"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notificar_recolha_entrega_fase_2"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."notificar_recolha_entrega_fase_2"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_atribuicao_entrega_encomenda_admin"("p_encomenda_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_resultado jsonb;
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  if not exists (
    select 1
    from public.encomendas
    where id = p_encomenda_id
  ) then
    raise exception 'Encomenda não encontrada.';
  end if;

  select jsonb_build_object(
    'id', a.id,
    'estado', a.estado,
    'atribuido_em', a.atribuido_em,
    'aceite_em', a.aceite_em,
    'chegou_origem_em', a.chegou_origem_em,
    'recolhida_em', a.recolhida_em,
    'recusado_em', a.recusado_em,
    'cancelado_em', a.cancelado_em,
    'concluido_em', a.concluido_em,
    'motivo_recusa', a.motivo_recusa,
    'motivo_cancelamento', a.motivo_cancelamento,
    'parceiro_id', p.id,
    'parceiro_nome', p.nome_completo,
    'veiculo_id', v.id,
    'veiculo_tipo', v.tipo_veiculo,
    'matricula', v.matricula,
    'atribuido_por', a.atribuido_por,
    'admin_nome', pr.nome
  )
  into v_resultado
  from public.atribuicoes_entrega_encomenda a
  join public.parceiros_entrega p on p.id = a.parceiro_entrega_id
  join public.veiculos_entrega v on v.id = a.veiculo_id
  left join public.profiles pr on pr.id = a.atribuido_por
  where a.encomenda_id = p_encomenda_id
  order by a.atribuido_em desc, a.id desc
  limit 1;

  return coalesce(v_resultado, jsonb_build_object('estado', 'nao_atribuido'));
end;
$$;


ALTER FUNCTION "public"."obter_atribuicao_entrega_encomenda_admin"("p_encomenda_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_codigo_entrega_cliente"("p_encomenda_id" "uuid") RETURNS TABLE("codigo" "text", "expira_em" timestamp with time zone, "geracoes" smallint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_encomenda public.encomendas%rowtype; v_codigo public.codigos_entrega%rowtype; v_otp text; v_agora timestamptz:=now(); v_evento text;
begin
  if auth.uid() is null then raise exception 'Sessão inválida. Inicie sessão novamente.'; end if;
  select * into v_encomenda from public.encomendas where id=p_encomenda_id and cliente_id=auth.uid() for update;
  if not found then raise exception 'Encomenda não encontrada ou sem permissão.'; end if;
  if v_encomenda.modalidade_recebimento <> 'entrega' or v_encomenda.estado <> 'chegou_destino' then raise exception 'O código de entrega só está disponível quando o entregador chegar ao destino.'; end if;
  select * into v_codigo from public.codigos_entrega where encomenda_id=v_encomenda.id for update;
  if found then
    if v_codigo.usado_em is not null then raise exception 'O código desta entrega já foi utilizado.'; end if;
    if v_codigo.gerado_em > v_agora - interval '60 seconds' then raise exception 'Aguarde um minuto antes de renovar o código de entrega.'; end if;
    if v_codigo.geracoes >= 3 then raise exception 'Foi atingido o limite de renovações do código de entrega. Contacte o suporte.'; end if;
    v_evento := 'codigo_entrega_regenerado'; v_otp:=public.gerar_otp_entrega_aleatorio();
    update public.codigos_entrega set codigo_hash=extensions.crypt(v_otp,extensions.gen_salt('bf',10)),expira_em=v_agora+interval '15 minutes',tentativas=0,bloqueado_em=null,geracoes=v_codigo.geracoes+1,atualizado_por=auth.uid(),gerado_em=v_agora where id=v_codigo.id returning codigos_entrega.expira_em,codigos_entrega.geracoes into expira_em,geracoes;
  else
    v_evento := 'codigo_entrega_gerado'; v_otp:=public.gerar_otp_entrega_aleatorio();
    insert into public.codigos_entrega(encomenda_id,codigo_hash,expira_em,criado_por,atualizado_por) values(v_encomenda.id,extensions.crypt(v_otp,extensions.gen_salt('bf',10)),v_agora+interval '15 minutes',auth.uid(),auth.uid()) returning codigos_entrega.expira_em,codigos_entrega.geracoes into expira_em,geracoes;
  end if;
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(v_encomenda.id,v_evento,'chegou_destino','chegou_destino','cliente',auth.uid(),jsonb_build_object('validade_segundos',900,'geracoes',geracoes));
  codigo:=v_otp; return next;
end;
$$;


ALTER FUNCTION "public"."obter_codigo_entrega_cliente"("p_encomenda_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_codigo_levantamento_cliente"("p_encomenda_id" "uuid") RETURNS TABLE("codigo" "text", "expira_em" timestamp with time zone, "geracoes" smallint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_encomenda public.encomendas%rowtype;
  v_codigo public.codigos_levantamento%rowtype;
  v_otp text;
  v_agora timestamptz := now();
  v_evento text;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão novamente.';
  end if;

  select * into v_encomenda
  from public.encomendas
  where id = p_encomenda_id
    and cliente_id = auth.uid()
  for update;

  if not found then
    raise exception 'Encomenda não encontrada ou sem permissão.';
  end if;

  if v_encomenda.estado <> 'pronta_para_levantamento' then
    raise exception 'O código de levantamento só está disponível quando a encomenda estiver pronta.';
  end if;

  select * into v_codigo
  from public.codigos_levantamento
  where encomenda_id = v_encomenda.id
  for update;

  if found then
    if v_codigo.usado_em is not null then
      raise exception 'O código desta encomenda já foi utilizado.';
    end if;

    if v_codigo.gerado_em > v_agora - interval '60 seconds' then
      raise exception 'Aguarde um minuto antes de renovar o código de levantamento.';
    end if;

    if v_codigo.geracoes >= 3 then
      raise exception 'Foi atingido o limite de renovações do código de levantamento. Contacte o suporte.';
    end if;

    v_evento := 'codigo_levantamento_regenerado';
    v_otp := public.gerar_otp_levantamento_aleatorio();

    update public.codigos_levantamento
    set
      codigo_hash = extensions.crypt(v_otp, extensions.gen_salt('bf', 10)),
      expira_em = v_agora + interval '15 minutes',
      tentativas = 0,
      bloqueado_em = null,
      geracoes = v_codigo.geracoes + 1,
      atualizado_por = auth.uid(),
      gerado_em = v_agora
    where id = v_codigo.id
    returning codigos_levantamento.expira_em, codigos_levantamento.geracoes
      into expira_em, geracoes;
  else
    v_evento := 'codigo_levantamento_gerado';
    v_otp := public.gerar_otp_levantamento_aleatorio();

    insert into public.codigos_levantamento (
      encomenda_id, codigo_hash, expira_em, criado_por, atualizado_por
    ) values (
      v_encomenda.id,
      extensions.crypt(v_otp, extensions.gen_salt('bf', 10)),
      v_agora + interval '15 minutes',
      auth.uid(), auth.uid()
    ) returning codigos_levantamento.expira_em, codigos_levantamento.geracoes
      into expira_em, geracoes;
  end if;

  insert into public.eventos_encomenda (
    encomenda_id, tipo_evento, estado_anterior, estado_novo,
    ator_tipo, utilizador_id, metadados
  ) values (
    v_encomenda.id, v_evento, 'pronta_para_levantamento', 'pronta_para_levantamento',
    'cliente', auth.uid(), jsonb_build_object('validade_segundos', 900, 'geracoes', geracoes)
  );

  codigo := v_otp;
  return next;
end;
$$;


ALTER FUNCTION "public"."obter_codigo_levantamento_cliente"("p_encomenda_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_comprador_admin"("p_cliente_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_resultado jsonb;
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  select jsonb_build_object(
    'comprador', jsonb_build_object(
      'cliente_id', c.id,
      'user_id', c.id,
      'nome', coalesce(nullif(btrim(c.nome), ''), nullif(btrim(pr.nome), ''), 'Comprador sem nome'),
      'foto_url', c.foto_perfil,
      'email', c.email,
      'telefone', c.telefone,
      'tipo_comprador', c.tipo_comprador,
      'provincia', c.provincia,
      'municipio', c.municipio,
      'conta_ativa', coalesce(c.conta_ativa, false),
      'criado_em', coalesce(c.criado_em, au.created_at),
      'ultima_atividade_em', atividade.ultima_atividade_em
    ),
    'outros_papeis', coalesce((
      select jsonb_agg(papel.item)
      from (
        select jsonb_build_object(
          'papel', 'vendedor', 'id', v.id,
          'estado', case when v.status_aprovacao = 'aprovado' and coalesce(v.conta_ativa, false) then 'ativo'
            when v.status_aprovacao = 'pendente' then 'pendente'
            when v.status_aprovacao = 'suspenso' then 'suspenso'
            when v.status_aprovacao = 'rejeitado' then 'rejeitado' else 'inativo' end
        ) as item where v.id is not null
        union all
        select jsonb_build_object(
          'papel', 'parceiro_entrega', 'id', pe.id,
          'estado', case when pe.estado = 'aprovado' then 'ativo'
            when pe.estado in ('rascunho', 'documentos_pendentes', 'em_analise') then 'pendente'
            when pe.estado in ('suspenso', 'documentacao_expirada') then 'suspenso'
            when pe.estado = 'rejeitado' then 'rejeitado' else 'inativo' end
        ) where pe.id is not null
        union all
        select jsonb_build_object('papel', 'admin', 'id', a.user_id, 'estado', 'ativo')
        where a.user_id is not null
      ) papel
    ), '[]'::jsonb),
    'resumo', jsonb_build_object(
      'total_encomendas', coalesce(en.total, 0),
      'encomendas_concluidas', coalesce(en.concluidas, 0),
      'encomendas_canceladas', coalesce(en.canceladas, 0),
      'recusas_vendedor', coalesce(en.recusadas, 0),
      'total_disputas', coalesce(di.total, 0),
      'disputas_abertas', coalesce(di.abertas, 0),
      'disputas_em_analise', coalesce(di.em_analise, 0),
      'disputas_resolvidas', coalesce(di.resolvidas, 0),
      'total_pagamentos', coalesce(pg.total, 0),
      'contactos_iniciados', coalesce(at.contactos, 0),
      'favoritos', coalesce(at.favoritos, 0)
    ),
    'encomendas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'encomenda_id', e.id, 'codigo_publico', e.codigo_publico,
        'vendedor_id', v2.id, 'vendedor_nome', v2.nome_comercial,
        'criado_em', e.criado_em, 'estado', e.estado,
        'total_centimos', e.total_centimos, 'modalidade', e.modalidade_recebimento,
        'estado_pagamento', p.estado, 'tem_disputa', exists (
          select 1 from public.disputas_encomenda d where d.encomenda_id = e.id
        )
      ) order by e.criado_em desc)
      from public.encomendas e
      join public.vendedores v2 on v2.id = e.vendedor_id
      left join public.pagamentos p on p.encomenda_id = e.id
      where e.cliente_id = c.id
    ), '[]'::jsonb),
    'cancelamentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'encomenda_id', e.id, 'codigo_publico', e.codigo_publico,
        'vendedor_id', v2.id, 'vendedor_nome', v2.nome_comercial,
        'motivo', e.motivo_cancelamento, 'cancelado_em', e.cancelado_em
      ) order by e.cancelado_em desc)
      from public.encomendas e
      join public.vendedores v2 on v2.id = e.vendedor_id
      where e.cliente_id = c.id and e.estado = 'cancelada'
    ), '[]'::jsonb),
    'recusas_vendedor', coalesce((
      select jsonb_agg(jsonb_build_object(
        'encomenda_id', e.id, 'codigo_publico', e.codigo_publico,
        'vendedor_id', v2.id, 'vendedor_nome', v2.nome_comercial,
        'motivo', e.motivo_recusa, 'recusado_em', e.recusado_em
      ) order by e.recusado_em desc)
      from public.encomendas e
      join public.vendedores v2 on v2.id = e.vendedor_id
      where e.cliente_id = c.id and e.estado = 'recusada'
    ), '[]'::jsonb),
    'pagamentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pagamento_id', p.id, 'encomenda_id', p.encomenda_id, 'codigo_publico', e.codigo_publico,
        'estado', p.estado, 'metodo', tentativa.metodo,
        'total_centimos', p.total_cliente_centimos, 'criado_em', p.criado_em,
        'total_reembolsado_centimos', coalesce(reembolso.total, 0),
        'tem_reembolso', coalesce(reembolso.total, 0) > 0
      ) order by p.criado_em desc)
      from public.pagamentos p
      join public.encomendas e on e.id = p.encomenda_id
      left join lateral (
        select t.metodo
        from public.tentativas_pagamento t
        where t.pagamento_id = p.id
          and (p.estado <> 'confirmado' or t.estado = 'confirmada')
        order by t.criado_em desc
        limit 1
      ) tentativa on true
      left join lateral (
        select sum(r.valor_aprovado_centimos)::bigint as total
        from public.reembolsos_pagamento r
        where r.pagamento_id = p.id and r.estado in ('aprovado', 'processado', 'concluido')
      ) reembolso on true
      where p.cliente_id = c.id
    ), '[]'::jsonb),
    'disputas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'disputa_id', d.id, 'encomenda_id', d.encomenda_id, 'codigo_publico', e.codigo_publico,
        'vendedor_id', v2.id, 'vendedor_nome', v2.nome_comercial,
        'tipo', d.tipo_problema, 'estado', d.estado, 'criado_em', d.criado_em
      ) order by d.criado_em desc)
      from public.disputas_encomenda d
      join public.encomendas e on e.id = d.encomenda_id
      join public.vendedores v2 on v2.id = d.vendedor_id
      where d.cliente_id = c.id
    ), '[]'::jsonb),
    'atividade', jsonb_build_object(
      'contactos_produtos', coalesce(at.contactos_produtos, 0),
      'contactos_servicos', coalesce(at.contactos_servicos, 0),
      'favoritos', coalesce(at.favoritos, 0),
      'ultima_atividade_em', atividade.ultima_atividade_em
    )
  ) into v_resultado
  from public.clientes c
  join auth.users au on au.id = c.id
  left join public.profiles pr on pr.id = c.id
  left join lateral (select * from public.vendedores where user_id = c.id order by criado_em desc limit 1) v on true
  left join lateral (select * from public.parceiros_entrega where user_id = c.id order by criado_em desc limit 1) pe on true
  left join public.administradores a on a.user_id = c.id
  left join lateral (
    select count(*) as total,
      count(*) filter (where estado = 'concluida') as concluidas,
      count(*) filter (where estado = 'cancelada') as canceladas,
      count(*) filter (where estado = 'recusada') as recusadas,
      max(atualizado_em) as ultima_encomenda_em
    from public.encomendas where cliente_id = c.id
  ) en on true
  left join lateral (
    select count(*) as total,
      count(*) filter (where estado = 'aberta') as abertas,
      count(*) filter (where estado = 'em_analise') as em_analise,
      count(*) filter (where estado like 'resolvida%') as resolvidas,
      max(atualizado_em) as ultima_disputa_em
    from public.disputas_encomenda where cliente_id = c.id
  ) di on true
  left join lateral (
    select count(*) as total, max(criado_em) as ultimo_pagamento_em
    from public.pagamentos where cliente_id = c.id
  ) pg on true
  left join lateral (
    select
      count(*) filter (where origem = 'produto') as contactos_produtos,
      count(*) filter (where origem = 'servico') as contactos_servicos,
      count(*) filter (where origem in ('produto', 'servico')) as contactos,
      count(*) filter (where origem = 'favorito') as favoritos
    from (
      select 'produto'::text as origem from public.historico_contactos h where h.cliente_id = c.id
      union all select 'servico'::text from public.historico_contactos_servicos hs where hs.cliente_id = c.id
      union all select 'favorito'::text from public.favoritos f where f.utilizador_id = c.id
    ) atividade_contagem
  ) at on true
  left join lateral (
    select max(x.ocorrido_em) as ultima_atividade_em
    from (
      select c.criado_em as ocorrido_em
      union all select en.ultima_encomenda_em
      union all select di.ultima_disputa_em
      union all select pg.ultimo_pagamento_em
      union all select max(h.criado_em) from public.historico_contactos h where h.cliente_id = c.id
      union all select max(hs.criado_em) from public.historico_contactos_servicos hs where hs.cliente_id = c.id
      union all select max(f.criado_em) from public.favoritos f where f.utilizador_id = c.id
    ) x
  ) atividade on true
  where c.id = p_cliente_id;

  if v_resultado is null then
    raise exception 'Comprador não encontrado.';
  end if;
  return v_resultado;
end;
$$;


ALTER FUNCTION "public"."obter_comprador_admin"("p_cliente_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_disputa_admin"("p_disputa_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_resultado jsonb;
begin
  if not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  select jsonb_build_object(
    'disputa', jsonb_build_object(
      'id', d.id, 'estado', d.estado, 'tipo', d.tipo_problema,
      'descricao', d.descricao, 'valor_reclamado_centimos', d.valor_reclamado_centimos,
      'criado_em', d.criado_em, 'atualizado_em', d.atualizado_em,
      'analisado_por', d.analisado_por, 'analisado_em', d.analisado_em,
      'resolvido_por', d.resolvido_por, 'resolvido_em', d.resolvido_em,
      'decisao', d.decisao, 'observacao_resolucao', d.observacao_resolucao
    ),
    'encomenda', public.obter_encomenda_admin(d.encomenda_id),
    'auditoria', coalesce((
      select jsonb_agg(jsonb_build_object(
        'acao', a.acao, 'estado_anterior', a.estado_anterior,
        'estado_novo', a.estado_novo, 'motivo', a.motivo, 'criado_em', a.criado_em
      ) order by a.criado_em)
      from public.auditoria_administrativa a
      where a.entidade_tipo = 'disputa' and a.entidade_id = d.id
    ), '[]'::jsonb)
  ) into v_resultado
  from public.disputas_encomenda d
  where d.id = p_disputa_id;

  if v_resultado is null then raise exception 'Disputa não encontrada.'; end if;
  return v_resultado;
end;
$$;


ALTER FUNCTION "public"."obter_disputa_admin"("p_disputa_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_documentos_legados_vendedor"("p_vendedor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_documentos jsonb;
begin
  if not public.eh_admin() then
    raise exception 'Sem permissão para consultar documentos legados.';
  end if;

  select coalesce(documentos, '{}'::jsonb)
    into v_documentos
  from public.vendedores
  where id = p_vendedor_id;

  return coalesce(v_documentos, '{}'::jsonb);
end;
$$;


ALTER FUNCTION "public"."obter_documentos_legados_vendedor"("p_vendedor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_elegibilidade_entregador_admin"("p_parceiro_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;
  if not exists (select 1 from public.parceiros_entrega where id = p_parceiro_id) then
    raise exception 'Entregador não encontrado.';
  end if;

  return jsonb_build_object(
    'pode_receber_entregas', public.entregador_pode_receber_entregas(p_parceiro_id),
    'motivos', to_jsonb(public.motivos_elegibilidade_entregador(p_parceiro_id)),
    'veiculos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'veiculo_id', v.id,
        'veiculo_operacional', public.veiculo_operacional_para_entregas(v.id),
        'motivos', to_jsonb(public.motivos_operacionais_veiculo_entrega(v.id))
      ) order by v.criado_em, v.id)
      from public.veiculos_entrega v
      where v.parceiro_id = p_parceiro_id
    ), '[]'::jsonb)
  );
end;
$$;


ALTER FUNCTION "public"."obter_elegibilidade_entregador_admin"("p_parceiro_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_encomenda_admin"("p_encomenda_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_resultado jsonb;
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  select jsonb_build_object(
    'encomenda', jsonb_build_object(
      'id', e.id, 'codigo_publico', e.codigo_publico, 'estado', e.estado,
      'modalidade', e.modalidade_recebimento, 'moeda', e.moeda,
      'criado_em', e.criado_em, 'atualizado_em', e.atualizado_em,
      'confirmado_em', e.confirmado_em, 'concluido_em', e.concluido_em,
      'recusado_em', e.recusado_em, 'cancelado_em', e.cancelado_em,
      'observacoes_cliente', e.observacoes_cliente,
      'motivo_cancelamento', e.motivo_cancelamento,
      'motivo_recusa', e.motivo_recusa
    ),
    'cliente', jsonb_build_object(
      'id', c.id, 'nome', c.nome, 'email', c.email, 'telefone', c.telefone,
      'tipo_comprador', c.tipo_comprador, 'provincia', c.provincia,
      'municipio', c.municipio, 'conta_ativa', c.conta_ativa
    ),
    'vendedor', jsonb_build_object(
      'id', v.id, 'nome_comercial', v.nome_comercial,
      'nome_responsavel', v.nome_responsavel,
      'telefone', coalesce(v.telefone_whatsapp, v.whatsapp),
      'email', v.email, 'provincia', v.provincia, 'municipio', v.municipio,
      'bairro', coalesce(v.bairro, v.mercado_bairro),
      'endereco_detalhado', v.endereco_detalhado,
      'estado', v.status_aprovacao, 'conta_ativa', v.conta_ativa
    ),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'nome', i.nome_produto_snapshot,
        'descricao', i.descricao_snapshot, 'imagem_url', i.imagem_principal_snapshot,
        'quantidade', i.quantidade, 'unidade', i.unidade,
        'valor_unitario_centimos', i.valor_unitario_centimos,
        'subtotal_centimos', i.subtotal_centimos, 'tipo_preco', i.tipo_preco_snapshot,
        'peso_por_unidade_comercial_kg', i.peso_por_unidade_comercial_kg_snapshot,
        'volume_por_unidade_comercial_m3', i.volume_por_unidade_comercial_m3_snapshot,
        'requer_refrigeracao', i.requer_refrigeracao_snapshot,
        'requer_caixa_carga', i.requer_caixa_carga_snapshot,
        'requer_paletes', i.requer_paletes_snapshot
      ) order by i.criado_em, i.id)
      from public.itens_encomenda i where i.encomenda_id = e.id
    ), '[]'::jsonb),
    'financeiro', coalesce((
      select jsonb_build_object(
        'pagamento_id', p.id, 'estado', p.estado, 'moeda', p.moeda,
        'subtotal_centimos', p.subtotal_centimos, 'desconto_centimos', p.desconto_centimos,
        'entrega_centimos', p.entrega_centimos, 'total_centimos', p.total_cliente_centimos,
        'taxa_processador_centimos', p.taxa_processador_centimos,
        'comissao_snapshot_centimos', p.comissao_angrolink_centimos,
        'comissao_efetiva_centimos', f.comissao_efetiva_centimos,
        'valor_vendedor_snapshot_centimos', p.valor_vendedor_centimos,
        'valor_vendedor_efetivo_centimos', f.valor_vendedor_efetivo_centimos,
        'reembolsos', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', rr.id, 'estado', rr.estado, 'valor_centimos', rr.valor_aprovado_centimos,
            'criado_em', rr.criado_em
          ) order by rr.criado_em)
          from public.reembolsos_pagamento rr where rr.pagamento_id = p.id
        ), '[]'::jsonb), 'repasse_estado', rp.estado
      )
      from public.pagamentos p
      join lateral public.calcular_valores_financeiros_efetivos(p.id) f on true
      left join public.repasses_vendedor rp on rp.pagamento_id = p.id
      where p.encomenda_id = e.id
    ), '{}'::jsonb),
    'pagamento', coalesce((
      select jsonb_build_object(
        'id', p.id, 'estado', p.estado, 'referencia_interna', p.referencia_interna,
        'criado_em', p.criado_em, 'confirmado_em', p.confirmado_em,
        'tentativas', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', t.id, 'metodo', t.metodo, 'estado', t.estado,
            'referencia_interna', t.referencia_interna, 'criado_em', t.criado_em,
            'atualizado_em', t.atualizado_em, 'mensagem_erro', t.mensagem_erro
          ) order by t.criado_em)
          from public.tentativas_pagamento t where t.pagamento_id = p.id
        ), '[]'::jsonb),
        'eventos', coalesce((
          select jsonb_agg(jsonb_build_object(
            'tipo', ep.tipo_evento, 'estado_anterior', ep.estado_anterior,
            'estado_novo', ep.estado_novo, 'ator', ep.ator_tipo,
            'ator_nome', pr.nome, 'criado_em', ep.criado_em
          ) order by ep.criado_em)
          from public.eventos_pagamento ep
          left join public.profiles pr on pr.id = ep.utilizador_id
          where ep.pagamento_id = p.id
        ), '[]'::jsonb)
      ) from public.pagamentos p where p.encomenda_id = e.id
    ), '{}'::jsonb),
    'origem', jsonb_build_object(
      'provincia', e.provincia, 'municipio', e.municipio, 'bairro', e.bairro,
      'endereco', e.endereco_levantamento, 'referencia', e.ponto_referencia
    ),
    'destino', coalesce((
      select jsonb_build_object(
        'destinatario_nome', d.destinatario_nome,
        'destinatario_telefone', d.destinatario_telefone,
        'provincia', d.provincia, 'municipio', d.municipio, 'bairro', d.bairro,
        'endereco', d.endereco_detalhado, 'referencia', d.ponto_referencia,
        'instrucoes', d.instrucoes_entrega
      ) from public.enderecos_entrega_encomenda d where d.encomenda_id = e.id
    ), '{}'::jsonb),
    'requisitos_logisticos', case when e.modalidade_recebimento = 'entrega' then coalesce((
      select jsonb_build_object(
        'peso_total_kg', r.peso_total_kg, 'peso_total_conhecido', r.peso_total_conhecido,
        'volume_total_m3', r.volume_total_m3, 'volume_total_conhecido', r.volume_total_conhecido,
        'requer_refrigeracao', r.requer_refrigeracao,
        'requer_caixa_carga', r.requer_caixa_carga,
        'requer_paletes', r.requer_paletes,
        'requisitos_especiais_conhecidos', r.requisitos_especiais_conhecidos
      ) from public.calcular_requisitos_logisticos_encomenda(e.id) r
    ), '{}'::jsonb) else '{}'::jsonb end,
    'atribuicao_entrega', jsonb_build_object('estado', 'nao_atribuido'),
    'levantamento', case when e.modalidade_recebimento = 'levantamento' then coalesce((
      select jsonb_build_object(
        'gerado_em', cl.gerado_em, 'expira_em', cl.expira_em, 'usado_em', cl.usado_em,
        'bloqueado_em', cl.bloqueado_em, 'tentativas', cl.tentativas,
        'max_tentativas', cl.max_tentativas
      ) from public.codigos_levantamento cl where cl.encomenda_id = e.id
    ), '{}'::jsonb) else '{}'::jsonb end,
    'eventos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tipo', x.tipo_evento, 'ator', x.ator_tipo,
        'ator_nome', pr.nome, 'estado_anterior', x.estado_anterior,
        'estado_novo', x.estado_novo, 'criado_em', x.criado_em,
        'metadados', case when x.metadados ? 'motivo'
          then jsonb_build_object('motivo', x.metadados -> 'motivo')
          else '{}'::jsonb end
      ) order by x.criado_em, x.id)
      from public.eventos_encomenda x
      left join public.profiles pr on pr.id = x.utilizador_id
      where x.encomenda_id = e.id
    ), '[]'::jsonb),
    'disputa', coalesce((
      select jsonb_build_object(
        'id', d.id, 'estado', d.estado, 'tipo', d.tipo_problema,
        'descricao', d.descricao, 'decisao', d.decisao,
        'analisado_por', d.analisado_por, 'analisado_em', d.analisado_em,
        'resolvido_em', d.resolvido_em
      ) from public.disputas_encomenda d
      where d.encomenda_id = e.id order by d.criado_em desc limit 1
    ), '{}'::jsonb)
  ) into v_resultado
  from public.encomendas e
  join public.clientes c on c.id = e.cliente_id
  join public.vendedores v on v.id = e.vendedor_id
  where e.id = p_encomenda_id;

  if v_resultado is null then raise exception 'Encomenda não encontrada.'; end if;
  return v_resultado;
end;
$$;


ALTER FUNCTION "public"."obter_encomenda_admin"("p_encomenda_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_entrega_encomenda_participante"("p_encomenda_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare e public.encomendas%rowtype; a public.atribuicoes_entrega_encomenda%rowtype; vendedor boolean:=false;
begin
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 select * into e from public.encomendas where id=p_encomenda_id; if not found then raise exception 'Encomenda não encontrada.'; end if;
 select exists(select 1 from public.vendedores v where v.id=e.vendedor_id and v.user_id=auth.uid()) into vendedor;
 if e.cliente_id<>auth.uid() and not vendedor then raise exception 'Sem permissão para consultar a entrega.'; end if;
 if e.modalidade_recebimento<>'entrega' then return jsonb_build_object('estado','nao_aplicavel'); end if;
 select * into a from public.atribuicoes_entrega_encomenda where encomenda_id=e.id order by atribuido_em desc,id desc limit 1; if not found then return jsonb_build_object('estado','nao_atribuido'); end if;
 if a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then return (select jsonb_build_object('atribuicao_id',a2.id,'estado',a2.estado,'atribuido_em',a2.atribuido_em,'aceite_em',a2.aceite_em,'chegou_origem_em',a2.chegou_origem_em,'recolhida_em',a2.recolhida_em,'chegou_destino_em',a2.chegou_destino_em,'concluido_em',a2.concluido_em,'parceiro_entrega_id',p.id,'nome_entregador',p.nome_completo,'veiculo',jsonb_build_object('tipo_veiculo',v.tipo_veiculo,'marca',v.marca,'modelo',v.modelo,'matricula',v.matricula)) from public.atribuicoes_entrega_encomenda a2 join public.parceiros_entrega p on p.id=a2.parceiro_entrega_id join public.veiculos_entrega v on v.id=a2.veiculo_id where a2.id=a.id); end if;
 return jsonb_build_object('atribuicao_id',a.id,'estado',a.estado,'atribuido_em',a.atribuido_em,'recusado_em',a.recusado_em,'motivo_recusa',case when vendedor and a.estado='recusada' then a.motivo_recusa else null end);
end;
$$;


ALTER FUNCTION "public"."obter_entrega_encomenda_participante"("p_encomenda_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_entregador_admin"("p_parceiro_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_resultado jsonb;
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  select jsonb_build_object(
    'parceiro', jsonb_build_object(
      'parceiro_id', pe.id, 'user_id', pe.user_id, 'nome_completo', pe.nome_completo,
      'email', pe.email, 'telefone', pe.telefone,
      'foto_perfil_disponivel', pe.foto_perfil_url is not null,
      'criado_em', pe.criado_em, 'atualizado_em', pe.atualizado_em,
      'estado', pe.estado, 'disponibilidade', pe.disponibilidade,
      'aprovado_em', pe.aprovado_em, 'motivo_rejeicao', pe.motivo_rejeicao,
      'motivo_suspensao', pe.motivo_suspensao, 'provincia', pe.provincia,
      'municipio', pe.municipio, 'bairro', pe.bairro, 'zona_base', pe.zona_base
    ),
    'resumo_operacional', jsonb_build_object(
      'total_veiculos', (select count(*) from public.veiculos_entrega v where v.parceiro_id = pe.id),
      'veiculos_aprovados', (select count(*) from public.veiculos_entrega v where v.parceiro_id = pe.id and v.estado_verificacao = 'aprovado'),
      'total_documentos', (select count(*) from public.documentos_parceiro_entrega d where d.parceiro_id = pe.id),
      'documentos_pendentes', (select count(*) from public.documentos_parceiro_entrega d where d.parceiro_id = pe.id and d.estado = 'pendente'),
      'documentos_expirados', (select count(*) from public.documentos_parceiro_entrega d where d.parceiro_id = pe.id and d.estado = 'expirado'),
      'areas_ativas', (select count(*) from public.areas_cobertura_entrega a where a.parceiro_id = pe.id and a.ativo)
    ),
    'outros_papeis', jsonb_build_object(
      'cliente', exists(select 1 from public.clientes c where c.id = pe.user_id),
      'vendedor', exists(select 1 from public.vendedores v where v.user_id = pe.user_id),
      'admin', exists(select 1 from public.administradores a where a.user_id = pe.user_id)
    ),
    'elegibilidade_logistica', public.obter_elegibilidade_entregador_admin(pe.id),
    'historico_documental_disponivel', true,
    'historico_administrativo_disponivel', false,
    'entregas_disponiveis', false,
    'financeiro_disponivel', false,
    'incidentes_disponiveis', false
  ) into v_resultado
  from public.parceiros_entrega pe
  where pe.id = p_parceiro_id;

  if v_resultado is null then
    raise exception 'Entregador não encontrado.';
  end if;
  return v_resultado;
end;
$$;


ALTER FUNCTION "public"."obter_entregador_admin"("p_parceiro_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_incidente_operacional_entrega_admin"("p_encomenda_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_resultado jsonb;
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  select jsonb_build_object('id',i.id,'atribuicao_id',i.atribuicao_id,'tipo',i.tipo,'motivo',i.motivo,'estado',i.estado,'criado_em',i.criado_em,'resolvido_em',i.resolvido_em,'observacao_resolucao',i.observacao_resolucao)
  into v_resultado from public.incidentes_operacionais_entrega i where i.encomenda_id=p_encomenda_id order by i.criado_em desc,i.id desc limit 1;
  return coalesce(v_resultado,'{}'::jsonb);
end;
$$;


ALTER FUNCTION "public"."obter_incidente_operacional_entrega_admin"("p_encomenda_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_meu_vendedor"() RETURNS TABLE("id" "uuid", "nome_comercial" "text", "descricao" "text", "telefone_whatsapp" "text", "whatsapp" "text", "provincia" "text", "municipio" "text", "bairro" "text", "mercado_bairro" "text", "endereco_detalhado" "text", "tipo_vendedor" "text", "verificado" boolean, "foto_perfil" "text", "ano_inicio" integer, "data_inicio_atividade" "date", "horario_atendimento" "text", "entrega_disponivel" boolean, "tipo_producao" "text", "area_cultivada" numeric, "principais_culturas" "text", "producao_mensal" "text", "venda_grosso" boolean, "venda_retalho" boolean, "tipos_produtos" "text", "compra_produtores" boolean, "volume_minimo" "text", "entrega_outras_provincias" boolean, "tipo_loja" "text", "mercado_localizado" "text", "venda_presencial" boolean, "user_id" "uuid", "nome_responsavel" "text", "email" "text", "indicativo_telefone" "text", "telefone_nacional" "text", "status_aprovacao" "text", "motivo_rejeicao" "text", "conta_ativa" boolean, "pode_destacar" boolean, "plano" "text", "aprovado_em" timestamp with time zone, "criado_em" timestamp without time zone, "atualizado_em" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select v.id,v.nome_comercial,v.descricao,v.telefone_whatsapp,v.whatsapp,v.provincia,v.municipio,v.bairro,v.mercado_bairro,v.endereco_detalhado,v.tipo_vendedor,v.verificado,v.foto_perfil,v.ano_inicio,v.data_inicio_atividade,v.horario_atendimento,v.entrega_disponivel,v.tipo_producao,v.area_cultivada,v.principais_culturas,v.producao_mensal,v.venda_grosso,v.venda_retalho,v.tipos_produtos,v.compra_produtores,v.volume_minimo,v.entrega_outras_provincias,v.tipo_loja,v.mercado_localizado,v.venda_presencial,v.user_id,v.nome_responsavel,v.email,v.indicativo_telefone,v.telefone_nacional,v.status_aprovacao,v.motivo_rejeicao,v.conta_ativa,v.pode_destacar,v.plano,v.aprovado_em,v.criado_em,v.atualizado_em from public.vendedores v where v.user_id=auth.uid() $$;


ALTER FUNCTION "public"."obter_meu_vendedor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_pagamento_encomenda_cliente"("p_encomenda_id" "uuid") RETURNS TABLE("pagamento_id" "uuid", "encomenda_id" "uuid", "estado_pagamento" "text", "metodo_pagamento" "text", "total_cliente_centimos" bigint, "moeda" character, "referencia_interna" "text", "criado_em" timestamp with time zone, "confirmado_em" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão para consultar o pagamento.';
  end if;

  return query
  select
    p.id,
    p.encomenda_id,
    p.estado,
    tentativa.metodo,
    p.total_cliente_centimos,
    p.moeda,
    p.referencia_interna,
    p.criado_em,
    p.confirmado_em
  from public.pagamentos p
  join public.encomendas e
    on e.id = p.encomenda_id
  left join lateral (
    select t.metodo
    from public.tentativas_pagamento t
    where t.pagamento_id = p.id
      and (p.estado <> 'confirmado' or t.estado = 'confirmada')
    order by t.criado_em desc
    limit 1
  ) tentativa on true
  where p.encomenda_id = p_encomenda_id
    and e.cliente_id = auth.uid();
end;
$$;


ALTER FUNCTION "public"."obter_pagamento_encomenda_cliente"("p_encomenda_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_resumo_financeiro_encomenda_vendedor"("p_encomenda_id" "uuid") RETURNS TABLE("pagamento_id" "uuid", "encomenda_id" "uuid", "estado_pagamento" "text", "subtotal_centimos" bigint, "desconto_centimos" bigint, "base_comercial_centimos" bigint, "comissao_angrolink_centimos" bigint, "valor_vendedor_centimos" bigint, "entrega_centimos" bigint, "moeda" character, "estado_repasse" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão para consultar o resumo financeiro.';
  end if;

  return query
  select
    p.id,
    p.encomenda_id,
    p.estado,
    p.subtotal_centimos,
    p.desconto_centimos,
    valores.base_comissionavel_centimos,
    valores.comissao_efetiva_centimos,
    valores.valor_vendedor_efetivo_centimos,
    valores.valor_logistica_efetivo_centimos,
    p.moeda,
    repasse.estado
  from public.pagamentos p
  join public.vendedores v
    on v.id = p.vendedor_id
  join lateral public.calcular_valores_financeiros_efetivos(p.id) valores
    on true
  left join public.repasses_vendedor repasse
    on repasse.pagamento_id = p.id
  where p.encomenda_id = p_encomenda_id
    and v.user_id = auth.uid();
end;
$$;


ALTER FUNCTION "public"."obter_resumo_financeiro_encomenda_vendedor"("p_encomenda_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_tarefa_entregador"("p_atribuicao_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare resultado jsonb;
begin
 if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
 select jsonb_build_object(
  'tarefa',jsonb_build_object('id',a.id,'estado',a.estado,'atribuido_em',a.atribuido_em,'aceite_em',a.aceite_em,'chegou_origem_em',a.chegou_origem_em,'recolhida_em',a.recolhida_em,'chegou_destino_em',a.chegou_destino_em,'concluido_em',a.concluido_em,'recusado_em',a.recusado_em,'motivo_recusa',a.motivo_recusa),
  'encomenda',jsonb_build_object('id',e.id,'codigo_publico',e.codigo_publico,'estado',e.estado,'modalidade',e.modalidade_recebimento),
  'veiculo',jsonb_build_object('tipo',v.tipo_veiculo,'matricula',v.matricula),
  'origem',jsonb_build_object('nome_vendedor',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then ven.nome_comercial end,'telefone',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then coalesce(ven.telefone_whatsapp,ven.whatsapp) end,'provincia',e.provincia,'municipio',e.municipio,'bairro',e.bairro,'endereco',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then e.endereco_levantamento end,'referencia',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then e.ponto_referencia end),
  'destino',jsonb_build_object('nome',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then d.destinatario_nome end,'telefone',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then d.destinatario_telefone end,'provincia',d.provincia,'municipio',d.municipio,'bairro',d.bairro,'endereco',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then d.endereco_detalhado end,'referencia',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then d.ponto_referencia end,'instrucoes',case when a.estado in ('aceite','chegou_origem','recolhida','chegou_destino','concluida') then d.instrucoes_entrega end),
  'itens',coalesce((select jsonb_agg(jsonb_build_object('nome',i.nome_produto_snapshot,'quantidade',i.quantidade,'unidade',i.unidade) order by i.criado_em,i.id) from public.itens_encomenda i where i.encomenda_id=e.id),'[]'::jsonb),
  'requisitos_logisticos',coalesce((select jsonb_build_object('peso_total_kg',r.peso_total_kg,'peso_total_conhecido',r.peso_total_conhecido,'volume_total_m3',r.volume_total_m3,'volume_total_conhecido',r.volume_total_conhecido,'requer_refrigeracao',r.requer_refrigeracao,'requer_caixa_carga',r.requer_caixa_carga,'requer_paletes',r.requer_paletes) from public.calcular_requisitos_logisticos_encomenda(e.id) r),'{}'::jsonb),
  'pagamento',coalesce((select jsonb_build_object('metodo',t.metodo,'estado',p.estado) from public.pagamentos p join public.tentativas_pagamento t on t.pagamento_id=p.id where p.encomenda_id=e.id and t.metodo='pagamento_na_entrega' order by t.criado_em desc,t.id desc limit 1),'{}'::jsonb)
 ) into resultado from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega parceiro on parceiro.id=a.parceiro_entrega_id join public.encomendas e on e.id=a.encomenda_id join public.vendedores ven on ven.id=e.vendedor_id join public.veiculos_entrega v on v.id=a.veiculo_id left join public.enderecos_entrega_encomenda d on d.encomenda_id=e.id where a.id=p_atribuicao_id and parceiro.user_id=auth.uid();
 if resultado is null then raise exception 'Tarefa não encontrada ou sem permissão.'; end if;
 return resultado;
end;
$$;


ALTER FUNCTION "public"."obter_tarefa_entregador"("p_atribuicao_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_vendedor_admin"("p_vendedor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_resultado jsonb;
begin
  if auth.uid() is null or not public.eh_admin() then
    raise exception 'Sem permissão administrativa.';
  end if;

  select jsonb_build_object(
    'vendedor', jsonb_build_object(
      'vendedor_id', v.id, 'user_id', v.user_id, 'nome_comercial', v.nome_comercial,
      'nome_responsavel', v.nome_responsavel, 'email', v.email,
      'telefone', coalesce(v.telefone_whatsapp, v.whatsapp), 'foto_url', v.foto_perfil,
      'criado_em', v.criado_em, 'tipo_vendedor', v.tipo_vendedor,
      'status_aprovacao', v.status_aprovacao, 'conta_ativa', coalesce(v.conta_ativa, false),
      'verificado', coalesce(v.verificado, false), 'plano', v.plano,
      'aprovado_em', v.aprovado_em, 'aprovado_por', v.aprovado_por,
      'motivo_rejeicao', v.motivo_rejeicao,
      'provincia', v.provincia, 'municipio', v.municipio, 'bairro', v.bairro,
      'mercado_bairro', v.mercado_bairro, 'mercado_localizado', v.mercado_localizado,
      'endereco_detalhado', v.endereco_detalhado,
      'pode_receber_encomendas', public.vendedor_pode_receber_encomendas(v.id),
      'motivo_inelegibilidade', case when public.vendedor_pode_receber_encomendas(v.id) then null
        when not coalesce(v.conta_ativa, false) then 'Conta inativa'
        when v.status_aprovacao is distinct from 'aprovado' then 'Vendedor não aprovado'
        when v.user_id is null then 'Sem conta autenticável associada'
        when not exists (select 1 from auth.users u where u.id = v.user_id) then 'Conta Auth não encontrada'
        when not exists (select 1 from public.profiles p where p.id = v.user_id and p.papel = 'vendedor' and coalesce(p.ativo, true) and p.apagado_em is null) then 'Perfil de vendedor inválido ou inativo'
        else 'Não elegível segundo a regra transacional atual' end,
      'documentos_legados_presentes', coalesce(v.documentos, '{}'::jsonb) <> '{}'::jsonb
    ),
    'dados_comerciais', jsonb_strip_nulls(jsonb_build_object(
      'descricao', v.descricao, 'horario_atendimento', v.horario_atendimento,
      'ano_inicio', v.ano_inicio, 'data_inicio_atividade', v.data_inicio_atividade,
      'entrega_disponivel', v.entrega_disponivel, 'entrega_outras_provincias', v.entrega_outras_provincias,
      'tipo_producao', v.tipo_producao, 'area_cultivada', v.area_cultivada,
      'principais_culturas', v.principais_culturas, 'producao_mensal', v.producao_mensal,
      'tipos_produtos', v.tipos_produtos, 'compra_produtores', v.compra_produtores,
      'volume_minimo', v.volume_minimo, 'venda_grosso', v.venda_grosso,
      'venda_retalho', v.venda_retalho, 'venda_presencial', v.venda_presencial,
      'tipo_loja', v.tipo_loja
    )),
    -- Documentos são uma coleção pequena e continuam completos. Nunca inclui paths ou URLs.
    'documentos', coalesce((select jsonb_agg(jsonb_build_object(
      'documento_id', d.id, 'tipo', d.tipo_documento, 'numero', d.numero_documento,
      'validade', d.validade, 'estado', d.estado, 'frente_disponivel', d.frente_path is not null,
      'verso_disponivel', d.verso_path is not null, 'criado_em', d.criado_em,
      'analisado_por', d.analisado_por, 'analisado_em', d.analisado_em,
      'motivo_rejeicao', d.motivo_rejeicao
    ) order by d.criado_em desc) from public.documentos_vendedor d where d.vendedor_id = v.id), '[]'::jsonb),
    -- O histórico completo é consultado na RPC paginada própria.
    'historico_documental_recente', coalesce((select jsonb_agg(item order by criado_em desc) from (
      select jsonb_build_object(
        'evento', de.evento, 'documento_id', de.documento_id, 'estado_anterior', de.estado_anterior,
        'estado_novo', de.estado_novo, 'motivo_rejeicao', de.motivo_rejeicao,
        'realizado_por', de.realizado_por, 'criado_em', de.criado_em
      ) as item, de.criado_em
      from public.documentos_vendedor_eventos de
      where de.vendedor_id = v.id
      order by de.criado_em desc
      limit 20
    ) historico), '[]'::jsonb),
    'resumo', jsonb_build_object(
      'total_produtos', (select count(*) from public.produtos p where p.vendedor_id = v.id),
      'total_servicos', (select count(*) from public.servicos s where s.vendedor_id = v.id),
      'total_encomendas', (select count(*) from public.encomendas e where e.vendedor_id = v.id),
      'total_pagamentos', (select count(*) from public.pagamentos p where p.vendedor_id = v.id),
      'total_disputas', (select count(*) from public.disputas_encomenda d where d.vendedor_id = v.id),
      'total_eventos_documentais', (select count(*) from public.documentos_vendedor_eventos de where de.vendedor_id = v.id)
    ),
    'financeiro', coalesce((
      with pagamentos_vendedor as (
        select p.id, p.estado, p.total_cliente_centimos,
          x.comissao_efetiva_centimos, x.valor_vendedor_efetivo_centimos,
          x.reembolso_total_aprovado_centimos
        from public.pagamentos p
        join lateral public.calcular_valores_financeiros_efetivos(p.id) x on true
        where p.vendedor_id = v.id
      ), financeiro_pagamentos as (
        select
          count(*)::bigint as total_pagamentos,
          coalesce(sum(total_cliente_centimos), 0)::bigint as gmv_bruto_centimos,
          coalesce(sum(greatest(total_cliente_centimos - reembolso_total_aprovado_centimos, 0)), 0)::bigint as gmv_efetivo_centimos,
          coalesce(sum(comissao_efetiva_centimos), 0)::bigint as comissao_centimos,
          coalesce(sum(valor_vendedor_efetivo_centimos), 0)::bigint as valor_vendedor_centimos,
          coalesce(sum(reembolso_total_aprovado_centimos), 0)::bigint as reembolsos_centimos,
          count(*) filter (where estado = 'pendente')::bigint as pagamentos_pendentes,
          count(*) filter (where estado = 'confirmado')::bigint as pagamentos_confirmados
        from pagamentos_vendedor
      ), repasses as (
        select count(*) filter (where r.estado = 'pendente')::bigint as pendentes,
          count(*) filter (where r.estado = 'concluido')::bigint as concluidos
        from public.repasses_vendedor r
        where r.vendedor_id = v.id
      )
      select jsonb_build_object(
        'total_encomendas', (select count(*) from public.encomendas e where e.vendedor_id = v.id),
        'total_pagamentos', fp.total_pagamentos,
        'gmv_bruto_centimos', fp.gmv_bruto_centimos,
        'gmv_efetivo_centimos', fp.gmv_efetivo_centimos,
        'comissao_centimos', fp.comissao_centimos,
        'valor_vendedor_centimos', fp.valor_vendedor_centimos,
        'reembolsos_centimos', fp.reembolsos_centimos,
        'pagamentos_pendentes', fp.pagamentos_pendentes,
        'pagamentos_confirmados', fp.pagamentos_confirmados,
        'repasses_pendentes', r.pendentes,
        'repasses_concluidos', r.concluidos
      ) from financeiro_pagamentos fp cross join repasses r
    ), '{}'::jsonb),
    'metricas', jsonb_build_object(
      'visualizacoes', coalesce((select sum(coalesce(p.visualizacoes,0)) from public.produtos p where p.vendedor_id=v.id),0) + coalesce((select sum(coalesce(s.visualizacoes,0)) from public.servicos s where s.vendedor_id=v.id),0),
      'cliques_whatsapp', coalesce((select sum(coalesce(p.cliques_whatsapp,0)) from public.produtos p where p.vendedor_id=v.id),0) + coalesce((select sum(coalesce(s.cliques_whatsapp,0)) from public.servicos s where s.vendedor_id=v.id),0),
      'contactos_recebidos', (select count(*) from public.historico_contactos h where h.vendedor_id=v.id) + (select count(*) from public.historico_contactos_servicos hs where hs.vendedor_id=v.id)
    ),
    'outros_papeis', jsonb_build_object(
      'cliente', exists(select 1 from public.clientes c where c.id=v.user_id),
      'parceiro_entrega', exists(select 1 from public.parceiros_entrega pe where pe.user_id=v.user_id),
      'admin', exists(select 1 from public.administradores a where a.user_id=v.user_id)
    ),
    'historico_administrativo_disponivel', false
  ) into v_resultado
  from public.vendedores v where v.id=p_vendedor_id;
  if v_resultado is null then raise exception 'Vendedor não encontrado.'; end if;
  return v_resultado;
end;
$$;


ALTER FUNCTION "public"."obter_vendedor_admin"("p_vendedor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preencher_snapshot_logistico_item_encomenda"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_produto public.produtos%rowtype;
begin
  if new.produto_id is null then
    return new;
  end if;

  select * into v_produto
  from public.produtos
  where id = new.produto_id;

  if not found then
    raise exception 'Não foi possível obter os atributos logísticos do produto da encomenda.';
  end if;

  new.peso_por_unidade_comercial_kg_snapshot := v_produto.peso_por_unidade_comercial_kg;
  new.volume_por_unidade_comercial_m3_snapshot := v_produto.volume_por_unidade_comercial_m3;
  new.requer_refrigeracao_snapshot := v_produto.requer_refrigeracao;
  new.requer_caixa_carga_snapshot := v_produto.requer_caixa_carga;
  new.requer_paletes_snapshot := v_produto.requer_paletes;
  return new;
end;
$$;


ALTER FUNCTION "public"."preencher_snapshot_logistico_item_encomenda"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proteger_analise_documento_vendedor"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if public.eh_admin() then
    if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
      if new.estado = 'rejeitado' and coalesce(btrim(new.motivo_rejeicao), '') = '' then
        raise exception 'Indique o motivo da rejeição do documento.';
      end if;
      if new.estado in ('aprovado', 'rejeitado', 'expirado') then
        new.analisado_por = auth.uid();
        new.analisado_em = now();
      end if;
    end if;
    return new;
  end if;

  if split_part(new.frente_path, '/', 1) <> auth.uid()::text
    or (
      new.verso_path is not null
      and split_part(new.verso_path, '/', 1) <> auth.uid()::text
    ) then
    raise exception 'Os ficheiros do documento devem pertencer ao utilizador autenticado.';
  end if;

  if tg_op = 'INSERT' then
    if new.estado <> 'pendente'
      or new.obrigatorio_para_aprovacao <> false
      or new.motivo_rejeicao is not null
      or new.analisado_por is not null
      or new.analisado_em is not null then
      raise exception 'A análise do documento só pode ser definida por administrador.';
    end if;
    return new;
  end if;

  -- O vendedor não edita documentos em análise, aprovados, pendentes ou
  -- expirados. O único fluxo permitido é reenviar uma rejeição para nova
  -- análise, preservando os objetos antigos no Storage.
  if old.estado <> 'rejeitado' or new.estado <> 'pendente' then
    raise exception 'O documento só pode ser alterado ao reenviar uma versão rejeitada.';
  end if;

  -- Whitelist: somente ficheiros e metadados do novo envio, o estado e os
  -- campos administrativos limpos podem mudar. Qualquer campo presente ou
  -- adicionado futuramente fora desta lista permanece imutável para vendedor.
  if (to_jsonb(new) - array[
      'frente_path', 'verso_path', 'numero_documento', 'validade',
      'dados_adicionais', 'estado', 'motivo_rejeicao', 'analisado_por',
      'analisado_em', 'atualizado_em'
    ]) is distinct from (to_jsonb(old) - array[
      'frente_path', 'verso_path', 'numero_documento', 'validade',
      'dados_adicionais', 'estado', 'motivo_rejeicao', 'analisado_por',
      'analisado_em', 'atualizado_em'
    ]) then
    raise exception 'Campos protegidos do documento não podem ser alterados.';
  end if;

  new.motivo_rejeicao = null;
  new.analisado_por = null;
  new.analisado_em = null;
  return new;
end;
$$;


ALTER FUNCTION "public"."proteger_analise_documento_vendedor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proteger_auditoria_administrativa_append_only"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  raise exception 'A auditoria administrativa é append-only.';
end;
$$;


ALTER FUNCTION "public"."proteger_auditoria_administrativa_append_only"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proteger_campos_vendedor"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
 if not public.eh_admin() then
   if tg_op='INSERT' and (coalesce(new.status_aprovacao,'pendente')<>'pendente' or coalesce(new.verificado,false) or coalesce(new.pode_destacar,false) or coalesce(new.plano,'gratuito')<>'gratuito' or new.aprovado_em is not null or new.aprovado_por is not null or new.motivo_rejeicao is not null or new.proximo_destaque_produto_em is not null or new.proximo_destaque_servico_em is not null) then raise exception 'Campos administrativos só podem ser definidos por um administrador'; end if;
   if tg_op='UPDATE' and (new.status_aprovacao is distinct from old.status_aprovacao or new.verificado is distinct from old.verificado or new.pode_destacar is distinct from old.pode_destacar or new.plano is distinct from old.plano or new.user_id is distinct from old.user_id or new.conta_ativa is distinct from old.conta_ativa or new.aprovado_em is distinct from old.aprovado_em or new.aprovado_por is distinct from old.aprovado_por or new.motivo_rejeicao is distinct from old.motivo_rejeicao or new.proximo_destaque_produto_em is distinct from old.proximo_destaque_produto_em or new.proximo_destaque_servico_em is distinct from old.proximo_destaque_servico_em) then raise exception 'Campos administrativos não podem ser alterados pelo vendedor'; end if;
 end if; return new;
end $$;


ALTER FUNCTION "public"."proteger_campos_vendedor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proteger_estado_parceiro_entrega"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_table_name <> 'parceiros_entrega' then return new; end if;

  if tg_op='UPDATE'
    and current_setting('angrolink.submeter_parceiro',true)='true'
    and old.estado in ('rascunho','documentos_pendentes','rejeitado','documentacao_expirada')
    and new.estado='em_analise'
    and new.disponibilidade=false then
    return new;
  end if;

  if not public.eh_admin() then
    if tg_op='INSERT' and (new.estado<>'rascunho' or new.disponibilidade) then
      raise exception 'O parceiro não pode aprovar-se ou ficar disponível no cadastro';
    end if;
    if tg_op='UPDATE' and (
      new.user_id is distinct from old.user_id or new.estado is distinct from old.estado or
      new.motivo_rejeicao is distinct from old.motivo_rejeicao or
      new.motivo_suspensao is distinct from old.motivo_suspensao or
      new.aprovado_em is distinct from old.aprovado_em
    ) then
      raise exception 'O estado administrativo do parceiro só pode ser alterado por administrador';
    end if;
  end if;
  return new;
end; $$;


ALTER FUNCTION "public"."proteger_estado_parceiro_entrega"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proteger_eventos_documento_parceiro"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ begin raise exception 'Os eventos documentais são append-only.'; end; $$;


ALTER FUNCTION "public"."proteger_eventos_documento_parceiro"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proteger_eventos_pagamento_append_only"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin raise exception 'Eventos financeiros são append-only.'; end;
$$;


ALTER FUNCTION "public"."proteger_eventos_pagamento_append_only"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proteger_identidade_verificada_vendedor"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if old.aprovado_em is not null
    and not public.eh_admin()
    and (
      new.nome_responsavel is distinct from old.nome_responsavel
      or new.nome_comercial is distinct from old.nome_comercial
    ) then
    raise exception 'Os nomes verificados não podem ser alterados. Contacte o Apoio ANGROLINK.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."proteger_identidade_verificada_vendedor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proteger_marco_aprovacao_vendedor"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.eh_admin()
    and (
      new.aprovado_em is distinct from old.aprovado_em
      or new.aprovado_por is distinct from old.aprovado_por
    ) then
    raise exception 'O marco de aprovação só pode ser alterado por administrador.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."proteger_marco_aprovacao_vendedor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proteger_movimentos_financeiros_append_only"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  raise exception 'Movimentos financeiros são append-only. Crie um movimento compensatório para corrigir saldos.';
end;
$$;


ALTER FUNCTION "public"."proteger_movimentos_financeiros_append_only"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proteger_nome_verificado_parceiro_entrega"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if old.aprovado_em is not null
    and new.nome_completo is distinct from old.nome_completo
    and not public.eh_admin() then
    raise exception 'O nome verificado não pode ser alterado. Contacte o Apoio ANGROLINK.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."proteger_nome_verificado_parceiro_entrega"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proteger_snapshot_destino_entrega_encomenda"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  raise exception 'O destino de entrega é um snapshot imutável da encomenda.';
end;
$$;


ALTER FUNCTION "public"."proteger_snapshot_destino_entrega_encomenda"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proteger_verificacao_logistica"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_table_name = 'documentos_parceiro_entrega' then
    -- Permite apenas o reenvio controlado de um documento anteriormente rejeitado.
    if tg_op = 'UPDATE'
      and current_setting('angrolink.reenviar_documento', true) = 'true' then
      if old.estado = 'rejeitado' and new.estado = 'pendente' then
        return new;
      end if;
    end if;

    if public.eh_admin() then
      return new;
    end if;

    if tg_op = 'INSERT' then
      if new.estado <> 'pendente' then
        raise exception 'A verificação do documento só pode ser alterada por administrador';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.estado is distinct from old.estado
        or new.motivo_rejeicao is distinct from old.motivo_rejeicao
        or new.analisado_por is distinct from old.analisado_por
        or new.analisado_em is distinct from old.analisado_em then
        raise exception 'A verificação do documento só pode ser alterada por administrador';
      end if;
    end if;

    return new;
  end if;

  if tg_table_name = 'veiculos_entrega' then
    if public.eh_admin() then
      return new;
    end if;

    if tg_op = 'INSERT' then
      if new.estado_verificacao <> 'pendente' then
        raise exception 'A verificação do veículo só pode ser alterada por administrador';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.estado_verificacao is distinct from old.estado_verificacao
        or new.motivo_rejeicao is distinct from old.motivo_rejeicao then
        raise exception 'A verificação do veículo só pode ser alterada por administrador';
      end if;
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."proteger_verificacao_logistica"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proteger_versao_documento_parceiro"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op in ('UPDATE','DELETE') and not public.eh_admin()
    and current_setting('angrolink.sincronizar_documento',true) is distinct from 'true' then
    raise exception 'As versões documentais só podem ser alteradas pelo fluxo controlado.';
  end if;
  if tg_op='UPDATE' and (
    new.documento_id is distinct from old.documento_id or new.parceiro_id is distinct from old.parceiro_id or
    new.veiculo_id is distinct from old.veiculo_id or new.numero_versao is distinct from old.numero_versao or
    new.frente_path is distinct from old.frente_path or new.verso_path is distinct from old.verso_path or
    new.numero_documento_snapshot is distinct from old.numero_documento_snapshot or new.validade_snapshot is distinct from old.validade_snapshot
  ) then raise exception 'Os dados físicos de uma versão documental são imutáveis.'; end if;
  if tg_op='DELETE' then raise exception 'As versões documentais não podem ser eliminadas.'; end if;
  return new;
end; $$;


ALTER FUNCTION "public"."proteger_versao_documento_parceiro"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recusar_atribuicao_entrega"("p_atribuicao_id" "uuid", "p_motivo" "text") RETURNS "public"."atribuicoes_entrega_encomenda"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."recusar_atribuicao_entrega"("p_atribuicao_id" "uuid", "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reenviar_documento_parceiro"("p_documento_id" "uuid", "p_frente_path" "text", "p_verso_path" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.reenviar_documento_parceiro(p_documento_id,p_frente_path,p_verso_path,null,null);
end; $$;


ALTER FUNCTION "public"."reenviar_documento_parceiro"("p_documento_id" "uuid", "p_frente_path" "text", "p_verso_path" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reenviar_documento_parceiro"("p_documento_id" "uuid", "p_frente_path" "text", "p_verso_path" "text", "p_numero_documento" "text", "p_validade" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare d public.documentos_parceiro_entrega%rowtype; v_nova uuid; v_numero integer; v_numero_documento text; v_validade date;
begin
  select d0.* into d from public.documentos_parceiro_entrega d0 join public.parceiros_entrega p on p.id=d0.parceiro_id where d0.id=p_documento_id and p.user_id=auth.uid() and d0.estado in ('rejeitado','expirado') for update;
  if not found then raise exception 'Documento rejeitado ou expirado não encontrado.'; end if;
  if d.estado='expirado' and d.validade is not null and p_validade is null then
    raise exception 'Indique a nova validade para renovar este documento expirado.';
  end if;
  if d.estado='expirado' and d.validade is not null and p_validade <= greatest(d.validade,current_date) then
    raise exception 'A nova validade deve ser posterior à validade expirada e a hoje.';
  end if;
  v_numero_documento:=coalesce(nullif(btrim(p_numero_documento),''),d.numero_documento);
  v_validade:=coalesce(p_validade,d.validade);
  select coalesce(max(numero_versao),0)+1 into v_numero from public.versoes_documento_parceiro_entrega where documento_id=d.id;
  perform set_config('angrolink.sincronizar_documento','true',true);
  update public.versoes_documento_parceiro_entrega set substituido_em=now() where id=d.versao_atual_id;
  insert into public.eventos_documento_parceiro_entrega(documento_id,versao_id,parceiro_id,ator_tipo,utilizador_id,evento,estado_anterior,estado_novo)
  values(d.id,d.versao_atual_id,d.parceiro_id,'parceiro',auth.uid(),'substituido',d.estado,d.estado);
  insert into public.versoes_documento_parceiro_entrega(documento_id,parceiro_id,veiculo_id,numero_versao,frente_path,verso_path,numero_documento_snapshot,validade_snapshot,estado)
  values(d.id,d.parceiro_id,d.veiculo_id,v_numero,p_frente_path,p_verso_path,v_numero_documento,v_validade,'pendente') returning id into v_nova;
  perform set_config('angrolink.reenviar_documento','true',true);
  perform set_config('angrolink.reenviar_versao_documento','true',true);
  update public.documentos_parceiro_entrega set frente_path=p_frente_path,verso_path=p_verso_path,numero_documento=v_numero_documento,validade=v_validade,versao_atual_id=v_nova,estado='pendente',motivo_rejeicao=null,analisado_por=null,analisado_em=null where id=d.id;
  insert into public.eventos_documento_parceiro_entrega(documento_id,versao_id,parceiro_id,ator_tipo,utilizador_id,evento,estado_anterior,estado_novo) values(d.id,v_nova,d.parceiro_id,'parceiro',auth.uid(),'reenviado',d.estado,'pendente');
  perform set_config('angrolink.submeter_parceiro','true',true);
  update public.parceiros_entrega set estado='em_analise',disponibilidade=false
  where id=d.parceiro_id and estado in ('documentos_pendentes','documentacao_expirada');
end; $$;


ALTER FUNCTION "public"."reenviar_documento_parceiro"("p_documento_id" "uuid", "p_frente_path" "text", "p_verso_path" "text", "p_numero_documento" "text", "p_validade" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registar_evento_documento_vendedor"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_evento text;
begin
  if tg_op = 'INSERT' then
    v_evento := 'criado';
    insert into public.documentos_vendedor_eventos (
      documento_id, vendedor_id, evento, estado_novo, detalhes, realizado_por
    ) values (
      new.id, new.vendedor_id, v_evento, new.estado,
      jsonb_build_object('frente_path_novo', new.frente_path, 'verso_path_novo', new.verso_path),
      auth.uid()
    );
    return new;
  end if;

  v_evento := case
    when old.estado = 'rejeitado' and new.estado = 'pendente' then 'reenviado'
    when new.estado is distinct from old.estado then 'analisado'
    else 'atualizado'
  end;

  insert into public.documentos_vendedor_eventos (
    documento_id, vendedor_id, evento, estado_anterior, estado_novo,
    motivo_rejeicao, detalhes, realizado_por
  ) values (
    new.id, new.vendedor_id, v_evento, old.estado, new.estado,
    new.motivo_rejeicao,
    jsonb_build_object(
      'frente_path_anterior', old.frente_path,
      'verso_path_anterior', old.verso_path,
      'frente_path_novo', new.frente_path,
      'verso_path_novo', new.verso_path
    ),
    auth.uid()
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."registar_evento_documento_vendedor"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incidentes_operacionais_entrega" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "encomenda_id" "uuid" NOT NULL,
    "atribuicao_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "motivo" "text" NOT NULL,
    "estado" "text" DEFAULT 'aberto'::"text" NOT NULL,
    "criado_por" "uuid" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolvido_por" "uuid",
    "resolvido_em" timestamp with time zone,
    "observacao_resolucao" "text",
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "incidente_resolucao_consistente" CHECK (((("estado" = 'aberto'::"text") AND ("resolvido_por" IS NULL) AND ("resolvido_em" IS NULL) AND ("observacao_resolucao" IS NULL)) OR (("estado" = 'resolvido'::"text") AND ("resolvido_por" IS NOT NULL) AND ("resolvido_em" IS NOT NULL) AND (("char_length"("btrim"("observacao_resolucao")) >= 3) AND ("char_length"("btrim"("observacao_resolucao")) <= 500))))),
    CONSTRAINT "incidentes_operacionais_entrega_estado_check" CHECK (("estado" = ANY (ARRAY['aberto'::"text", 'resolvido'::"text"]))),
    CONSTRAINT "incidentes_operacionais_entrega_motivo_check" CHECK ((("char_length"("btrim"("motivo")) >= 3) AND ("char_length"("btrim"("motivo")) <= 500))),
    CONSTRAINT "incidentes_operacionais_entrega_tipo_check" CHECK (("tipo" = ANY (ARRAY['entregador_indisponivel'::"text", 'vendedor_indisponivel'::"text", 'cliente_indisponivel'::"text", 'problema_veiculo'::"text", 'problema_pagamento'::"text", 'problema_otp'::"text", 'outro'::"text"])))
);


ALTER TABLE "public"."incidentes_operacionais_entrega" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registar_incidente_operacional_entrega_admin"("p_atribuicao_id" "uuid", "p_tipo" "text", "p_motivo" "text", "p_chave_idempotencia" "uuid") RETURNS "public"."incidentes_operacionais_entrega"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_tipo text:=nullif(btrim(p_tipo),''); v_motivo text:=nullif(btrim(p_motivo),''); v_hash text;
  v_idempotencia public.idempotencia_intervencao_entrega_admin%rowtype; v_atribuicao public.atribuicoes_entrega_encomenda%rowtype; v_encomenda public.encomendas%rowtype; v_incidente public.incidentes_operacionais_entrega%rowtype;
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if p_atribuicao_id is null or p_chave_idempotencia is null or v_tipo not in ('entregador_indisponivel','vendedor_indisponivel','cliente_indisponivel','problema_veiculo','problema_pagamento','problema_otp','outro') or v_motivo is null or char_length(v_motivo) not between 3 and 500 then raise exception 'Indique um tipo e um motivo entre 3 e 500 caracteres.'; end if;
  v_hash:=public.hash_intervencao_entrega_admin(jsonb_build_object('atribuicao_id',p_atribuicao_id,'tipo',v_tipo,'motivo',v_motivo));
  insert into public.idempotencia_intervencao_entrega_admin(administrador_id,operacao,chave_idempotencia,payload_hash) values(auth.uid(),'abrir_incidente',p_chave_idempotencia,v_hash) on conflict (administrador_id,operacao,chave_idempotencia) do nothing;
  select * into v_idempotencia from public.idempotencia_intervencao_entrega_admin where administrador_id=auth.uid() and operacao='abrir_incidente' and chave_idempotencia=p_chave_idempotencia for update;
  if v_idempotencia.payload_hash<>v_hash then raise exception 'A chave de idempotência já foi usada com dados diferentes.'; end if;
  if v_idempotencia.incidente_id is not null then select * into v_incidente from public.incidentes_operacionais_entrega where id=v_idempotencia.incidente_id; return v_incidente; end if;
  select * into v_atribuicao from public.atribuicoes_entrega_encomenda where id=p_atribuicao_id for update; if not found then raise exception 'Atribuição não encontrada.'; end if;
  select * into v_encomenda from public.encomendas where id=v_atribuicao.encomenda_id for update;
  if v_encomenda.modalidade_recebimento<>'entrega' or v_atribuicao.estado not in ('recolhida','chegou_destino') or v_encomenda.estado not in ('recolhida','chegou_destino') then raise exception 'Um incidente operacional só pode ser registado depois da recolha.'; end if;
  select * into v_incidente from public.incidentes_operacionais_entrega where atribuicao_id=v_atribuicao.id and estado='aberto' for update;
  if found then raise exception 'Já existe um incidente operacional aberto para esta tarefa.'; end if;
  insert into public.incidentes_operacionais_entrega(encomenda_id,atribuicao_id,tipo,motivo,criado_por) values(v_encomenda.id,v_atribuicao.id,v_tipo,v_motivo,auth.uid()) returning * into v_incidente;
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(v_encomenda.id,'incidente_operacional_aberto',v_encomenda.estado,v_encomenda.estado,'admin',auth.uid(),jsonb_build_object('atribuicao_id',v_atribuicao.id,'incidente_id',v_incidente.id,'tipo',v_tipo));
  update public.idempotencia_intervencao_entrega_admin set atribuicao_id=v_atribuicao.id,incidente_id=v_incidente.id,concluida_em=now() where id=v_idempotencia.id;
  return v_incidente;
end;
$$;


ALTER FUNCTION "public"."registar_incidente_operacional_entrega_admin"("p_atribuicao_id" "uuid", "p_tipo" "text", "p_motivo" "text", "p_chave_idempotencia" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registar_pagamento_na_entrega_entregador"("p_atribuicao_id" "uuid") RETURNS "public"."pagamentos"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_atribuicao public.atribuicoes_entrega_encomenda%rowtype; v_encomenda public.encomendas%rowtype; v_pagamento public.pagamentos%rowtype; v_tentativa public.tentativas_pagamento%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select a.* into v_atribuicao from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id where a.id=p_atribuicao_id and p.user_id=auth.uid() for update;
  if not found then raise exception 'Tarefa não encontrada ou sem permissão.'; end if;
  select * into v_encomenda from public.encomendas where id=v_atribuicao.encomenda_id for update;
  if v_encomenda.modalidade_recebimento <> 'entrega' or v_atribuicao.estado not in ('chegou_destino','concluida') or v_encomenda.estado not in ('chegou_destino','concluida') then raise exception 'O pagamento só pode ser registado depois da chegada ao destino.'; end if;
  select * into v_pagamento from public.pagamentos where encomenda_id=v_encomenda.id for update;
  if not found then raise exception 'Pagamento não encontrado.'; end if;
  select * into v_tentativa from public.tentativas_pagamento where pagamento_id=v_pagamento.id and metodo='pagamento_na_entrega' order by criado_em desc,id desc limit 1 for update;
  if not found then raise exception 'Não existe pagamento na entrega pendente para esta encomenda.'; end if;
  if v_pagamento.estado='confirmado' and v_tentativa.estado='confirmada' then return v_pagamento; end if;
  if v_pagamento.estado <> 'pendente' or v_tentativa.estado not in ('criada','pendente') then raise exception 'O pagamento não pode ser confirmado no estado atual.'; end if;
  update public.tentativas_pagamento set estado='confirmada',confirmado_em=now(),metadados=metadados || jsonb_build_object('confirmado_na_entrega_por',auth.uid()) where id=v_tentativa.id;
  update public.pagamentos set estado='confirmado',confirmado_em=now() where id=v_pagamento.id returning * into v_pagamento;
  insert into public.eventos_pagamento(pagamento_id,tentativa_pagamento_id,encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(v_pagamento.id,v_tentativa.id,v_encomenda.id,'pagamento_confirmado','pendente','confirmado','entregador',auth.uid(),jsonb_build_object('metodo','pagamento_na_entrega','atribuicao_id',v_atribuicao.id));
  return v_pagamento;
end;
$$;


ALTER FUNCTION "public"."registar_pagamento_na_entrega_entregador"("p_atribuicao_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remover_area_cobertura_entrega"("p_area_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  delete from public.areas_cobertura_entrega a where a.id=p_area_id and exists(select 1 from public.parceiros_entrega p where p.id=a.parceiro_id and p.user_id=auth.uid());
  if not found then raise exception 'Área de cobertura não encontrada ou sem permissão.'; end if;
end; $$;


ALTER FUNCTION "public"."remover_area_cobertura_entrega"("p_area_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remover_destaque_produto"("produto_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.produtos p
  set
    destaque = false,
    destaque_inicio = null,
    destaque_ate = null,
    tipo_destaque = null
  where p.id = produto_uuid
    and exists (
      select 1
      from public.vendedores v
      where v.id = p.vendedor_id
        and v.user_id = auth.uid()
    );
end;
$$;


ALTER FUNCTION "public"."remover_destaque_produto"("produto_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remover_destaque_servico"("servico_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.servicos s
  set
    destaque = false,
    destaque_inicio = null,
    destaque_ate = null,
    tipo_destaque = null
  where s.id = servico_uuid
    and exists (
      select 1
      from public.vendedores v
      where v.id = s.vendedor_id
        and v.user_id = auth.uid()
    );
end;
$$;


ALTER FUNCTION "public"."remover_destaque_servico"("servico_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolver_disputa_reembolso_parcial_admin"("p_disputa_id" "uuid", "p_valor_produtos_centimos" bigint, "p_valor_entrega_centimos" bigint, "p_valor_taxa_processador_centimos" bigint, "p_observacao" "text", "p_chave_idempotencia" "uuid") RETURNS "public"."disputas_encomenda"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_disputa public.disputas_encomenda%rowtype;
  v_pagamento public.pagamentos%rowtype;
  v_reembolso public.reembolsos_pagamento%rowtype;
  v_observacao text := nullif(btrim(p_observacao), '');
  v_produtos bigint := coalesce(p_valor_produtos_centimos, 0);
  v_entrega bigint := coalesce(p_valor_entrega_centimos, 0);
  v_taxa bigint := coalesce(p_valor_taxa_processador_centimos, 0);
  v_total bigint;
  v_referencia text;
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if v_observacao is null or char_length(v_observacao) not between 3 and 1000 or p_chave_idempotencia is null then
    raise exception 'Indique observação válida e chave de idempotência.';
  end if;
  if v_produtos < 0 or v_entrega < 0 then raise exception 'Os componentes do reembolso não podem ser negativos.'; end if;
  -- Política V1: a taxa do processador não é reembolsável, nem parcialmente.
  if v_taxa <> 0 then
    raise exception 'A política atual não permite reembolsar a taxa do processador.';
  end if;
  v_total := v_produtos + v_entrega;
  if v_total <= 0 then raise exception 'O reembolso parcial deve ser superior a zero.'; end if;

  -- A chave é consultada antes de exigir em_analise para suportar retry após sucesso.
  select * into v_disputa from public.disputas_encomenda where id = p_disputa_id;
  if not found then raise exception 'Disputa não encontrada.'; end if;
  select * into v_reembolso from public.reembolsos_pagamento where chave_idempotencia = p_chave_idempotencia;
  if found then
    if v_reembolso.pagamento_id <> v_disputa.pagamento_id
      or v_reembolso.valor_produtos_aprovado_centimos <> v_produtos
      or v_reembolso.valor_entrega_aprovado_centimos <> v_entrega
      or v_reembolso.valor_taxa_processador_aprovado_centimos <> v_taxa
      or v_reembolso.motivo <> v_observacao
      or v_disputa.estado <> 'resolvida_reembolso_parcial' then
      raise exception 'A chave de idempotência já foi usada com dados diferentes.';
    end if;
    return v_disputa;
  end if;

  select * into v_disputa from public.disputas_encomenda where id = p_disputa_id for update;
  if not found then raise exception 'Disputa não encontrada.'; end if;
  if v_disputa.estado <> 'em_analise' then
    select * into v_reembolso from public.reembolsos_pagamento where chave_idempotencia = p_chave_idempotencia;
    if found
      and v_reembolso.pagamento_id = v_disputa.pagamento_id
      and v_reembolso.valor_produtos_aprovado_centimos = v_produtos
      and v_reembolso.valor_entrega_aprovado_centimos = v_entrega
      and v_reembolso.valor_taxa_processador_aprovado_centimos = v_taxa
      and v_reembolso.motivo = v_observacao
      and v_disputa.estado = 'resolvida_reembolso_parcial' then
      return v_disputa;
    end if;
    raise exception 'A disputa não está em análise.';
  end if;

  select * into v_pagamento from public.pagamentos where id = v_disputa.pagamento_id for update;
  if not found then raise exception 'Pagamento não encontrado.'; end if;
  v_referencia := 'RMB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));

  begin
    insert into public.reembolsos_pagamento (
      pagamento_id, encomenda_id, estado, motivo,
      valor_solicitado_centimos, valor_produtos_solicitado_centimos,
      valor_entrega_solicitado_centimos, valor_taxa_processador_solicitado_centimos,
      valor_aprovado_centimos, valor_produtos_aprovado_centimos,
      valor_entrega_aprovado_centimos, valor_taxa_processador_aprovado_centimos,
      referencia_interna, chave_idempotencia, solicitado_por, aprovado_por, aprovado_em
    ) values (
      v_pagamento.id, v_pagamento.encomenda_id, 'aprovado', v_observacao,
      v_total, v_produtos, v_entrega, 0, v_total, v_produtos, v_entrega, 0,
      v_referencia, p_chave_idempotencia, auth.uid(), auth.uid(), now()
    );
  exception when unique_violation then
    select * into v_reembolso from public.reembolsos_pagamento where chave_idempotencia = p_chave_idempotencia;
    select * into v_disputa from public.disputas_encomenda where id = p_disputa_id;
    if found
      and v_reembolso.pagamento_id = v_pagamento.id
      and v_reembolso.valor_produtos_aprovado_centimos = v_produtos
      and v_reembolso.valor_entrega_aprovado_centimos = v_entrega
      and v_reembolso.valor_taxa_processador_aprovado_centimos = v_taxa
      and v_reembolso.motivo = v_observacao
      and v_disputa.estado = 'resolvida_reembolso_parcial' then
      return v_disputa;
    end if;
    raise;
  end;

  update public.disputas_encomenda
  set estado = 'resolvida_reembolso_parcial', decisao = v_observacao,
    observacao_resolucao = v_observacao, resolvido_por = auth.uid(), resolvido_em = now()
  where id = v_disputa.id returning * into v_disputa;

  insert into public.auditoria_administrativa(
    admin_user_id, entidade_tipo, entidade_id, acao, estado_anterior, estado_novo, motivo, metadados
  ) values (
    auth.uid(), 'disputa', v_disputa.id, 'disputa_resolvida_reembolso_parcial',
    'em_analise', v_disputa.estado, v_observacao,
    jsonb_build_object('valor_aprovado_centimos', v_total)
  );
  return v_disputa;
end;
$$;


ALTER FUNCTION "public"."resolver_disputa_reembolso_parcial_admin"("p_disputa_id" "uuid", "p_valor_produtos_centimos" bigint, "p_valor_entrega_centimos" bigint, "p_valor_taxa_processador_centimos" bigint, "p_observacao" "text", "p_chave_idempotencia" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolver_disputa_reembolso_total_admin"("p_disputa_id" "uuid", "p_observacao" "text", "p_chave_idempotencia" "uuid") RETURNS "public"."disputas_encomenda"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_disputa public.disputas_encomenda%rowtype;
  v_pagamento public.pagamentos%rowtype;
  v_reembolso public.reembolsos_pagamento%rowtype;
  v_observacao text := nullif(btrim(p_observacao), '');
  v_produtos bigint;
  v_entrega bigint;
  v_total bigint;
  v_referencia text;
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if v_observacao is null or char_length(v_observacao) not between 3 and 1000 or p_chave_idempotencia is null then
    raise exception 'Indique observação válida e chave de idempotência.';
  end if;

  -- Retry só é válido se esta chave já tiver resolvido esta mesma disputa como total.
  select * into v_disputa from public.disputas_encomenda where id = p_disputa_id;
  if not found then raise exception 'Disputa não encontrada.'; end if;
  select * into v_reembolso from public.reembolsos_pagamento where chave_idempotencia = p_chave_idempotencia;
  if found then
    if v_reembolso.pagamento_id <> v_disputa.pagamento_id
      or v_reembolso.motivo <> v_observacao
      or v_reembolso.valor_taxa_processador_aprovado_centimos <> 0
      or v_disputa.estado <> 'resolvida_reembolso_total' then
      raise exception 'A chave de idempotência já foi usada com dados diferentes.';
    end if;
    return v_disputa;
  end if;

  select * into v_disputa from public.disputas_encomenda where id = p_disputa_id for update;
  if not found then raise exception 'Disputa não encontrada.'; end if;
  if v_disputa.estado <> 'em_analise' then
    select * into v_reembolso from public.reembolsos_pagamento where chave_idempotencia = p_chave_idempotencia;
    if found
      and v_reembolso.pagamento_id = v_disputa.pagamento_id
      and v_reembolso.motivo = v_observacao
      and v_reembolso.valor_taxa_processador_aprovado_centimos = 0
      and v_disputa.estado = 'resolvida_reembolso_total' then
      return v_disputa;
    end if;
    raise exception 'A disputa não está em análise.';
  end if;

  select * into v_pagamento from public.pagamentos where id = v_disputa.pagamento_id for update;
  if not found then raise exception 'Pagamento não encontrado.'; end if;
  select
    (v_pagamento.subtotal_centimos - v_pagamento.desconto_centimos)
      - coalesce(sum(r.valor_produtos_aprovado_centimos) filter (where r.estado in ('aprovado', 'processando', 'concluido')), 0),
    v_pagamento.entrega_centimos
      - coalesce(sum(r.valor_entrega_aprovado_centimos) filter (where r.estado in ('aprovado', 'processando', 'concluido')), 0)
  into v_produtos, v_entrega
  from public.reembolsos_pagamento r
  where r.pagamento_id = v_pagamento.id;

  v_total := v_produtos + v_entrega;
  if v_total <= 0 then raise exception 'Não existe valor elegível restante para reembolso total.'; end if;
  v_referencia := 'RMB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));

  begin
    insert into public.reembolsos_pagamento (
      pagamento_id, encomenda_id, estado, motivo,
      valor_solicitado_centimos, valor_produtos_solicitado_centimos,
      valor_entrega_solicitado_centimos, valor_taxa_processador_solicitado_centimos,
      valor_aprovado_centimos, valor_produtos_aprovado_centimos,
      valor_entrega_aprovado_centimos, valor_taxa_processador_aprovado_centimos,
      referencia_interna, chave_idempotencia, solicitado_por, aprovado_por, aprovado_em
    ) values (
      v_pagamento.id, v_pagamento.encomenda_id, 'aprovado', v_observacao,
      v_total, v_produtos, v_entrega, 0, v_total, v_produtos, v_entrega, 0,
      v_referencia, p_chave_idempotencia, auth.uid(), auth.uid(), now()
    );
  exception when unique_violation then
    select * into v_reembolso from public.reembolsos_pagamento where chave_idempotencia = p_chave_idempotencia;
    select * into v_disputa from public.disputas_encomenda where id = p_disputa_id;
    if found
      and v_reembolso.pagamento_id = v_pagamento.id
      and v_reembolso.motivo = v_observacao
      and v_reembolso.valor_taxa_processador_aprovado_centimos = 0
      and v_disputa.estado = 'resolvida_reembolso_total' then
      return v_disputa;
    end if;
    raise;
  end;

  update public.disputas_encomenda
  set estado = 'resolvida_reembolso_total', decisao = v_observacao,
    observacao_resolucao = v_observacao, resolvido_por = auth.uid(), resolvido_em = now()
  where id = v_disputa.id returning * into v_disputa;

  insert into public.auditoria_administrativa(
    admin_user_id, entidade_tipo, entidade_id, acao, estado_anterior, estado_novo, motivo, metadados
  ) values (
    auth.uid(), 'disputa', v_disputa.id, 'disputa_resolvida_reembolso_total',
    'em_analise', v_disputa.estado, v_observacao,
    jsonb_build_object(
      'valor_produtos_centimos', v_produtos,
      'valor_entrega_centimos', v_entrega,
      'taxa_processador_centimos', 0
    )
  );
  return v_disputa;
end;
$$;


ALTER FUNCTION "public"."resolver_disputa_reembolso_total_admin"("p_disputa_id" "uuid", "p_observacao" "text", "p_chave_idempotencia" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolver_disputa_sem_reembolso_admin"("p_disputa_id" "uuid", "p_observacao" "text") RETURNS "public"."disputas_encomenda"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_disputa public.disputas_encomenda%rowtype;
declare v_observacao text := nullif(btrim(p_observacao), '');
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if v_observacao is null or char_length(v_observacao) not between 3 and 1000 then
    raise exception 'Indique uma observação entre 3 e 1000 caracteres.';
  end if;
  select * into v_disputa from public.disputas_encomenda where id = p_disputa_id for update;
  if not found or v_disputa.estado <> 'em_analise' then raise exception 'A disputa não está em análise.'; end if;

  update public.disputas_encomenda
  set estado = 'resolvida_sem_reembolso', decisao = v_observacao,
    observacao_resolucao = v_observacao, resolvido_por = auth.uid(), resolvido_em = now()
  where id = v_disputa.id returning * into v_disputa;

  insert into public.auditoria_administrativa(
    admin_user_id, entidade_tipo, entidade_id, acao, estado_anterior, estado_novo, motivo
  ) values (
    auth.uid(), 'disputa', v_disputa.id, 'disputa_resolvida_sem_reembolso',
    'em_analise', v_disputa.estado, v_observacao
  );
  return v_disputa;
end;
$$;


ALTER FUNCTION "public"."resolver_disputa_sem_reembolso_admin"("p_disputa_id" "uuid", "p_observacao" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolver_incidente_operacional_entrega_admin"("p_incidente_id" "uuid", "p_observacao" "text", "p_chave_idempotencia" "uuid") RETURNS "public"."incidentes_operacionais_entrega"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_observacao text:=nullif(btrim(p_observacao),''); v_hash text; v_idempotencia public.idempotencia_intervencao_entrega_admin%rowtype; v_incidente public.incidentes_operacionais_entrega%rowtype;
begin
  if auth.uid() is null or not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if;
  if p_incidente_id is null or p_chave_idempotencia is null or v_observacao is null or char_length(v_observacao) not between 3 and 500 then raise exception 'Indique uma observação entre 3 e 500 caracteres.'; end if;
  v_hash:=public.hash_intervencao_entrega_admin(jsonb_build_object('incidente_id',p_incidente_id,'observacao',v_observacao));
  insert into public.idempotencia_intervencao_entrega_admin(administrador_id,operacao,chave_idempotencia,payload_hash) values(auth.uid(),'resolver_incidente',p_chave_idempotencia,v_hash) on conflict (administrador_id,operacao,chave_idempotencia) do nothing;
  select * into v_idempotencia from public.idempotencia_intervencao_entrega_admin where administrador_id=auth.uid() and operacao='resolver_incidente' and chave_idempotencia=p_chave_idempotencia for update;
  if v_idempotencia.payload_hash<>v_hash then raise exception 'A chave de idempotência já foi usada com dados diferentes.'; end if;
  if v_idempotencia.incidente_id is not null then select * into v_incidente from public.incidentes_operacionais_entrega where id=v_idempotencia.incidente_id; return v_incidente; end if;
  select * into v_incidente from public.incidentes_operacionais_entrega where id=p_incidente_id for update; if not found then raise exception 'Incidente operacional não encontrado.'; end if;
  if v_incidente.estado='resolvido' then raise exception 'Este incidente operacional já foi resolvido.'; end if;
  update public.incidentes_operacionais_entrega set estado='resolvido',resolvido_por=auth.uid(),resolvido_em=now(),observacao_resolucao=v_observacao where id=v_incidente.id returning * into v_incidente;
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(v_incidente.encomenda_id,'incidente_operacional_resolvido',null,null,'admin',auth.uid(),jsonb_build_object('atribuicao_id',v_incidente.atribuicao_id,'incidente_id',v_incidente.id));
  update public.idempotencia_intervencao_entrega_admin set atribuicao_id=v_incidente.atribuicao_id,incidente_id=v_incidente.id,concluida_em=now() where id=v_idempotencia.id;
  return v_incidente;
end;
$$;


ALTER FUNCTION "public"."resolver_incidente_operacional_entrega_admin"("p_incidente_id" "uuid", "p_observacao" "text", "p_chave_idempotencia" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolver_territorio_angola"("p_provincia" "text", "p_municipio" "text") RETURNS TABLE("provincia_id" "uuid", "provincia_nome" "text", "provincia_codigo" "text", "municipio_id" "uuid", "municipio_nome" "text", "municipio_codigo" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p.id, p.nome, p.codigo_oficial, m.id, m.nome, m.codigo_oficial
  from public.provincias_angola p
  join public.municipios_angola m on m.provincia_id = p.id
  where p.ativo and m.ativo
    and public.normalizar_texto_territorial(p.nome) = public.normalizar_texto_territorial(p_provincia)
    and public.normalizar_texto_territorial(m.nome) = public.normalizar_texto_territorial(p_municipio);
$$;


ALTER FUNCTION "public"."resolver_territorio_angola"("p_provincia" "text", "p_municipio" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sincronizar_analise_versao_documento_parceiro"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- O reenvio já regista a substituição e a nova versão explicitamente. Não
  -- deve gerar um terceiro evento genérico de "submetido" no mesmo acto.
  if current_setting('angrolink.reenviar_versao_documento', true) is distinct from 'true'
    and new.versao_atual_id is not null
    and (new.estado is distinct from old.estado or new.analisado_por is distinct from old.analisado_por or new.analisado_em is distinct from old.analisado_em or new.motivo_rejeicao is distinct from old.motivo_rejeicao) then
    perform set_config('angrolink.sincronizar_documento','true',true);
    update public.versoes_documento_parceiro_entrega set estado=new.estado,analisado_por=new.analisado_por,analisado_em=new.analisado_em,motivo_rejeicao=new.motivo_rejeicao where id=new.versao_atual_id;
    insert into public.eventos_documento_parceiro_entrega(documento_id,versao_id,parceiro_id,ator_tipo,utilizador_id,evento,estado_anterior,estado_novo,motivo)
    values(new.id,new.versao_atual_id,new.parceiro_id,case when public.eh_admin() then 'admin' else 'sistema' end,auth.uid(),case when new.estado='aprovado' then 'aprovado' when new.estado='rejeitado' then 'rejeitado' when new.estado='expirado' then 'expirado' else 'submetido' end,old.estado,new.estado,new.motivo_rejeicao);
  end if; return new;
end; $$;


ALTER FUNCTION "public"."sincronizar_analise_versao_documento_parceiro"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parceiros_entrega" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "nome_completo" "text" NOT NULL,
    "email" "text",
    "telefone" "text" NOT NULL,
    "provincia" "text" NOT NULL,
    "municipio" "text" NOT NULL,
    "bairro" "text",
    "zona_base" "text",
    "foto_perfil_url" "text",
    "contacto_emergencia" "text" NOT NULL,
    "termos_aceites_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "estado" "text" DEFAULT 'rascunho'::"text" NOT NULL,
    "disponibilidade" boolean DEFAULT false NOT NULL,
    "motivo_rejeicao" "text",
    "motivo_suspensao" "text",
    "aprovado_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "indicativo_telefone" "text",
    "telefone_nacional" "text",
    CONSTRAINT "parceiro_disponivel_aprovado" CHECK (((NOT "disponibilidade") OR ("estado" = 'aprovado'::"text"))),
    CONSTRAINT "parceiros_entrega_estado_check" CHECK (("estado" = ANY (ARRAY['rascunho'::"text", 'documentos_pendentes'::"text", 'em_analise'::"text", 'aprovado'::"text", 'rejeitado'::"text", 'suspenso'::"text", 'documentacao_expirada'::"text"])))
);


ALTER TABLE "public"."parceiros_entrega" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submeter_pedido_parceiro_entrega"("p_parceiro_id" "uuid") RETURNS "public"."parceiros_entrega"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_estado text;
  v_total_documentos integer;
  v_minimo_documentos integer;
  v_resultado public.parceiros_entrega%rowtype;
begin
  select estado
    into v_estado
  from public.parceiros_entrega
  where id = p_parceiro_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Parceiro não encontrado ou sem permissão.';
  end if;

  if v_estado not in ('rascunho', 'documentos_pendentes', 'rejeitado') then
    raise exception 'Este pedido não pode ser submetido no estado atual.';
  end if;

  if not exists (
    select 1
    from public.veiculos_entrega
    where parceiro_id = p_parceiro_id
  ) then
    raise exception 'Indique pelo menos um veículo antes de enviar o pedido.';
  end if;

  select count(*)
    into v_total_documentos
  from public.documentos_parceiro_entrega
  where parceiro_id = p_parceiro_id
    and nullif(frente_path, '') is not null
    and nullif(verso_path, '') is not null;

  select case
    when exists (
      select 1
      from public.veiculos_entrega
      where parceiro_id = p_parceiro_id
        and tipo_veiculo = 'mota'
    ) then 4
    else 6
  end
  into v_minimo_documentos;

  if v_total_documentos < v_minimo_documentos then
    raise exception
      'Envie frente e verso de todos os documentos obrigatórios.';
  end if;

  perform set_config('angrolink.submeter_parceiro', 'true', true);

  update public.parceiros_entrega
  set
    estado = 'em_analise',
    disponibilidade = false,
    motivo_rejeicao = null,
    motivo_suspensao = null,
    atualizado_em = now()
  where id = p_parceiro_id
  returning * into v_resultado;

  return v_resultado;
end;
$$;


ALTER FUNCTION "public"."submeter_pedido_parceiro_entrega"("p_parceiro_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."territorio_angola_valido"("p_provincia" "text", "p_municipio" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists(select 1 from public.resolver_territorio_angola(p_provincia, p_municipio));
$$;


ALTER FUNCTION "public"."territorio_angola_valido"("p_provincia" "text", "p_municipio" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transicionar_encomenda_levantamento"("p_encomenda_id" "uuid", "p_proximo_estado" "text", "p_motivo" "text" DEFAULT NULL::"text") RETURNS "public"."encomendas"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_encomenda public.encomendas%rowtype;
  v_estado_anterior text;
  v_ator text;
  v_evento text;
  v_motivo text := nullif(btrim(p_motivo), '');
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão novamente.';
  end if;

  select * into v_encomenda from public.encomendas where id = p_encomenda_id for update;
  if not found then raise exception 'Encomenda não encontrada.'; end if;

  if exists (select 1 from public.clientes c where c.id = v_encomenda.cliente_id and c.id = auth.uid()) then
    v_ator := 'cliente';
  elsif exists (
    select 1 from public.vendedores v
    where v.id = v_encomenda.vendedor_id and v.user_id = auth.uid()
      and public.vendedor_pode_receber_encomendas(v.id) = true
  ) then
    v_ator := 'vendedor';
  else
    raise exception 'Sem permissão para alterar esta encomenda.';
  end if;

  if v_ator = 'cliente' then
    if v_encomenda.estado = 'aguardando_confirmacao' and p_proximo_estado = 'cancelada' then
      if v_motivo is null or char_length(v_motivo) < 3 or char_length(v_motivo) > 500 then
        raise exception 'Indique um motivo de cancelamento entre 3 e 500 caracteres.';
      end if;
      v_evento := 'cliente_cancelou';
    elsif v_encomenda.estado = 'levantada' and p_proximo_estado = 'concluida' then
      v_evento := 'encomenda_concluida';
    else
      raise exception 'Esta transição não é permitida para o cliente.';
    end if;
  else
    if v_encomenda.estado = 'aguardando_confirmacao' and p_proximo_estado = 'confirmada' then
      v_evento := 'vendedor_confirmou';
    elsif v_encomenda.estado = 'aguardando_confirmacao' and p_proximo_estado = 'recusada' then
      if v_motivo is null or char_length(v_motivo) < 3 or char_length(v_motivo) > 500 then
        raise exception 'Indique um motivo de recusa entre 3 e 500 caracteres.';
      end if;
      v_evento := 'vendedor_recusou';
    elsif v_encomenda.estado = 'confirmada' and p_proximo_estado = 'em_preparacao' then
      v_evento := 'preparacao_iniciada';
    elsif v_encomenda.estado = 'em_preparacao' and p_proximo_estado = 'pronta_para_levantamento' then
      v_evento := 'pronta_para_levantamento';
    else
      raise exception 'Esta transição não é permitida para o vendedor.';
    end if;
  end if;

  v_estado_anterior := v_encomenda.estado;
  update public.encomendas set
    estado = p_proximo_estado,
    motivo_recusa = case when v_ator = 'vendedor' and p_proximo_estado = 'recusada' then v_motivo else motivo_recusa end,
    motivo_cancelamento = case when v_ator = 'cliente' and p_proximo_estado = 'cancelada' then v_motivo else motivo_cancelamento end,
    confirmado_em = case when p_proximo_estado = 'confirmada' then now() else confirmado_em end,
    recusado_em = case when p_proximo_estado = 'recusada' then now() else recusado_em end,
    concluido_em = case when p_proximo_estado = 'concluida' then now() else concluido_em end,
    cancelado_em = case when p_proximo_estado = 'cancelada' then now() else cancelado_em end
  where id = v_encomenda.id returning * into v_encomenda;

  insert into public.eventos_encomenda (encomenda_id, tipo_evento, estado_anterior, estado_novo, ator_tipo, utilizador_id, metadados)
  values (
    v_encomenda.id, v_evento, v_estado_anterior, p_proximo_estado, v_ator, auth.uid(),
    case when v_evento in ('cliente_cancelou', 'vendedor_recusou') then jsonb_build_object('motivo', v_motivo) else '{}'::jsonb end
  );

  return v_encomenda;
end;
$$;


ALTER FUNCTION "public"."transicionar_encomenda_levantamento"("p_encomenda_id" "uuid", "p_proximo_estado" "text", "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_codigo_entrega_entregador"("p_atribuicao_id" "uuid", "p_codigo" "text") RETURNS TABLE("validado" boolean, "estado_encomenda" "text", "tentativas_restantes" smallint, "bloqueado" boolean, "motivo" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare v_atribuicao public.atribuicoes_entrega_encomenda%rowtype; v_encomenda public.encomendas%rowtype; v_codigo public.codigos_entrega%rowtype; v_pagamento public.pagamentos%rowtype; v_apresentado text:=nullif(btrim(p_codigo),''); v_agora timestamptz:=now(); v_tentativas smallint;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  if v_apresentado is null or v_apresentado !~ '^[0-9]{6}$' then raise exception 'Introduza o código de entrega de seis dígitos.'; end if;
  select a.* into v_atribuicao from public.atribuicoes_entrega_encomenda a join public.parceiros_entrega p on p.id=a.parceiro_entrega_id where a.id=p_atribuicao_id and p.user_id=auth.uid() for update;
  if not found then raise exception 'Tarefa não encontrada ou sem permissão.'; end if;
  select * into v_encomenda from public.encomendas where id=v_atribuicao.encomenda_id for update;
  if v_atribuicao.estado='concluida' and v_encomenda.estado='concluida' then validado:=true;estado_encomenda:='concluida';tentativas_restantes:=0;bloqueado:=false;motivo:=null;return next;return; end if;
  if v_encomenda.modalidade_recebimento <> 'entrega' or v_atribuicao.estado <> 'chegou_destino' or v_encomenda.estado <> 'chegou_destino' then raise exception 'A entrega não pode ser confirmada no estado atual.'; end if;
  select * into v_pagamento from public.pagamentos where encomenda_id=v_encomenda.id for update;
  if not found or v_pagamento.estado <> 'confirmado' then raise exception 'Registe primeiro o pagamento aplicável antes de confirmar a entrega.'; end if;
  select * into v_codigo from public.codigos_entrega where encomenda_id=v_encomenda.id for update;
  if not found then validado:=false;estado_encomenda:=v_encomenda.estado;tentativas_restantes:=0;bloqueado:=false;motivo:='O comprador ainda não gerou um código de entrega.';return next;return; end if;
  if v_codigo.usado_em is not null or v_codigo.bloqueado_em is not null or v_codigo.expira_em <= v_agora then validado:=false;estado_encomenda:=v_encomenda.estado;tentativas_restantes:=greatest(v_codigo.max_tentativas-v_codigo.tentativas,0);bloqueado:=v_codigo.bloqueado_em is not null;motivo:=case when v_codigo.usado_em is not null then 'Este código de entrega já foi utilizado.' when v_codigo.bloqueado_em is not null then 'Este código de entrega está bloqueado. O comprador deve renová-lo.' else 'Este código de entrega expirou. O comprador deve renová-lo.' end;return next;return; end if;
  if extensions.crypt(v_apresentado,v_codigo.codigo_hash) <> v_codigo.codigo_hash then
    v_tentativas:=v_codigo.tentativas+1; update public.codigos_entrega set tentativas=v_tentativas,bloqueado_em=case when v_tentativas>=v_codigo.max_tentativas then v_agora else null end,atualizado_por=auth.uid() where id=v_codigo.id;
    insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(v_encomenda.id,'tentativa_entrega_falhou','chegou_destino','chegou_destino','entregador',auth.uid(),jsonb_build_object('atribuicao_id',v_atribuicao.id,'tentativas',v_tentativas));
    validado:=false;estado_encomenda:=v_encomenda.estado;tentativas_restantes:=greatest(v_codigo.max_tentativas-v_tentativas,0);bloqueado:=v_tentativas>=v_codigo.max_tentativas;motivo:=case when v_tentativas>=v_codigo.max_tentativas then 'Este código de entrega ficou bloqueado. O comprador deve renová-lo.' else 'Código de entrega inválido.' end;return next;return;
  end if;
  update public.codigos_entrega set usado_em=v_agora,atualizado_por=auth.uid() where id=v_codigo.id;
  update public.atribuicoes_entrega_encomenda set estado='concluida',concluido_em=v_agora where id=v_atribuicao.id;
  update public.encomendas set estado='concluida',concluido_em=v_agora where id=v_encomenda.id;
  insert into public.eventos_encomenda(encomenda_id,tipo_evento,estado_anterior,estado_novo,ator_tipo,utilizador_id,metadados) values(v_encomenda.id,'entrega_confirmada','chegou_destino','concluida','entregador',auth.uid(),jsonb_build_object('atribuicao_id',v_atribuicao.id));
  validado:=true;estado_encomenda:='concluida';tentativas_restantes:=v_codigo.max_tentativas-v_codigo.tentativas;bloqueado:=false;motivo:=null;return next;
end;
$_$;


ALTER FUNCTION "public"."validar_codigo_entrega_entregador"("p_atribuicao_id" "uuid", "p_codigo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_codigo_levantamento_vendedor"("p_encomenda_id" "uuid", "p_codigo" "text") RETURNS TABLE("validado" boolean, "estado_encomenda" "text", "tentativas_restantes" smallint, "bloqueado" boolean, "motivo" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_encomenda public.encomendas%rowtype;
  v_codigo public.codigos_levantamento%rowtype;
  v_pagamento public.pagamentos%rowtype;
  v_tentativa public.tentativas_pagamento%rowtype;
  v_codigo_apresentado text := nullif(btrim(p_codigo), '');
  v_agora timestamptz := now();
  v_tentativas smallint;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão novamente.';
  end if;
  if v_codigo_apresentado is null or v_codigo_apresentado !~ '^[0-9]{6}$' then
    raise exception 'Introduza o código de levantamento de seis dígitos.';
  end if;

  select * into v_encomenda
  from public.encomendas
  where id = p_encomenda_id
  for update;
  if not found then
    raise exception 'Encomenda não encontrada.';
  end if;
  if not exists (
    select 1 from public.vendedores v
    where v.id = v_encomenda.vendedor_id
      and v.user_id = auth.uid()
      and public.vendedor_pode_receber_encomendas(v.id)
  ) then
    raise exception 'Sem permissão para validar o levantamento desta encomenda.';
  end if;

  select * into v_codigo
  from public.codigos_levantamento
  where encomenda_id = v_encomenda.id
  for update;
  if not found then
    validado := false; estado_encomenda := v_encomenda.estado;
    tentativas_restantes := 0; bloqueado := false;
    motivo := 'Não existe código de levantamento ativo para esta encomenda.';
    return next; return;
  end if;

  select * into v_pagamento
  from public.pagamentos
  where encomenda_id = v_encomenda.id
  for update;

  -- Retry seguro: só reconhece como sucesso a repetição do mesmo OTP depois
  -- de todos os efeitos autoritativos já terem sido concluídos.
  if v_encomenda.estado = 'concluida'
    and v_codigo.usado_em is not null
    and found
    and v_pagamento.estado = 'confirmado' then
    if extensions.crypt(v_codigo_apresentado, v_codigo.codigo_hash) = v_codigo.codigo_hash then
      validado := true; estado_encomenda := 'concluida';
      tentativas_restantes := greatest(v_codigo.max_tentativas - v_codigo.tentativas, 0)::smallint;
      bloqueado := false; motivo := null;
      return next; return;
    end if;
    validado := false; estado_encomenda := 'concluida';
    tentativas_restantes := 0; bloqueado := false;
    motivo := 'Este código de levantamento já foi utilizado.';
    return next; return;
  end if;

  if v_encomenda.estado <> 'pronta_para_levantamento' then
    raise exception 'Esta encomenda não está pronta para levantamento.';
  end if;
  if v_codigo.usado_em is not null then
    validado := false; estado_encomenda := v_encomenda.estado;
    tentativas_restantes := 0; bloqueado := false;
    motivo := 'Este código de levantamento já foi utilizado.';
    return next; return;
  end if;
  if v_codigo.bloqueado_em is not null or v_codigo.tentativas >= v_codigo.max_tentativas then
    validado := false; estado_encomenda := v_encomenda.estado;
    tentativas_restantes := 0; bloqueado := true;
    motivo := 'Este código de levantamento está bloqueado. O cliente deve renová-lo.';
    return next; return;
  end if;
  if v_codigo.expira_em <= v_agora then
    validado := false; estado_encomenda := v_encomenda.estado;
    tentativas_restantes := greatest(v_codigo.max_tentativas - v_codigo.tentativas, 0)::smallint;
    bloqueado := false;
    motivo := 'Este código de levantamento expirou. O cliente deve renová-lo.';
    return next; return;
  end if;
  if extensions.crypt(v_codigo_apresentado, v_codigo.codigo_hash) <> v_codigo.codigo_hash then
    v_tentativas := v_codigo.tentativas + 1;
    update public.codigos_levantamento
    set tentativas = v_tentativas,
        bloqueado_em = case when v_tentativas >= v_codigo.max_tentativas then v_agora else null end,
        atualizado_por = auth.uid()
    where id = v_codigo.id;
    insert into public.eventos_encomenda (
      encomenda_id, tipo_evento, estado_anterior, estado_novo,
      ator_tipo, utilizador_id, metadados
    ) values (
      v_encomenda.id, 'tentativa_levantamento_falhou',
      'pronta_para_levantamento', 'pronta_para_levantamento',
      'vendedor', auth.uid(), jsonb_build_object(
        'tentativas', v_tentativas,
        'bloqueado', v_tentativas >= v_codigo.max_tentativas
      )
    );
    validado := false; estado_encomenda := v_encomenda.estado;
    tentativas_restantes := greatest(v_codigo.max_tentativas - v_tentativas, 0)::smallint;
    bloqueado := v_tentativas >= v_codigo.max_tentativas;
    motivo := case when bloqueado then
      'Código incorreto. O limite de tentativas foi atingido e o código foi bloqueado.'
    else 'Código de levantamento incorreto.' end;
    return next; return;
  end if;

  if not found then
    raise exception 'Não existe pagamento preparado para esta encomenda.';
  end if;
  if v_pagamento.estado <> 'confirmado' then
    select * into v_tentativa
    from public.tentativas_pagamento
    where pagamento_id = v_pagamento.id
      and metodo = 'pagamento_no_levantamento'
    order by criado_em desc, id desc
    limit 1
    for update;
    if not found or v_pagamento.estado <> 'pendente' or v_tentativa.estado not in ('criada', 'pendente') then
      raise exception 'O pagamento no levantamento não pode ser confirmado no estado atual.';
    end if;

    update public.tentativas_pagamento
    set estado = 'confirmada', confirmado_em = v_agora,
        metadados = metadados || jsonb_build_object('confirmado_no_levantamento_por', auth.uid())
    where id = v_tentativa.id;
    update public.pagamentos
    set estado = 'confirmado', confirmado_em = v_agora
    where id = v_pagamento.id
    returning * into v_pagamento;
    insert into public.eventos_pagamento (
      pagamento_id, tentativa_pagamento_id, encomenda_id, tipo_evento,
      estado_anterior, estado_novo, ator_tipo, utilizador_id, metadados
    ) values (
      v_pagamento.id, v_tentativa.id, v_encomenda.id, 'pagamento_confirmado',
      'pendente', 'confirmado', 'vendedor', auth.uid(),
      jsonb_build_object('metodo', 'pagamento_no_levantamento', 'origem', 'validacao_otp_levantamento')
    );
  end if;

  update public.codigos_levantamento
  set usado_em = v_agora, atualizado_por = auth.uid()
  where id = v_codigo.id;
  update public.encomendas
  set estado = 'concluida', concluido_em = v_agora
  where id = v_encomenda.id
  returning * into v_encomenda;
  insert into public.eventos_encomenda (
    encomenda_id, tipo_evento, estado_anterior, estado_novo,
    ator_tipo, utilizador_id, metadados
  ) values (
    v_encomenda.id, 'levantamento_confirmado',
    'pronta_para_levantamento', 'concluida',
    'vendedor', auth.uid(), jsonb_build_object('pagamento_confirmado', true)
  );

  validado := true; estado_encomenda := 'concluida';
  tentativas_restantes := greatest(v_codigo.max_tentativas - v_codigo.tentativas, 0)::smallint;
  bloqueado := false; motivo := null;
  return next;
end;
$_$;


ALTER FUNCTION "public"."validar_codigo_levantamento_vendedor"("p_encomenda_id" "uuid", "p_codigo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_compra_produto_alheio"("p_itens" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida. Inicie sessão antes de criar a encomenda.';
  end if;

  if jsonb_typeof(p_itens) = 'array' and exists (
    select 1
    from jsonb_array_elements(p_itens) item
    join public.produtos produto
      on produto.id = (item ->> 'produto_id')::uuid
    join public.vendedores vendedor
      on vendedor.id = produto.vendedor_id
    where vendedor.user_id = auth.uid()
  ) then
    raise exception 'Não podes comprar produtos da tua própria loja.';
  end if;
end;
$$;


ALTER FUNCTION "public"."validar_compra_produto_alheio"("p_itens" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_integridade_destino_entrega_encomenda"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_encomenda_id uuid;
  v_modalidade text;
  v_tem_destino boolean;
begin
  if tg_table_schema = 'public' and tg_table_name = 'encomendas' then
    if tg_op = 'DELETE' then
      v_encomenda_id := old.id;
    else
      v_encomenda_id := new.id;
    end if;
  elsif tg_table_schema = 'public' and tg_table_name = 'enderecos_entrega_encomenda' then
    if tg_op = 'DELETE' then
      v_encomenda_id := old.encomenda_id;
    else
      v_encomenda_id := new.encomenda_id;
    end if;
  else
    raise exception 'Trigger de destino de entrega invocado por tabela inesperada: %.%', tg_table_schema, tg_table_name;
  end if;

  select e.modalidade_recebimento
    into v_modalidade
  from public.encomendas e
  where e.id = v_encomenda_id;

  if not found then
    return null;
  end if;

  select exists (
    select 1
    from public.enderecos_entrega_encomenda d
    where d.encomenda_id = v_encomenda_id
  ) into v_tem_destino;

  if v_modalidade = 'entrega' and not v_tem_destino then
    raise exception 'Uma encomenda de entrega exige um destino completo.';
  end if;

  if v_modalidade = 'levantamento' and v_tem_destino then
    raise exception 'Uma encomenda de levantamento não pode ter destino de entrega.';
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."validar_integridade_destino_entrega_encomenda"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_limites_reembolso_pagamento"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_pagamento public.pagamentos%rowtype;
  v_total_aprovado bigint;
  v_produtos_aprovados bigint;
  v_entrega_aprovada bigint;
  v_taxa_aprovada bigint;
begin
  select * into v_pagamento from public.pagamentos where id = new.pagamento_id for update;
  if not found then raise exception 'Pagamento não encontrado para o reembolso.'; end if;
  if new.encomenda_id <> v_pagamento.encomenda_id then raise exception 'O reembolso deve pertencer à encomenda do pagamento.'; end if;
  if new.valor_solicitado_centimos > v_pagamento.total_cliente_centimos
    or new.valor_produtos_solicitado_centimos > v_pagamento.subtotal_centimos - v_pagamento.desconto_centimos
    or new.valor_entrega_solicitado_centimos > v_pagamento.entrega_centimos
    or new.valor_taxa_processador_solicitado_centimos > v_pagamento.taxa_processador_centimos then
    raise exception 'O reembolso solicitado não pode exceder os valores da obrigação financeira.';
  end if;

  if new.estado in ('aprovado', 'processando', 'concluido') then
    if v_pagamento.estado not in ('confirmado', 'reembolsado_parcialmente', 'reembolsado') then
      raise exception 'Só é possível aprovar reembolso de pagamento confirmado.';
    end if;

    select
      coalesce(sum(valor_aprovado_centimos), 0),
      coalesce(sum(valor_produtos_aprovado_centimos), 0),
      coalesce(sum(valor_entrega_aprovado_centimos), 0),
      coalesce(sum(valor_taxa_processador_aprovado_centimos), 0)
    into v_total_aprovado, v_produtos_aprovados, v_entrega_aprovada, v_taxa_aprovada
    from public.reembolsos_pagamento
    where pagamento_id = new.pagamento_id
      and id is distinct from new.id
      and estado in ('aprovado', 'processando', 'concluido');

    if v_total_aprovado + new.valor_aprovado_centimos > v_pagamento.total_cliente_centimos
      or v_produtos_aprovados + new.valor_produtos_aprovado_centimos > v_pagamento.subtotal_centimos - v_pagamento.desconto_centimos
      or v_entrega_aprovada + new.valor_entrega_aprovado_centimos > v_pagamento.entrega_centimos
      or v_taxa_aprovada + new.valor_taxa_processador_aprovado_centimos > v_pagamento.taxa_processador_centimos then
      raise exception 'Os reembolsos aprovados não podem exceder os valores efetivamente pagos.';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."validar_limites_reembolso_pagamento"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_motivo_rejeicao_vendedor"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.status_aprovacao = 'rejeitado'
     and coalesce(btrim(new.motivo_rejeicao), '') = '' then
    raise exception 'É obrigatório indicar o motivo da rejeição';
  end if;

  if new.status_aprovacao is distinct from 'rejeitado' then
    new.motivo_rejeicao := null;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validar_motivo_rejeicao_vendedor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_referencias_movimento_financeiro"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_pagamento public.pagamentos%rowtype;
begin
  if new.pagamento_id is null then
    return new;
  end if;

  select * into v_pagamento from public.pagamentos where id = new.pagamento_id;
  if not found then
    raise exception 'Pagamento não encontrado para o movimento financeiro.';
  end if;
  if new.encomenda_id <> v_pagamento.encomenda_id then
    raise exception 'A encomenda do movimento deve corresponder à encomenda do pagamento.';
  end if;
  if new.vendedor_id is not null and new.vendedor_id <> v_pagamento.vendedor_id then
    raise exception 'O vendedor do movimento deve corresponder ao vendedor do pagamento.';
  end if;
  if new.cliente_id is not null and new.cliente_id <> v_pagamento.cliente_id then
    raise exception 'O cliente do movimento deve corresponder ao cliente do pagamento.';
  end if;

  new.vendedor_id := v_pagamento.vendedor_id;
  new.cliente_id := v_pagamento.cliente_id;
  return new;
end;
$$;


ALTER FUNCTION "public"."validar_referencias_movimento_financeiro"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_veiculo_da_atribuicao_entrega"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if not exists (
    select 1 from public.veiculos_entrega v
    where v.id = new.veiculo_id and v.parceiro_id = new.parceiro_entrega_id
  ) then
    raise exception 'O veículo indicado não pertence ao parceiro de entrega.';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."validar_veiculo_da_atribuicao_entrega"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_veiculo_do_documento_parceiro"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.veiculo_id is not null and not exists (
    select 1 from public.veiculos_entrega v
    where v.id = new.veiculo_id and v.parceiro_id = new.parceiro_id
  ) then
    raise exception 'O veículo indicado não pertence ao parceiro';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."validar_veiculo_do_documento_parceiro"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_vendedor_elegivel_em_encomenda"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.vendedor_pode_receber_encomendas(new.vendedor_id) then
    raise exception 'O vendedor deste produto não está elegível para receber encomendas.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validar_vendedor_elegivel_em_encomenda"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."veiculo_compativel_com_encomenda"("p_veiculo_id" "uuid", "p_encomenda_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select a.estado = 'compativel'
  from public.avaliar_compatibilidade_veiculo_encomenda(p_veiculo_id, p_encomenda_id) a;
$$;


ALTER FUNCTION "public"."veiculo_compativel_com_encomenda"("p_veiculo_id" "uuid", "p_encomenda_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."veiculo_operacional_para_entregas"("p_veiculo_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select cardinality(public.motivos_operacionais_veiculo_entrega(p_veiculo_id)) = 0;
$$;


ALTER FUNCTION "public"."veiculo_operacional_para_entregas"("p_veiculo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."veiculo_pode_receber_entregas"("p_veiculo_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.veiculo_operacional_para_entregas(p_veiculo_id);
$$;


ALTER FUNCTION "public"."veiculo_pode_receber_entregas"("p_veiculo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vendedor_pode_receber_encomendas"("p_vendedor_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.vendedores v
    join auth.users u on u.id = v.user_id
    join public.profiles p on p.id = v.user_id
    where v.id = p_vendedor_id
      and v.status_aprovacao = 'aprovado'
      and coalesce(v.conta_ativa, false) = true
      and p.papel = 'vendedor'
      and coalesce(p.ativo, true) = true
      and p.apagado_em is null
  );
$$;


ALTER FUNCTION "public"."vendedor_pode_receber_encomendas"("p_vendedor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verificar_disponibilidade_cadastro"("p_telefone" "text", "p_email" "text" DEFAULT NULL::"text") RETURNS TABLE("telefone_existe" boolean, "email_existe" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1 from public.clientes c where c.telefone=p_telefone
      union all
      select 1 from public.vendedores v where v.telefone_whatsapp=p_telefone
      union all
      select 1 from public.parceiros_entrega p where p.telefone=p_telefone
    ),
    case when nullif(btrim(p_email),'') is null then false else exists (
      select 1 from public.clientes c where lower(c.email)=lower(btrim(p_email)) or lower(c.email_login)=lower(btrim(p_email))
      union all
      select 1 from public.vendedores v where lower(v.email)=lower(btrim(p_email)) or lower(v.email_login)=lower(btrim(p_email))
      union all
      select 1 from public.parceiros_entrega p where lower(p.email)=lower(btrim(p_email))
    ) end
$$;


ALTER FUNCTION "public"."verificar_disponibilidade_cadastro"("p_telefone" "text", "p_email" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."administradores" (
    "user_id" "uuid" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."administradores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auditoria_administrativa" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "entidade_tipo" "text" NOT NULL,
    "entidade_id" "uuid" NOT NULL,
    "acao" "text" NOT NULL,
    "estado_anterior" "text",
    "estado_novo" "text" NOT NULL,
    "motivo" "text",
    "metadados" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "auditoria_administrativa_acao_check" CHECK (("acao" = ANY (ARRAY['disputa_assumida'::"text", 'disputa_resolvida_sem_reembolso'::"text", 'disputa_resolvida_reembolso_parcial'::"text", 'disputa_resolvida_reembolso_total'::"text"]))),
    CONSTRAINT "auditoria_administrativa_entidade_tipo_check" CHECK (("entidade_tipo" = ANY (ARRAY['disputa'::"text", 'reembolso'::"text"])))
);


ALTER TABLE "public"."auditoria_administrativa" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categorias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL
);


ALTER TABLE "public"."categorias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."codigos_entrega" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "encomenda_id" "uuid" NOT NULL,
    "codigo_hash" "text" NOT NULL,
    "expira_em" timestamp with time zone NOT NULL,
    "tentativas" smallint DEFAULT 0 NOT NULL,
    "max_tentativas" smallint DEFAULT 5 NOT NULL,
    "bloqueado_em" timestamp with time zone,
    "usado_em" timestamp with time zone,
    "geracoes" smallint DEFAULT 1 NOT NULL,
    "criado_por" "uuid" NOT NULL,
    "atualizado_por" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "gerado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "codigos_entrega_bloqueio_consistente" CHECK ((("bloqueado_em" IS NULL) OR ("tentativas" >= "max_tentativas"))),
    CONSTRAINT "codigos_entrega_geracoes_check" CHECK ((("geracoes" >= 1) AND ("geracoes" <= 3))),
    CONSTRAINT "codigos_entrega_max_tentativas_check" CHECK ((("max_tentativas" >= 1) AND ("max_tentativas" <= 10))),
    CONSTRAINT "codigos_entrega_tentativas_check" CHECK (("tentativas" >= 0)),
    CONSTRAINT "codigos_entrega_uso_consistente" CHECK ((("usado_em" IS NULL) OR ("usado_em" >= "criado_em")))
);


ALTER TABLE "public"."codigos_entrega" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."codigos_levantamento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "encomenda_id" "uuid" NOT NULL,
    "codigo_hash" "text" NOT NULL,
    "expira_em" timestamp with time zone NOT NULL,
    "tentativas" smallint DEFAULT 0 NOT NULL,
    "max_tentativas" smallint DEFAULT 5 NOT NULL,
    "bloqueado_em" timestamp with time zone,
    "usado_em" timestamp with time zone,
    "geracoes" smallint DEFAULT 1 NOT NULL,
    "criado_por" "uuid" NOT NULL,
    "atualizado_por" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "gerado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "codigos_levantamento_bloqueio_consistente" CHECK ((("bloqueado_em" IS NULL) OR ("tentativas" >= "max_tentativas"))),
    CONSTRAINT "codigos_levantamento_geracoes_check" CHECK ((("geracoes" >= 1) AND ("geracoes" <= 3))),
    CONSTRAINT "codigos_levantamento_max_tentativas_check" CHECK ((("max_tentativas" >= 1) AND ("max_tentativas" <= 10))),
    CONSTRAINT "codigos_levantamento_tentativas_check" CHECK (("tentativas" >= 0)),
    CONSTRAINT "codigos_levantamento_uso_consistente" CHECK ((("usado_em" IS NULL) OR ("usado_em" >= "criado_em")))
);


ALTER TABLE "public"."codigos_levantamento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracoes_financeiras" (
    "chave" "text" NOT NULL,
    "comissao_bps" integer DEFAULT 0 NOT NULL,
    "prazo_repasse_horas" integer DEFAULT 0 NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "prazo_reclamacao_horas" integer DEFAULT 168 NOT NULL,
    CONSTRAINT "configuracoes_financeiras_comissao_bps_check" CHECK ((("comissao_bps" >= 0) AND ("comissao_bps" <= 10000))),
    CONSTRAINT "configuracoes_financeiras_prazo_reclamacao_horas_check" CHECK (("prazo_reclamacao_horas" >= 0)),
    CONSTRAINT "configuracoes_financeiras_prazo_repasse_horas_check" CHECK (("prazo_repasse_horas" >= 0))
);


ALTER TABLE "public"."configuracoes_financeiras" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documentos_parceiro_entrega" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parceiro_id" "uuid" NOT NULL,
    "veiculo_id" "uuid",
    "tipo_documento" "text" NOT NULL,
    "numero_documento" "text",
    "validade" "date",
    "frente_path" "text" NOT NULL,
    "verso_path" "text" NOT NULL,
    "estado" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "motivo_rejeicao" "text",
    "analisado_por" "uuid",
    "analisado_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "versao_atual_id" "uuid",
    CONSTRAINT "documentos_parceiro_entrega_estado_check" CHECK (("estado" = ANY (ARRAY['pendente'::"text", 'aprovado'::"text", 'rejeitado'::"text", 'expirado'::"text"]))),
    CONSTRAINT "documentos_parceiro_entrega_tipo_documento_check" CHECK (("tipo_documento" = ANY (ARRAY['bi'::"text", 'carta_conducao'::"text", 'livrete_veiculo'::"text", 'seguro_automovel'::"text", 'inspecao_tecnica'::"text", 'licenca_transporte_mercadorias'::"text", 'nif'::"text", 'certidao_comercial'::"text", 'alvara_comercial'::"text"])))
);


ALTER TABLE "public"."documentos_parceiro_entrega" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documentos_vendedor" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendedor_id" "uuid" NOT NULL,
    "tipo_documento" "text" NOT NULL,
    "frente_path" "text" NOT NULL,
    "verso_path" "text",
    "numero_documento" "text",
    "validade" "date",
    "dados_adicionais" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "obrigatorio_para_aprovacao" boolean DEFAULT false NOT NULL,
    "estado" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "motivo_rejeicao" "text",
    "analisado_por" "uuid",
    "analisado_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "documentos_vendedor_estado_check" CHECK (("estado" = ANY (ARRAY['pendente'::"text", 'em_analise'::"text", 'aprovado'::"text", 'rejeitado'::"text", 'expirado'::"text"]))),
    CONSTRAINT "documentos_vendedor_tipo_documento_check" CHECK (("tipo_documento" = ANY (ARRAY['bi'::"text", 'nif'::"text", 'alvara'::"text", 'registo_comercial'::"text", 'cartao_vendedor'::"text", 'comprovativo_banca'::"text", 'carta_conducao'::"text", 'certificado_moto_taxi'::"text", 'livrete_veiculo'::"text", 'seguro_automovel'::"text", 'titulo_terra'::"text"])))
);

ALTER TABLE ONLY "public"."documentos_vendedor" REPLICA IDENTITY FULL;


ALTER TABLE "public"."documentos_vendedor" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documentos_vendedor_eventos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "documento_id" "uuid" NOT NULL,
    "vendedor_id" "uuid" NOT NULL,
    "evento" "text" NOT NULL,
    "estado_anterior" "text",
    "estado_novo" "text",
    "motivo_rejeicao" "text",
    "detalhes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "realizado_por" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "documentos_vendedor_eventos_evento_check" CHECK (("evento" = ANY (ARRAY['criado'::"text", 'atualizado'::"text", 'reenviado'::"text", 'analisado'::"text"])))
);


ALTER TABLE "public"."documentos_vendedor_eventos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enderecos_entrega_encomenda" (
    "encomenda_id" "uuid" NOT NULL,
    "destinatario_nome" "text" NOT NULL,
    "destinatario_telefone" "text" NOT NULL,
    "provincia" "text" NOT NULL,
    "municipio" "text" NOT NULL,
    "bairro" "text" NOT NULL,
    "endereco_detalhado" "text" NOT NULL,
    "ponto_referencia" "text",
    "instrucoes_entrega" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "endereco_entrega_bairro_valido" CHECK ((("char_length"("btrim"("bairro")) >= 2) AND ("char_length"("btrim"("bairro")) <= 160))),
    CONSTRAINT "endereco_entrega_detalhado_valido" CHECK ((("char_length"("btrim"("endereco_detalhado")) >= 3) AND ("char_length"("btrim"("endereco_detalhado")) <= 500))),
    CONSTRAINT "endereco_entrega_instrucoes_validas" CHECK ((("instrucoes_entrega" IS NULL) OR ("char_length"("btrim"("instrucoes_entrega")) <= 1000))),
    CONSTRAINT "endereco_entrega_municipio_valido" CHECK ((("char_length"("btrim"("municipio")) >= 2) AND ("char_length"("btrim"("municipio")) <= 120))),
    CONSTRAINT "endereco_entrega_nome_valido" CHECK ((("char_length"("btrim"("destinatario_nome")) >= 2) AND ("char_length"("btrim"("destinatario_nome")) <= 160))),
    CONSTRAINT "endereco_entrega_provincia_valida" CHECK ((("char_length"("btrim"("provincia")) >= 2) AND ("char_length"("btrim"("provincia")) <= 120))),
    CONSTRAINT "endereco_entrega_referencia_valida" CHECK ((("ponto_referencia" IS NULL) OR ("char_length"("btrim"("ponto_referencia")) <= 500))),
    CONSTRAINT "endereco_entrega_telefone_valido" CHECK ((("char_length"("btrim"("destinatario_telefone")) >= 6) AND ("char_length"("btrim"("destinatario_telefone")) <= 30)))
);


ALTER TABLE "public"."enderecos_entrega_encomenda" OWNER TO "postgres";


COMMENT ON TABLE "public"."enderecos_entrega_encomenda" IS 'Snapshot imutável do destino de uma encomenda de entrega; a origem permanece no snapshot comercial do vendedor.';



CREATE TABLE IF NOT EXISTS "public"."eventos_documento_parceiro_entrega" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "documento_id" "uuid" NOT NULL,
    "versao_id" "uuid",
    "parceiro_id" "uuid" NOT NULL,
    "ator_tipo" "text" NOT NULL,
    "utilizador_id" "uuid",
    "evento" "text" NOT NULL,
    "estado_anterior" "text",
    "estado_novo" "text",
    "motivo" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "eventos_documento_parceiro_entrega_ator_tipo_check" CHECK (("ator_tipo" = ANY (ARRAY['parceiro'::"text", 'admin'::"text", 'sistema'::"text"]))),
    CONSTRAINT "eventos_documento_parceiro_entrega_evento_check" CHECK (("evento" = ANY (ARRAY['enviado'::"text", 'submetido'::"text", 'aprovado'::"text", 'rejeitado'::"text", 'expirado'::"text", 'reenviado'::"text", 'substituido'::"text"])))
);


ALTER TABLE "public"."eventos_documento_parceiro_entrega" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."eventos_encomenda" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "encomenda_id" "uuid" NOT NULL,
    "tipo_evento" "text" NOT NULL,
    "estado_anterior" "text",
    "estado_novo" "text" NOT NULL,
    "ator_tipo" "text" NOT NULL,
    "utilizador_id" "uuid",
    "metadados" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "eventos_encomenda_ator_tipo_check" CHECK (("ator_tipo" = ANY (ARRAY['cliente'::"text", 'vendedor'::"text", 'admin'::"text", 'sistema'::"text", 'entregador'::"text"]))),
    CONSTRAINT "eventos_encomenda_tipo_evento_check" CHECK (("tipo_evento" = ANY (ARRAY['encomenda_criada'::"text", 'vendedor_confirmou'::"text", 'vendedor_recusou'::"text", 'preparacao_iniciada'::"text", 'pronta_para_levantamento'::"text", 'levantamento_confirmado'::"text", 'encomenda_concluida'::"text", 'cliente_cancelou'::"text", 'codigo_levantamento_gerado'::"text", 'codigo_levantamento_regenerado'::"text", 'tentativa_levantamento_falhou'::"text", 'problema_reportado'::"text", 'entregador_atribuido'::"text", 'entregador_aceitou'::"text", 'entregador_recusou'::"text", 'entregador_chegou_origem'::"text", 'encomenda_recolhida'::"text", 'entregador_chegou_destino'::"text", 'codigo_entrega_gerado'::"text", 'codigo_entrega_regenerado'::"text", 'tentativa_entrega_falhou'::"text", 'entrega_confirmada'::"text", 'atribuicao_liberada_admin'::"text", 'incidente_operacional_aberto'::"text", 'incidente_operacional_resolvido'::"text"])))
);

ALTER TABLE ONLY "public"."eventos_encomenda" REPLICA IDENTITY FULL;


ALTER TABLE "public"."eventos_encomenda" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."eventos_pagamento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pagamento_id" "uuid" NOT NULL,
    "tentativa_pagamento_id" "uuid",
    "encomenda_id" "uuid" NOT NULL,
    "tipo_evento" "text" NOT NULL,
    "estado_anterior" "text",
    "estado_novo" "text" NOT NULL,
    "ator_tipo" "text" NOT NULL,
    "utilizador_id" "uuid",
    "metadados" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "eventos_pagamento_ator_tipo_check" CHECK (("ator_tipo" = ANY (ARRAY['cliente'::"text", 'vendedor'::"text", 'admin'::"text", 'sistema'::"text", 'provedor'::"text", 'entregador'::"text"]))),
    CONSTRAINT "eventos_pagamento_tipo_evento_check" CHECK (("tipo_evento" = ANY (ARRAY['pagamento_criado'::"text", 'tentativa_criada'::"text", 'tentativa_iniciada'::"text", 'pagamento_confirmado'::"text", 'pagamento_falhou'::"text", 'pagamento_expirou'::"text", 'pagamento_cancelado'::"text", 'reembolso_parcial'::"text", 'reembolso_total'::"text", 'repasse_criado'::"text", 'repasse_disponivel'::"text", 'repasse_processando'::"text", 'repasse_concluido'::"text", 'repasse_falhou'::"text", 'repasse_cancelado'::"text"])))
);


ALTER TABLE "public"."eventos_pagamento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favoritos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "utilizador_id" "uuid" NOT NULL,
    "produto_id" "uuid",
    "servico_id" "uuid",
    "vendedor_id" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."favoritos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historico_contactos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid",
    "produto_id" "uuid",
    "vendedor_id" "uuid",
    "nome_produto" "text",
    "nome_vendedor" "text",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "atualizado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."historico_contactos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historico_contactos_servicos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid",
    "servico_id" "uuid",
    "vendedor_id" "uuid",
    "nome_servico" "text",
    "nome_prestador" "text",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "atualizado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."historico_contactos_servicos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historico_pesquisas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid",
    "termo" "text",
    "categoria_id" "uuid",
    "provincia" "text",
    "municipio" "text",
    "tipo_comprador" "text",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "historico_pesquisas_tipo_comprador_check" CHECK (("tipo_comprador" = ANY (ARRAY['casa'::"text", 'negocio'::"text"])))
);


ALTER TABLE "public"."historico_pesquisas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."idempotencia_checkout_encomenda" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "modalidade_recebimento" "text" NOT NULL,
    "chave_idempotencia" "uuid" NOT NULL,
    "payload_hash" "text" NOT NULL,
    "encomenda_id" "uuid",
    "criada_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "concluida_em" timestamp with time zone,
    CONSTRAINT "idempotencia_checkout_conclusao_consistente" CHECK ((("encomenda_id" IS NULL) = ("concluida_em" IS NULL))),
    CONSTRAINT "idempotencia_checkout_encomenda_modalidade_recebimento_check" CHECK (("modalidade_recebimento" = ANY (ARRAY['levantamento'::"text", 'entrega'::"text"]))),
    CONSTRAINT "idempotencia_checkout_encomenda_payload_hash_check" CHECK (("payload_hash" ~ '^[0-9a-f]{64}$'::"text"))
);


ALTER TABLE "public"."idempotencia_checkout_encomenda" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."idempotencia_intervencao_entrega_admin" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "administrador_id" "uuid" NOT NULL,
    "operacao" "text" NOT NULL,
    "chave_idempotencia" "uuid" NOT NULL,
    "payload_hash" "text" NOT NULL,
    "atribuicao_id" "uuid",
    "incidente_id" "uuid",
    "criada_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "concluida_em" timestamp with time zone,
    CONSTRAINT "idempotencia_intervencao_entrega_admin_operacao_check" CHECK (("operacao" = ANY (ARRAY['libertar_atribuicao'::"text", 'abrir_incidente'::"text", 'resolver_incidente'::"text"]))),
    CONSTRAINT "idempotencia_intervencao_entrega_admin_payload_hash_check" CHECK (("payload_hash" ~ '^[0-9a-f]{64}$'::"text"))
);


ALTER TABLE "public"."idempotencia_intervencao_entrega_admin" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."itens_encomenda" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "encomenda_id" "uuid" NOT NULL,
    "produto_id" "uuid",
    "vendedor_id" "uuid" NOT NULL,
    "quantidade" numeric(14,3) NOT NULL,
    "unidade" "text" NOT NULL,
    "tipo_preco_snapshot" "text" NOT NULL,
    "valor_unitario_centimos" bigint NOT NULL,
    "subtotal_centimos" bigint NOT NULL,
    "nome_produto_snapshot" "text" NOT NULL,
    "descricao_snapshot" "text",
    "imagem_principal_snapshot" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "peso_por_unidade_comercial_kg_snapshot" numeric(14,3),
    "volume_por_unidade_comercial_m3_snapshot" numeric(14,6),
    "requer_refrigeracao_snapshot" boolean,
    "requer_caixa_carga_snapshot" boolean,
    "requer_paletes_snapshot" boolean,
    CONSTRAINT "itens_encomenda_kg_sem_peso_snapshot" CHECK ((("lower"("btrim"("unidade")) <> 'kg'::"text") OR ("peso_por_unidade_comercial_kg_snapshot" IS NULL))),
    CONSTRAINT "itens_encomenda_peso_snapshot_positivo" CHECK ((("peso_por_unidade_comercial_kg_snapshot" IS NULL) OR ("peso_por_unidade_comercial_kg_snapshot" > (0)::numeric))),
    CONSTRAINT "itens_encomenda_quantidade_check" CHECK (("quantidade" > (0)::numeric)),
    CONSTRAINT "itens_encomenda_subtotal_centimos_check" CHECK (("subtotal_centimos" >= 0)),
    CONSTRAINT "itens_encomenda_tipo_preco_snapshot_check" CHECK (("tipo_preco_snapshot" = ANY (ARRAY['normal'::"text", 'promocional'::"text", 'grosso'::"text"]))),
    CONSTRAINT "itens_encomenda_valor_unitario_centimos_check" CHECK (("valor_unitario_centimos" >= 0)),
    CONSTRAINT "itens_encomenda_volume_snapshot_positivo" CHECK ((("volume_por_unidade_comercial_m3_snapshot" IS NULL) OR ("volume_por_unidade_comercial_m3_snapshot" > (0)::numeric)))
);


ALTER TABLE "public"."itens_encomenda" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."movimentos_financeiros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pagamento_id" "uuid",
    "encomenda_id" "uuid" NOT NULL,
    "vendedor_id" "uuid",
    "cliente_id" "uuid",
    "tipo_movimento" "text" NOT NULL,
    "direcao" "text" NOT NULL,
    "entidade_debitada" "text" NOT NULL,
    "entidade_creditada" "text" NOT NULL,
    "moeda" character(3) NOT NULL,
    "valor_centimos" bigint NOT NULL,
    "referencia_origem" "text" NOT NULL,
    "chave_idempotencia" "uuid",
    "metadados" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "movimentos_entidades_distintas" CHECK (("entidade_debitada" <> "entidade_creditada")),
    CONSTRAINT "movimentos_financeiros_direcao_check" CHECK (("direcao" = ANY (ARRAY['credito'::"text", 'debito'::"text"]))),
    CONSTRAINT "movimentos_financeiros_entidade_creditada_check" CHECK (("entidade_creditada" = ANY (ARRAY['cliente'::"text", 'vendedor'::"text", 'angrolink'::"text", 'sistema'::"text"]))),
    CONSTRAINT "movimentos_financeiros_entidade_debitada_check" CHECK (("entidade_debitada" = ANY (ARRAY['cliente'::"text", 'vendedor'::"text", 'angrolink'::"text", 'sistema'::"text"]))),
    CONSTRAINT "movimentos_financeiros_moeda_check" CHECK (("moeda" = 'AOA'::"bpchar")),
    CONSTRAINT "movimentos_financeiros_tipo_movimento_check" CHECK (("tipo_movimento" = ANY (ARRAY['venda_registada'::"text", 'comissao_marketplace'::"text", 'reembolso_cliente'::"text", 'estorno_comissao'::"text", 'credito_vendedor'::"text", 'repasse_vendedor'::"text", 'ajuste_credito'::"text", 'ajuste_debito'::"text"]))),
    CONSTRAINT "movimentos_financeiros_valor_centimos_check" CHECK (("valor_centimos" > 0))
);


ALTER TABLE "public"."movimentos_financeiros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."municipios_angola" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provincia_id" "uuid" NOT NULL,
    "codigo_oficial" "text" NOT NULL,
    "numero_oficial" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."municipios_angola" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."produtos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendedor_id" "uuid",
    "nome_produto" "text" NOT NULL,
    "descricao" "text",
    "preco_aproximado" numeric,
    "preco_grosso" numeric,
    "quantidade_minima" integer,
    "quantidade_minima_grosso" integer,
    "unidade" "text",
    "tipo_venda" "text",
    "municipio" "text",
    "provincia" "text",
    "destaque" boolean DEFAULT false,
    "disponivel" boolean DEFAULT true,
    "criado_em" timestamp without time zone DEFAULT "now"(),
    "categoria_id" "uuid",
    "imagem_url" "text",
    "subcategoria" "text",
    "visualizacoes" integer DEFAULT 0,
    "cliques_whatsapp" integer DEFAULT 0,
    "destaque_inicio" timestamp with time zone,
    "destaque_ate" timestamp with time zone,
    "publicado" boolean DEFAULT true,
    "tipo_destaque" "text",
    "atualizado_em" timestamp with time zone,
    "preco_promocional" numeric,
    "peso_por_unidade_comercial_kg" numeric(14,3),
    "volume_por_unidade_comercial_m3" numeric(14,6),
    "requer_refrigeracao" boolean,
    "requer_caixa_carga" boolean,
    "requer_paletes" boolean,
    CONSTRAINT "produtos_kg_sem_peso_unitario_comercial" CHECK ((("lower"("btrim"(COALESCE("unidade", ''::"text"))) <> 'kg'::"text") OR ("peso_por_unidade_comercial_kg" IS NULL))),
    CONSTRAINT "produtos_peso_unidade_comercial_positivo" CHECK ((("peso_por_unidade_comercial_kg" IS NULL) OR ("peso_por_unidade_comercial_kg" > (0)::numeric))),
    CONSTRAINT "produtos_volume_unidade_comercial_positivo" CHECK ((("volume_por_unidade_comercial_m3" IS NULL) OR ("volume_por_unidade_comercial_m3" > (0)::numeric)))
);


ALTER TABLE "public"."produtos" OWNER TO "postgres";


COMMENT ON COLUMN "public"."produtos"."peso_por_unidade_comercial_kg" IS 'Peso físico em kg de uma unidade comercial; null significa desconhecido. Para unidade kg, a quantidade da encomenda é o peso.';



COMMENT ON COLUMN "public"."produtos"."volume_por_unidade_comercial_m3" IS 'Volume físico em m³ de uma unidade comercial; null significa desconhecido e nunca é inferido por peso.';



COMMENT ON COLUMN "public"."produtos"."requer_refrigeracao" IS 'true exige refrigeração; false declara que não exige; null significa requisito ainda desconhecido.';



COMMENT ON COLUMN "public"."produtos"."requer_caixa_carga" IS 'true exige veículo com caixa de carga; false declara que não exige; null significa requisito ainda desconhecido.';



COMMENT ON COLUMN "public"."produtos"."requer_paletes" IS 'true exige veículo que aceite paletes; false declara que não exige; null significa requisito ainda desconhecido.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "nome" "text",
    "email" "text",
    "papel" "text" DEFAULT 'cliente'::"text" NOT NULL,
    "vendedor_id" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "atualizado_em" timestamp with time zone DEFAULT "now"(),
    "ativo" boolean DEFAULT true,
    "apagado_em" timestamp with time zone,
    CONSTRAINT "profiles_papel_check" CHECK (("papel" = ANY (ARRAY['cliente'::"text", 'vendedor'::"text", 'admin'::"text", 'parceiro_entrega'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provincias_angola" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo_oficial" "text" NOT NULL,
    "numero_oficial" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "ordem" integer NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provincias_angola_ordem_check" CHECK (("ordem" > 0))
);


ALTER TABLE "public"."provincias_angola" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reembolsos_pagamento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pagamento_id" "uuid" NOT NULL,
    "encomenda_id" "uuid" NOT NULL,
    "estado" "text" DEFAULT 'solicitado'::"text" NOT NULL,
    "motivo" "text" NOT NULL,
    "valor_solicitado_centimos" bigint NOT NULL,
    "valor_produtos_solicitado_centimos" bigint DEFAULT 0 NOT NULL,
    "valor_entrega_solicitado_centimos" bigint DEFAULT 0 NOT NULL,
    "valor_taxa_processador_solicitado_centimos" bigint DEFAULT 0 NOT NULL,
    "valor_aprovado_centimos" bigint DEFAULT 0 NOT NULL,
    "valor_produtos_aprovado_centimos" bigint DEFAULT 0 NOT NULL,
    "valor_entrega_aprovado_centimos" bigint DEFAULT 0 NOT NULL,
    "valor_taxa_processador_aprovado_centimos" bigint DEFAULT 0 NOT NULL,
    "referencia_interna" "text" NOT NULL,
    "referencia_provedor" "text",
    "chave_idempotencia" "uuid" NOT NULL,
    "solicitado_por" "uuid",
    "aprovado_por" "uuid",
    "solicitado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "aprovado_em" timestamp with time zone,
    "processado_em" timestamp with time zone,
    "concluido_em" timestamp with time zone,
    "recusado_em" timestamp with time zone,
    "cancelado_em" timestamp with time zone,
    "falhado_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reembolsos_aprovacao_nao_supera_solicitacao" CHECK (("valor_aprovado_centimos" <= "valor_solicitado_centimos")),
    CONSTRAINT "reembolsos_entrega_aprovada_nao_supera_solicitada" CHECK (("valor_entrega_aprovado_centimos" <= "valor_entrega_solicitado_centimos")),
    CONSTRAINT "reembolsos_pagamento_estado_check" CHECK (("estado" = ANY (ARRAY['solicitado'::"text", 'em_analise'::"text", 'aprovado'::"text", 'processando'::"text", 'concluido'::"text", 'recusado'::"text", 'cancelado'::"text", 'falhado'::"text"]))),
    CONSTRAINT "reembolsos_pagamento_motivo_check" CHECK ((("char_length"("btrim"("motivo")) >= 3) AND ("char_length"("btrim"("motivo")) <= 500))),
    CONSTRAINT "reembolsos_pagamento_valor_aprovado_centimos_check" CHECK (("valor_aprovado_centimos" >= 0)),
    CONSTRAINT "reembolsos_pagamento_valor_entrega_aprovado_centimos_check" CHECK (("valor_entrega_aprovado_centimos" >= 0)),
    CONSTRAINT "reembolsos_pagamento_valor_entrega_solicitado_centimos_check" CHECK (("valor_entrega_solicitado_centimos" >= 0)),
    CONSTRAINT "reembolsos_pagamento_valor_produtos_aprovado_centimos_check" CHECK (("valor_produtos_aprovado_centimos" >= 0)),
    CONSTRAINT "reembolsos_pagamento_valor_produtos_solicitado_centimos_check" CHECK (("valor_produtos_solicitado_centimos" >= 0)),
    CONSTRAINT "reembolsos_pagamento_valor_solicitado_centimos_check" CHECK (("valor_solicitado_centimos" > 0)),
    CONSTRAINT "reembolsos_pagamento_valor_taxa_processador_aprovado_cent_check" CHECK (("valor_taxa_processador_aprovado_centimos" >= 0)),
    CONSTRAINT "reembolsos_pagamento_valor_taxa_processador_solicitado_ce_check" CHECK (("valor_taxa_processador_solicitado_centimos" >= 0)),
    CONSTRAINT "reembolsos_produtos_aprovados_nao_superam_solicitados" CHECK (("valor_produtos_aprovado_centimos" <= "valor_produtos_solicitado_centimos")),
    CONSTRAINT "reembolsos_taxa_aprovada_nao_supera_solicitada" CHECK (("valor_taxa_processador_aprovado_centimos" <= "valor_taxa_processador_solicitado_centimos")),
    CONSTRAINT "reembolsos_valor_aprovado_por_estado" CHECK (((("estado" = ANY (ARRAY['aprovado'::"text", 'processando'::"text", 'concluido'::"text"])) AND ("valor_aprovado_centimos" > 0) AND ("aprovado_em" IS NOT NULL)) OR (("estado" <> ALL (ARRAY['aprovado'::"text", 'processando'::"text", 'concluido'::"text"])) AND ("valor_aprovado_centimos" = 0)))),
    CONSTRAINT "reembolsos_valores_aprovados_consistentes" CHECK (("valor_aprovado_centimos" = (("valor_produtos_aprovado_centimos" + "valor_entrega_aprovado_centimos") + "valor_taxa_processador_aprovado_centimos"))),
    CONSTRAINT "reembolsos_valores_solicitados_consistentes" CHECK (("valor_solicitado_centimos" = (("valor_produtos_solicitado_centimos" + "valor_entrega_solicitado_centimos") + "valor_taxa_processador_solicitado_centimos")))
);


ALTER TABLE "public"."reembolsos_pagamento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."repasses_vendedor" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendedor_id" "uuid" NOT NULL,
    "pagamento_id" "uuid" NOT NULL,
    "encomenda_id" "uuid" NOT NULL,
    "valor_centimos" bigint NOT NULL,
    "estado" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "referencia" "text",
    "disponivel_em" timestamp with time zone,
    "processado_em" timestamp with time zone,
    "falhado_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "repasses_marcos_estado_consistentes" CHECK (((("estado" <> 'disponivel'::"text") OR ("disponivel_em" IS NOT NULL)) AND (("estado" <> 'concluido'::"text") OR ("processado_em" IS NOT NULL)) AND (("estado" <> 'falhado'::"text") OR ("falhado_em" IS NOT NULL)))),
    CONSTRAINT "repasses_vendedor_estado_check" CHECK (("estado" = ANY (ARRAY['pendente'::"text", 'disponivel'::"text", 'processando'::"text", 'concluido'::"text", 'falhado'::"text", 'cancelado'::"text"]))),
    CONSTRAINT "repasses_vendedor_valor_centimos_check" CHECK (("valor_centimos" >= 0))
);


ALTER TABLE "public"."repasses_vendedor" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."requisitos_documentos_entrega" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "escopo" "text" NOT NULL,
    "tipo_veiculo" "text" NOT NULL,
    "tipo_documento" "text" NOT NULL,
    "validade_obrigatoria" boolean DEFAULT false NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "requisitos_documentos_entrega_escopo_check" CHECK (("escopo" = ANY (ARRAY['pessoal'::"text", 'veiculo'::"text"]))),
    CONSTRAINT "requisitos_documentos_entrega_escopo_veiculo_check" CHECK (((("escopo" = 'pessoal'::"text") AND ("tipo_veiculo" = 'todos'::"text")) OR (("escopo" = 'veiculo'::"text") AND ("tipo_veiculo" <> 'todos'::"text")))),
    CONSTRAINT "requisitos_documentos_entrega_tipo_documento_check" CHECK (("tipo_documento" = ANY (ARRAY['bi'::"text", 'carta_conducao'::"text", 'livrete_veiculo'::"text", 'seguro_automovel'::"text", 'inspecao_tecnica'::"text", 'licenca_transporte_mercadorias'::"text", 'nif'::"text", 'certidao_comercial'::"text", 'alvara_comercial'::"text"]))),
    CONSTRAINT "requisitos_documentos_entrega_tipo_veiculo_check" CHECK (("tipo_veiculo" = ANY (ARRAY['todos'::"text", 'mota'::"text", 'carro'::"text", 'carrinha'::"text", 'camiao'::"text"])))
);


ALTER TABLE "public"."requisitos_documentos_entrega" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."servicos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "vendedor_id" "uuid",
    "nome_servico" "text" NOT NULL,
    "tipo_servico" "text",
    "descricao" "text",
    "preco_estimado" numeric,
    "provincia" "text",
    "municipio" "text",
    "zona_atuacao" "text",
    "imagem_url" "text",
    "disponivel" boolean DEFAULT true,
    "destaque" boolean DEFAULT false,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "nome_prestador" "text",
    "telefone_whatsapp" "text",
    "visualizacoes" integer DEFAULT 0,
    "cliques_whatsapp" integer DEFAULT 0,
    "destaque_inicio" timestamp with time zone,
    "destaque_ate" timestamp with time zone,
    "publicado" boolean DEFAULT true,
    "tipo_destaque" "text",
    "atualizado_em" timestamp with time zone
);


ALTER TABLE "public"."servicos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."veiculos_entrega" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parceiro_id" "uuid" NOT NULL,
    "tipo_veiculo" "text" NOT NULL,
    "marca" "text" NOT NULL,
    "modelo" "text" NOT NULL,
    "cor" "text" NOT NULL,
    "ano" smallint,
    "matricula" "text" NOT NULL,
    "tipo_carrocaria" "text",
    "capacidade_kg" numeric(10,2) NOT NULL,
    "capacidade_volume_m3" numeric(10,3),
    "possui_caixa_carga" boolean DEFAULT false NOT NULL,
    "aceita_paletes" boolean DEFAULT false NOT NULL,
    "possui_refrigeracao" boolean DEFAULT false NOT NULL,
    "foto_veiculo_path" "text",
    "estado_verificacao" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "motivo_rejeicao" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "veiculos_entrega_capacidade_kg_check" CHECK (("capacidade_kg" > (0)::numeric)),
    CONSTRAINT "veiculos_entrega_estado_verificacao_check" CHECK (("estado_verificacao" = ANY (ARRAY['pendente'::"text", 'aprovado'::"text", 'rejeitado'::"text", 'expirado'::"text"]))),
    CONSTRAINT "veiculos_entrega_tipo_veiculo_check" CHECK (("tipo_veiculo" = ANY (ARRAY['mota'::"text", 'carro'::"text", 'carrinha'::"text", 'camiao'::"text"])))
);


ALTER TABLE "public"."veiculos_entrega" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendedores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome_comercial" "text" NOT NULL,
    "descricao" "text",
    "telefone_whatsapp" "text",
    "provincia" "text",
    "municipio" "text",
    "mercado_bairro" "text",
    "tipo_vendedor" "text",
    "plano" "text" DEFAULT 'gratuito'::"text",
    "verificado" boolean DEFAULT false,
    "foto_perfil" "text",
    "criado_em" timestamp without time zone DEFAULT "now"(),
    "bairro" "text",
    "endereco_detalhado" "text",
    "whatsapp" "text",
    "horario_atendimento" "text",
    "ano_inicio" integer,
    "entrega_disponivel" boolean DEFAULT false,
    "tipo_producao" "text",
    "area_cultivada" numeric,
    "principais_culturas" "text",
    "producao_mensal" "text",
    "tipos_produtos" "text",
    "compra_produtores" boolean DEFAULT false,
    "volume_minimo" "text",
    "entrega_outras_provincias" boolean DEFAULT false,
    "tipo_loja" "text",
    "mercado_localizado" "text",
    "venda_presencial" boolean DEFAULT false,
    "venda_grosso" boolean DEFAULT false,
    "venda_retalho" boolean DEFAULT false,
    "data_inicio_atividade" "date",
    "user_id" "uuid",
    "nome_responsavel" "text",
    "email" "text",
    "status_aprovacao" "text" DEFAULT 'pendente'::"text",
    "pode_destacar" boolean DEFAULT false,
    "aprovado_em" timestamp with time zone,
    "aprovado_por" "uuid",
    "atualizado_em" timestamp with time zone DEFAULT "now"(),
    "proximo_destaque_produto_em" timestamp with time zone,
    "proximo_destaque_servico_em" timestamp with time zone,
    "conta_ativa" boolean DEFAULT true,
    "email_login" "text",
    "motivo_rejeicao" "text",
    "documentos" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "indicativo_telefone" "text",
    "telefone_nacional" "text",
    CONSTRAINT "vendedores_status_aprovacao_check" CHECK (("status_aprovacao" = ANY (ARRAY['pendente'::"text", 'aprovado'::"text", 'rejeitado'::"text", 'suspenso'::"text"]))),
    CONSTRAINT "vendedores_tipo_vendedor_check" CHECK ((("tipo_vendedor" IS NULL) OR ("tipo_vendedor" = ANY (ARRAY['ambulante'::"text", 'quitandeira'::"text", 'produtor'::"text", 'revendedor'::"text", 'mini_mercado'::"text", 'supermercado'::"text", 'hipermercado'::"text", 'grossista'::"text", 'prestador_servico'::"text"]))))
);


ALTER TABLE "public"."vendedores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."versoes_documento_parceiro_entrega" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "documento_id" "uuid" NOT NULL,
    "parceiro_id" "uuid" NOT NULL,
    "veiculo_id" "uuid",
    "numero_versao" integer NOT NULL,
    "frente_path" "text" NOT NULL,
    "verso_path" "text" NOT NULL,
    "numero_documento_snapshot" "text",
    "validade_snapshot" "date",
    "estado" "text" NOT NULL,
    "analisado_por" "uuid",
    "analisado_em" timestamp with time zone,
    "motivo_rejeicao" "text",
    "substituido_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "versoes_documento_parceiro_entrega_estado_check" CHECK (("estado" = ANY (ARRAY['pendente'::"text", 'aprovado'::"text", 'rejeitado'::"text", 'expirado'::"text"]))),
    CONSTRAINT "versoes_documento_parceiro_entrega_numero_versao_check" CHECK (("numero_versao" > 0))
);


ALTER TABLE "public"."versoes_documento_parceiro_entrega" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visualizacoes_produtos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid",
    "produto_id" "uuid",
    "vendedor_id" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."visualizacoes_produtos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visualizacoes_servicos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid",
    "servico_id" "uuid",
    "vendedor_id" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."visualizacoes_servicos" OWNER TO "postgres";


ALTER TABLE ONLY "public"."administradores"
    ADD CONSTRAINT "administradores_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."areas_cobertura_entrega"
    ADD CONSTRAINT "areas_cobertura_entrega_parceiro_id_provincia_municipio_bai_key" UNIQUE ("parceiro_id", "provincia", "municipio", "bairro");



ALTER TABLE ONLY "public"."areas_cobertura_entrega"
    ADD CONSTRAINT "areas_cobertura_entrega_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."atribuicoes_entrega_encomenda"
    ADD CONSTRAINT "atribuicoes_entrega_encomenda_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auditoria_administrativa"
    ADD CONSTRAINT "auditoria_administrativa_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_nome_key" UNIQUE ("nome");



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_email_login_unique" UNIQUE ("email_login");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."clientes"
    ADD CONSTRAINT "clientes_telefone_nacional_9" CHECK ((("telefone_nacional" IS NULL) OR ("telefone_nacional" ~ '^[0-9]{9}$'::"text"))) NOT VALID;



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_telefone_unique" UNIQUE ("telefone");



ALTER TABLE ONLY "public"."codigos_entrega"
    ADD CONSTRAINT "codigos_entrega_encomenda_id_key" UNIQUE ("encomenda_id");



ALTER TABLE ONLY "public"."codigos_entrega"
    ADD CONSTRAINT "codigos_entrega_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."codigos_levantamento"
    ADD CONSTRAINT "codigos_levantamento_encomenda_id_key" UNIQUE ("encomenda_id");



ALTER TABLE ONLY "public"."codigos_levantamento"
    ADD CONSTRAINT "codigos_levantamento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracoes_financeiras"
    ADD CONSTRAINT "configuracoes_financeiras_pkey" PRIMARY KEY ("chave");



ALTER TABLE ONLY "public"."disputas_encomenda"
    ADD CONSTRAINT "disputas_encomenda_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documentos_parceiro_entrega"
    ADD CONSTRAINT "documentos_parceiro_entrega_parceiro_id_veiculo_id_tipo_doc_key" UNIQUE ("parceiro_id", "veiculo_id", "tipo_documento");



ALTER TABLE ONLY "public"."documentos_parceiro_entrega"
    ADD CONSTRAINT "documentos_parceiro_entrega_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documentos_vendedor_eventos"
    ADD CONSTRAINT "documentos_vendedor_eventos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documentos_vendedor"
    ADD CONSTRAINT "documentos_vendedor_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documentos_vendedor"
    ADD CONSTRAINT "documentos_vendedor_vendedor_id_tipo_documento_key" UNIQUE ("vendedor_id", "tipo_documento");



ALTER TABLE ONLY "public"."encomendas"
    ADD CONSTRAINT "encomendas_codigo_publico_key" UNIQUE ("codigo_publico");



ALTER TABLE ONLY "public"."encomendas"
    ADD CONSTRAINT "encomendas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enderecos_entrega_encomenda"
    ADD CONSTRAINT "enderecos_entrega_encomenda_pkey" PRIMARY KEY ("encomenda_id");



ALTER TABLE ONLY "public"."eventos_documento_parceiro_entrega"
    ADD CONSTRAINT "eventos_documento_parceiro_entrega_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eventos_encomenda"
    ADD CONSTRAINT "eventos_encomenda_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eventos_pagamento"
    ADD CONSTRAINT "eventos_pagamento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favoritos"
    ADD CONSTRAINT "favoritos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historico_contactos"
    ADD CONSTRAINT "historico_contactos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historico_contactos_servicos"
    ADD CONSTRAINT "historico_contactos_servicos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historico_pesquisas"
    ADD CONSTRAINT "historico_pesquisas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."idempotencia_checkout_encomenda"
    ADD CONSTRAINT "idempotencia_checkout_encomen_cliente_id_modalidade_recebim_key" UNIQUE ("cliente_id", "modalidade_recebimento", "chave_idempotencia");



ALTER TABLE ONLY "public"."idempotencia_checkout_encomenda"
    ADD CONSTRAINT "idempotencia_checkout_encomenda_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."idempotencia_intervencao_entrega_admin"
    ADD CONSTRAINT "idempotencia_intervencao_entr_administrador_id_operacao_cha_key" UNIQUE ("administrador_id", "operacao", "chave_idempotencia");



ALTER TABLE ONLY "public"."idempotencia_intervencao_entrega_admin"
    ADD CONSTRAINT "idempotencia_intervencao_entrega_admin_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incidentes_operacionais_entrega"
    ADD CONSTRAINT "incidentes_operacionais_entrega_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."itens_encomenda"
    ADD CONSTRAINT "itens_encomenda_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."movimentos_financeiros"
    ADD CONSTRAINT "movimentos_financeiros_chave_idempotencia_key" UNIQUE ("chave_idempotencia");



ALTER TABLE ONLY "public"."movimentos_financeiros"
    ADD CONSTRAINT "movimentos_financeiros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."municipios_angola"
    ADD CONSTRAINT "municipios_angola_codigo_oficial_key" UNIQUE ("codigo_oficial");



ALTER TABLE ONLY "public"."municipios_angola"
    ADD CONSTRAINT "municipios_angola_nome_por_provincia_unico" UNIQUE ("provincia_id", "nome");



ALTER TABLE ONLY "public"."municipios_angola"
    ADD CONSTRAINT "municipios_angola_numero_por_provincia_unico" UNIQUE ("provincia_id", "numero_oficial");



ALTER TABLE ONLY "public"."municipios_angola"
    ADD CONSTRAINT "municipios_angola_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notificacoes"
    ADD CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_chave_idempotencia_criacao_key" UNIQUE ("chave_idempotencia_criacao");



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_encomenda_id_key" UNIQUE ("encomenda_id");



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_referencia_interna_key" UNIQUE ("referencia_interna");



ALTER TABLE ONLY "public"."parceiros_entrega"
    ADD CONSTRAINT "parceiros_entrega_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parceiros_entrega"
    ADD CONSTRAINT "parceiros_entrega_user_id_key" UNIQUE ("user_id");



ALTER TABLE "public"."parceiros_entrega"
    ADD CONSTRAINT "parceiros_telefone_nacional_9" CHECK ((("telefone_nacional" IS NULL) OR ("telefone_nacional" ~ '^[0-9]{9}$'::"text"))) NOT VALID;



ALTER TABLE ONLY "public"."produtos"
    ADD CONSTRAINT "produtos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provincias_angola"
    ADD CONSTRAINT "provincias_angola_codigo_oficial_key" UNIQUE ("codigo_oficial");



ALTER TABLE ONLY "public"."provincias_angola"
    ADD CONSTRAINT "provincias_angola_numero_oficial_key" UNIQUE ("numero_oficial");



ALTER TABLE ONLY "public"."provincias_angola"
    ADD CONSTRAINT "provincias_angola_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reembolsos_pagamento"
    ADD CONSTRAINT "reembolsos_pagamento_chave_idempotencia_key" UNIQUE ("chave_idempotencia");



ALTER TABLE ONLY "public"."reembolsos_pagamento"
    ADD CONSTRAINT "reembolsos_pagamento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reembolsos_pagamento"
    ADD CONSTRAINT "reembolsos_pagamento_referencia_interna_key" UNIQUE ("referencia_interna");



ALTER TABLE ONLY "public"."repasses_vendedor"
    ADD CONSTRAINT "repasses_vendedor_encomenda_id_key" UNIQUE ("encomenda_id");



ALTER TABLE ONLY "public"."repasses_vendedor"
    ADD CONSTRAINT "repasses_vendedor_pagamento_id_key" UNIQUE ("pagamento_id");



ALTER TABLE ONLY "public"."repasses_vendedor"
    ADD CONSTRAINT "repasses_vendedor_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."repasses_vendedor"
    ADD CONSTRAINT "repasses_vendedor_referencia_key" UNIQUE ("referencia");



ALTER TABLE ONLY "public"."requisitos_documentos_entrega"
    ADD CONSTRAINT "requisitos_documentos_entrega_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."requisitos_documentos_entrega"
    ADD CONSTRAINT "requisitos_documentos_entrega_unico" UNIQUE ("escopo", "tipo_veiculo", "tipo_documento");



ALTER TABLE ONLY "public"."servicos"
    ADD CONSTRAINT "servicos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tentativas_pagamento"
    ADD CONSTRAINT "tentativas_pagamento_chave_idempotencia_key" UNIQUE ("chave_idempotencia");



ALTER TABLE ONLY "public"."tentativas_pagamento"
    ADD CONSTRAINT "tentativas_pagamento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tentativas_pagamento"
    ADD CONSTRAINT "tentativas_pagamento_referencia_interna_key" UNIQUE ("referencia_interna");



ALTER TABLE ONLY "public"."historico_contactos"
    ADD CONSTRAINT "unico_historico_produto" UNIQUE ("cliente_id", "produto_id");



ALTER TABLE ONLY "public"."historico_contactos_servicos"
    ADD CONSTRAINT "unico_historico_servico" UNIQUE ("cliente_id", "servico_id");



ALTER TABLE ONLY "public"."historico_contactos"
    ADD CONSTRAINT "unique_cliente_produto" UNIQUE ("cliente_id", "produto_id");



ALTER TABLE ONLY "public"."veiculos_entrega"
    ADD CONSTRAINT "veiculos_entrega_matricula_key" UNIQUE ("matricula");



ALTER TABLE ONLY "public"."veiculos_entrega"
    ADD CONSTRAINT "veiculos_entrega_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendedores"
    ADD CONSTRAINT "vendedores_email_login_unique" UNIQUE ("email_login");



ALTER TABLE ONLY "public"."vendedores"
    ADD CONSTRAINT "vendedores_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."vendedores"
    ADD CONSTRAINT "vendedores_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."vendedores"
    ADD CONSTRAINT "vendedores_telefone_nacional_9" CHECK ((("telefone_nacional" IS NULL) OR ("telefone_nacional" ~ '^[0-9]{9}$'::"text"))) NOT VALID;



ALTER TABLE ONLY "public"."vendedores"
    ADD CONSTRAINT "vendedores_telefone_unique" UNIQUE ("telefone_whatsapp");



ALTER TABLE ONLY "public"."versoes_documento_parceiro_entrega"
    ADD CONSTRAINT "versoes_documento_parceiro_entrega_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."versoes_documento_parceiro_entrega"
    ADD CONSTRAINT "versoes_documento_parceiro_numero_unico" UNIQUE ("documento_id", "numero_versao");



ALTER TABLE ONLY "public"."visualizacoes_produtos"
    ADD CONSTRAINT "visualizacoes_produtos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visualizacoes_servicos"
    ADD CONSTRAINT "visualizacoes_servicos_pkey" PRIMARY KEY ("id");



CREATE INDEX "areas_cobertura_entrega_parceiro_criado_idx" ON "public"."areas_cobertura_entrega" USING "btree" ("parceiro_id", "criado_em" DESC);



CREATE INDEX "areas_cobertura_entrega_zona_idx" ON "public"."areas_cobertura_entrega" USING "btree" ("provincia", "municipio") WHERE "ativo";



CREATE INDEX "atribuicoes_entrega_parceiro_criado_idx" ON "public"."atribuicoes_entrega_encomenda" USING "btree" ("parceiro_entrega_id", "criado_em" DESC);



CREATE UNIQUE INDEX "atribuicoes_entrega_uma_ativa_por_encomenda_idx" ON "public"."atribuicoes_entrega_encomenda" USING "btree" ("encomenda_id") WHERE ("estado" = ANY (ARRAY['atribuida'::"text", 'aceite'::"text", 'chegou_origem'::"text", 'recolhida'::"text", 'chegou_destino'::"text"]));



CREATE INDEX "atribuicoes_entrega_veiculo_criado_idx" ON "public"."atribuicoes_entrega_encomenda" USING "btree" ("veiculo_id", "criado_em" DESC);



CREATE INDEX "auditoria_administrativa_entidade_idx" ON "public"."auditoria_administrativa" USING "btree" ("entidade_tipo", "entidade_id", "criado_em" DESC);



CREATE INDEX "clientes_admin_filtros_idx" ON "public"."clientes" USING "btree" ("conta_ativa", "tipo_comprador", "provincia", "municipio", "criado_em" DESC);



CREATE INDEX "codigos_entrega_expira_em_idx" ON "public"."codigos_entrega" USING "btree" ("expira_em") WHERE ("usado_em" IS NULL);



CREATE INDEX "codigos_levantamento_expira_em_idx" ON "public"."codigos_levantamento" USING "btree" ("expira_em") WHERE ("usado_em" IS NULL);



CREATE INDEX "disputas_encomenda_cliente_atualizado_idx" ON "public"."disputas_encomenda" USING "btree" ("cliente_id", "atualizado_em" DESC);



CREATE INDEX "disputas_encomenda_cliente_criado_idx" ON "public"."disputas_encomenda" USING "btree" ("cliente_id", "criado_em" DESC);



CREATE UNIQUE INDEX "disputas_encomenda_uma_ativa_por_encomenda_idx" ON "public"."disputas_encomenda" USING "btree" ("encomenda_id") WHERE ("estado" = ANY (ARRAY['aberta'::"text", 'em_analise'::"text"]));



CREATE INDEX "disputas_encomenda_vendedor_atualizado_idx" ON "public"."disputas_encomenda" USING "btree" ("vendedor_id", "atualizado_em" DESC);



CREATE INDEX "disputas_encomenda_vendedor_criado_idx" ON "public"."disputas_encomenda" USING "btree" ("vendedor_id", "criado_em" DESC);



CREATE INDEX "documentos_parceiro_entrega_parceiro_criado_idx" ON "public"."documentos_parceiro_entrega" USING "btree" ("parceiro_id", "criado_em" DESC);



CREATE INDEX "documentos_parceiro_estado_idx" ON "public"."documentos_parceiro_entrega" USING "btree" ("parceiro_id", "estado");



CREATE UNIQUE INDEX "documentos_parceiro_pessoal_unico_idx" ON "public"."documentos_parceiro_entrega" USING "btree" ("parceiro_id", "tipo_documento") WHERE ("veiculo_id" IS NULL);



CREATE UNIQUE INDEX "documentos_parceiro_veiculo_unico_idx" ON "public"."documentos_parceiro_entrega" USING "btree" ("parceiro_id", "veiculo_id", "tipo_documento") WHERE ("veiculo_id" IS NOT NULL);



CREATE INDEX "documentos_vendedor_eventos_documento_idx" ON "public"."documentos_vendedor_eventos" USING "btree" ("documento_id", "criado_em" DESC);



CREATE INDEX "documentos_vendedor_eventos_vendedor_criado_idx" ON "public"."documentos_vendedor_eventos" USING "btree" ("vendedor_id", "criado_em" DESC);



CREATE INDEX "documentos_vendedor_vendedor_estado_idx" ON "public"."documentos_vendedor" USING "btree" ("vendedor_id", "estado");



CREATE INDEX "encomendas_cliente_criado_idx" ON "public"."encomendas" USING "btree" ("cliente_id", "criado_em" DESC);



CREATE INDEX "encomendas_cliente_estado_atualizado_idx" ON "public"."encomendas" USING "btree" ("cliente_id", "estado", "atualizado_em" DESC);



CREATE INDEX "encomendas_vendedor_atualizado_idx" ON "public"."encomendas" USING "btree" ("vendedor_id", "atualizado_em" DESC);



CREATE INDEX "encomendas_vendedor_estado_criado_idx" ON "public"."encomendas" USING "btree" ("vendedor_id", "estado", "criado_em" DESC);



CREATE INDEX "enderecos_entrega_encomenda_localizacao_idx" ON "public"."enderecos_entrega_encomenda" USING "btree" ("provincia", "municipio", "bairro");



CREATE INDEX "eventos_documento_parceiro_historico_idx" ON "public"."eventos_documento_parceiro_entrega" USING "btree" ("parceiro_id", "criado_em" DESC);



CREATE INDEX "eventos_encomenda_encomenda_criado_idx" ON "public"."eventos_encomenda" USING "btree" ("encomenda_id", "criado_em");



CREATE INDEX "eventos_pagamento_pagamento_criado_idx" ON "public"."eventos_pagamento" USING "btree" ("pagamento_id", "criado_em");



CREATE UNIQUE INDEX "favoritos_cliente_produto_idx" ON "public"."favoritos" USING "btree" ("utilizador_id", "produto_id") WHERE ("produto_id" IS NOT NULL);



CREATE UNIQUE INDEX "favoritos_cliente_servico_idx" ON "public"."favoritos" USING "btree" ("utilizador_id", "servico_id") WHERE ("servico_id" IS NOT NULL);



CREATE UNIQUE INDEX "favoritos_cliente_vendedor_idx" ON "public"."favoritos" USING "btree" ("utilizador_id", "vendedor_id") WHERE ("vendedor_id" IS NOT NULL);



CREATE INDEX "favoritos_utilizador_criado_idx" ON "public"."favoritos" USING "btree" ("utilizador_id", "criado_em" DESC);



CREATE INDEX "historico_contactos_cliente_criado_idx" ON "public"."historico_contactos" USING "btree" ("cliente_id", "criado_em" DESC);



CREATE INDEX "historico_contactos_servicos_cliente_criado_idx" ON "public"."historico_contactos_servicos" USING "btree" ("cliente_id", "criado_em" DESC);



CREATE UNIQUE INDEX "historico_unico" ON "public"."historico_contactos" USING "btree" ("cliente_id", "produto_id");



CREATE INDEX "idempotencia_checkout_encomenda_encomenda_idx" ON "public"."idempotencia_checkout_encomenda" USING "btree" ("encomenda_id") WHERE ("encomenda_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_clientes_email" ON "public"."clientes" USING "btree" ("email");



CREATE UNIQUE INDEX "idx_clientes_email_login" ON "public"."clientes" USING "btree" ("email_login");



CREATE INDEX "idx_clientes_telefone" ON "public"."clientes" USING "btree" ("telefone");



CREATE UNIQUE INDEX "idx_vendedores_email" ON "public"."vendedores" USING "btree" ("email");



CREATE UNIQUE INDEX "idx_vendedores_email_login" ON "public"."vendedores" USING "btree" ("email_login");



CREATE INDEX "idx_vendedores_telefone" ON "public"."vendedores" USING "btree" ("telefone_whatsapp");



CREATE INDEX "incidentes_operacionais_entrega_encomenda_criado_idx" ON "public"."incidentes_operacionais_entrega" USING "btree" ("encomenda_id", "criado_em" DESC);



CREATE UNIQUE INDEX "incidentes_operacionais_entrega_um_aberto_por_atribuicao_idx" ON "public"."incidentes_operacionais_entrega" USING "btree" ("atribuicao_id") WHERE ("estado" = 'aberto'::"text");



CREATE INDEX "itens_encomenda_encomenda_idx" ON "public"."itens_encomenda" USING "btree" ("encomenda_id");



CREATE INDEX "movimentos_financeiros_encomenda_criado_idx" ON "public"."movimentos_financeiros" USING "btree" ("encomenda_id", "criado_em");



CREATE INDEX "movimentos_financeiros_pagamento_criado_idx" ON "public"."movimentos_financeiros" USING "btree" ("pagamento_id", "criado_em");



CREATE INDEX "movimentos_financeiros_vendedor_criado_idx" ON "public"."movimentos_financeiros" USING "btree" ("vendedor_id", "criado_em");



CREATE INDEX "municipios_angola_provincia_id_idx" ON "public"."municipios_angola" USING "btree" ("provincia_id");



CREATE UNIQUE INDEX "notificacoes_chave_unica_idx" ON "public"."notificacoes" USING "btree" ("chave_idempotencia") WHERE ("chave_idempotencia" IS NOT NULL);



CREATE INDEX "notificacoes_utilizador_criado_idx" ON "public"."notificacoes" USING "btree" ("utilizador_id", "criado_em" DESC);



CREATE INDEX "pagamentos_cliente_criado_idx" ON "public"."pagamentos" USING "btree" ("cliente_id", "criado_em" DESC);



CREATE INDEX "pagamentos_estado_criado_idx" ON "public"."pagamentos" USING "btree" ("estado", "criado_em" DESC);



CREATE INDEX "pagamentos_vendedor_criado_idx" ON "public"."pagamentos" USING "btree" ("vendedor_id", "criado_em" DESC);



CREATE INDEX "produtos_vendedor_criado_idx" ON "public"."produtos" USING "btree" ("vendedor_id", "criado_em" DESC);



CREATE INDEX "reembolsos_pagamento_encomenda_idx" ON "public"."reembolsos_pagamento" USING "btree" ("encomenda_id", "criado_em" DESC);



CREATE INDEX "reembolsos_pagamento_pagamento_estado_idx" ON "public"."reembolsos_pagamento" USING "btree" ("pagamento_id", "estado", "criado_em" DESC);



CREATE INDEX "repasses_vendedor_estado_idx" ON "public"."repasses_vendedor" USING "btree" ("vendedor_id", "estado", "criado_em" DESC);



CREATE INDEX "requisitos_documentos_entrega_ativos_idx" ON "public"."requisitos_documentos_entrega" USING "btree" ("escopo", "tipo_veiculo", "tipo_documento") WHERE "ativo";



CREATE INDEX "servicos_vendedor_criado_idx" ON "public"."servicos" USING "btree" ("vendedor_id", "criado_em" DESC);



CREATE INDEX "tentativas_pagamento_estado_criado_idx" ON "public"."tentativas_pagamento" USING "btree" ("estado", "criado_em" DESC);



CREATE INDEX "tentativas_pagamento_pagamento_criado_idx" ON "public"."tentativas_pagamento" USING "btree" ("pagamento_id", "criado_em" DESC);



CREATE UNIQUE INDEX "tentativas_pagamento_uma_confirmada_por_pagamento_idx" ON "public"."tentativas_pagamento" USING "btree" ("pagamento_id") WHERE ("estado" = 'confirmada'::"text");



CREATE INDEX "veiculos_entrega_parceiro_criado_idx" ON "public"."veiculos_entrega" USING "btree" ("parceiro_id", "criado_em" DESC);



CREATE INDEX "veiculos_entrega_parceiro_idx" ON "public"."veiculos_entrega" USING "btree" ("parceiro_id");



CREATE INDEX "versoes_documento_parceiro_atual_idx" ON "public"."versoes_documento_parceiro_entrega" USING "btree" ("documento_id", "numero_versao" DESC);



CREATE OR REPLACE TRIGGER "atualizar_atribuicao_entrega_em" BEFORE UPDATE ON "public"."atribuicoes_entrega_encomenda" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_atualizado_em_atribuicao_entrega"();



CREATE OR REPLACE TRIGGER "atualizar_codigo_entrega_em" BEFORE UPDATE ON "public"."codigos_entrega" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_atualizado_em_codigo_entrega"();



CREATE OR REPLACE TRIGGER "atualizar_codigo_levantamento_em" BEFORE UPDATE ON "public"."codigos_levantamento" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_atualizado_em_codigo_levantamento"();



CREATE OR REPLACE TRIGGER "atualizar_configuracao_financeira_em" BEFORE UPDATE ON "public"."configuracoes_financeiras" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_atualizado_em_financeiro"();



CREATE OR REPLACE TRIGGER "atualizar_disputa_encomenda_em" BEFORE UPDATE ON "public"."disputas_encomenda" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_atualizado_em_financeiro"();



CREATE OR REPLACE TRIGGER "atualizar_documento_parceiro_em" BEFORE UPDATE ON "public"."documentos_parceiro_entrega" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_atualizado_em_parceiros_entrega"();



CREATE OR REPLACE TRIGGER "atualizar_documento_vendedor_em" BEFORE UPDATE ON "public"."documentos_vendedor" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_atualizado_em_documentos_vendedor"();



CREATE OR REPLACE TRIGGER "atualizar_encomenda_em" BEFORE UPDATE ON "public"."encomendas" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_atualizado_em_encomenda"();



CREATE OR REPLACE TRIGGER "atualizar_incidente_operacional_entrega_em" BEFORE UPDATE ON "public"."incidentes_operacionais_entrega" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_atualizado_em_incidente_operacional_entrega"();



CREATE OR REPLACE TRIGGER "atualizar_municipio_angola_em" BEFORE UPDATE ON "public"."municipios_angola" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_atualizado_em_taxonomia_territorial"();



CREATE OR REPLACE TRIGGER "atualizar_pagamento_em" BEFORE UPDATE ON "public"."pagamentos" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_atualizado_em_financeiro"();



CREATE OR REPLACE TRIGGER "atualizar_parceiro_entrega_em" BEFORE UPDATE ON "public"."parceiros_entrega" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_atualizado_em_parceiros_entrega"();



CREATE OR REPLACE TRIGGER "atualizar_provincia_angola_em" BEFORE UPDATE ON "public"."provincias_angola" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_atualizado_em_taxonomia_territorial"();



CREATE OR REPLACE TRIGGER "atualizar_reembolso_pagamento_em" BEFORE UPDATE ON "public"."reembolsos_pagamento" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_atualizado_em_financeiro"();



CREATE OR REPLACE TRIGGER "atualizar_repasse_em" BEFORE UPDATE ON "public"."repasses_vendedor" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_atualizado_em_financeiro"();



CREATE OR REPLACE TRIGGER "atualizar_requisito_documento_entrega_em" BEFORE UPDATE ON "public"."requisitos_documentos_entrega" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_requisito_documento_entrega_em"();



CREATE OR REPLACE TRIGGER "atualizar_tentativa_pagamento_em" BEFORE UPDATE ON "public"."tentativas_pagamento" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_atualizado_em_financeiro"();



CREATE OR REPLACE TRIGGER "atualizar_veiculo_entrega_em" BEFORE UPDATE ON "public"."veiculos_entrega" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_atualizado_em_parceiros_entrega"();



CREATE OR REPLACE TRIGGER "bloquear_conclusao_encomenda_com_disputa" BEFORE UPDATE OF "estado" ON "public"."encomendas" FOR EACH ROW EXECUTE FUNCTION "public"."bloquear_conclusao_com_disputa_ativa"();



CREATE OR REPLACE TRIGGER "criar_notificacao_ciclo_entrega_fase_1" AFTER INSERT ON "public"."eventos_encomenda" FOR EACH ROW WHEN (("new"."tipo_evento" = ANY (ARRAY['entregador_chegou_origem'::"text", 'encomenda_recolhida'::"text", 'entregador_chegou_destino'::"text", 'entrega_confirmada'::"text"]))) EXECUTE FUNCTION "public"."notificar_ciclo_entrega_fase_1"();



CREATE OR REPLACE TRIGGER "criar_notificacao_evento_encomenda" AFTER INSERT ON "public"."eventos_encomenda" FOR EACH ROW EXECUTE FUNCTION "public"."notificar_evento_encomenda"();



CREATE OR REPLACE TRIGGER "criar_notificacao_intervencao_admin_entrega" AFTER INSERT ON "public"."eventos_encomenda" FOR EACH ROW WHEN (("new"."tipo_evento" = ANY (ARRAY['atribuicao_liberada_admin'::"text", 'incidente_operacional_aberto'::"text"]))) EXECUTE FUNCTION "public"."notificar_intervencao_admin_entrega"();



CREATE OR REPLACE TRIGGER "criar_versao_inicial_documento_parceiro" AFTER INSERT ON "public"."documentos_parceiro_entrega" FOR EACH ROW EXECUTE FUNCTION "public"."criar_versao_inicial_documento_parceiro"();



CREATE OR REPLACE TRIGGER "impedir_alteracao_auditoria_administrativa" BEFORE DELETE OR UPDATE ON "public"."auditoria_administrativa" FOR EACH ROW EXECUTE FUNCTION "public"."proteger_auditoria_administrativa_append_only"();



CREATE OR REPLACE TRIGGER "impedir_alteracao_evento_pagamento" BEFORE DELETE OR UPDATE ON "public"."eventos_pagamento" FOR EACH ROW EXECUTE FUNCTION "public"."proteger_eventos_pagamento_append_only"();



CREATE OR REPLACE TRIGGER "impedir_alteracao_movimento_financeiro" BEFORE DELETE OR UPDATE ON "public"."movimentos_financeiros" FOR EACH ROW EXECUTE FUNCTION "public"."proteger_movimentos_financeiros_append_only"();



CREATE OR REPLACE TRIGGER "preencher_snapshot_logistico_item" BEFORE INSERT ON "public"."itens_encomenda" FOR EACH ROW EXECUTE FUNCTION "public"."preencher_snapshot_logistico_item_encomenda"();



CREATE OR REPLACE TRIGGER "proteger_analise_documento_vendedor" BEFORE INSERT OR UPDATE ON "public"."documentos_vendedor" FOR EACH ROW EXECUTE FUNCTION "public"."proteger_analise_documento_vendedor"();



CREATE OR REPLACE TRIGGER "proteger_campos_vendedor" BEFORE INSERT OR UPDATE ON "public"."vendedores" FOR EACH ROW EXECUTE FUNCTION "public"."proteger_campos_vendedor"();



CREATE OR REPLACE TRIGGER "proteger_estado_parceiro_entrega" BEFORE INSERT OR UPDATE ON "public"."parceiros_entrega" FOR EACH ROW EXECUTE FUNCTION "public"."proteger_estado_parceiro_entrega"();



CREATE OR REPLACE TRIGGER "proteger_eventos_documento_parceiro" BEFORE DELETE OR UPDATE ON "public"."eventos_documento_parceiro_entrega" FOR EACH ROW EXECUTE FUNCTION "public"."proteger_eventos_documento_parceiro"();



CREATE OR REPLACE TRIGGER "proteger_identidade_verificada_vendedor" BEFORE UPDATE OF "nome_responsavel", "nome_comercial" ON "public"."vendedores" FOR EACH ROW EXECUTE FUNCTION "public"."proteger_identidade_verificada_vendedor"();



CREATE OR REPLACE TRIGGER "proteger_marco_aprovacao_vendedor" BEFORE UPDATE OF "aprovado_em", "aprovado_por" ON "public"."vendedores" FOR EACH ROW EXECUTE FUNCTION "public"."proteger_marco_aprovacao_vendedor"();



CREATE OR REPLACE TRIGGER "proteger_nome_verificado_parceiro_entrega" BEFORE UPDATE OF "nome_completo" ON "public"."parceiros_entrega" FOR EACH ROW EXECUTE FUNCTION "public"."proteger_nome_verificado_parceiro_entrega"();



CREATE OR REPLACE TRIGGER "proteger_snapshot_destino_entrega" BEFORE UPDATE ON "public"."enderecos_entrega_encomenda" FOR EACH ROW EXECUTE FUNCTION "public"."proteger_snapshot_destino_entrega_encomenda"();



CREATE OR REPLACE TRIGGER "proteger_verificacao_documento" BEFORE INSERT OR UPDATE ON "public"."documentos_parceiro_entrega" FOR EACH ROW EXECUTE FUNCTION "public"."proteger_verificacao_logistica"();



CREATE OR REPLACE TRIGGER "proteger_verificacao_veiculo" BEFORE INSERT OR UPDATE ON "public"."veiculos_entrega" FOR EACH ROW EXECUTE FUNCTION "public"."proteger_verificacao_logistica"();



CREATE OR REPLACE TRIGGER "proteger_versao_documento_parceiro" BEFORE DELETE OR UPDATE ON "public"."versoes_documento_parceiro_entrega" FOR EACH ROW EXECUTE FUNCTION "public"."proteger_versao_documento_parceiro"();



CREATE OR REPLACE TRIGGER "registar_evento_documento_vendedor" AFTER INSERT OR UPDATE ON "public"."documentos_vendedor" FOR EACH ROW EXECUTE FUNCTION "public"."registar_evento_documento_vendedor"();



CREATE OR REPLACE TRIGGER "sincronizar_analise_versao_documento_parceiro" AFTER UPDATE ON "public"."documentos_parceiro_entrega" FOR EACH ROW EXECUTE FUNCTION "public"."sincronizar_analise_versao_documento_parceiro"();



CREATE CONSTRAINT TRIGGER "validar_destino_entrega_na_encomenda" AFTER INSERT OR UPDATE OF "modalidade_recebimento" ON "public"."encomendas" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."validar_integridade_destino_entrega_encomenda"();



CREATE CONSTRAINT TRIGGER "validar_encomenda_no_destino_entrega" AFTER INSERT OR DELETE OR UPDATE ON "public"."enderecos_entrega_encomenda" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."validar_integridade_destino_entrega_encomenda"();



CREATE OR REPLACE TRIGGER "validar_motivo_rejeicao_vendedor" BEFORE INSERT OR UPDATE OF "status_aprovacao", "motivo_rejeicao" ON "public"."vendedores" FOR EACH ROW EXECUTE FUNCTION "public"."validar_motivo_rejeicao_vendedor"();



CREATE OR REPLACE TRIGGER "validar_reembolso_pagamento" BEFORE INSERT OR UPDATE ON "public"."reembolsos_pagamento" FOR EACH ROW EXECUTE FUNCTION "public"."validar_limites_reembolso_pagamento"();



CREATE OR REPLACE TRIGGER "validar_referencias_movimento_financeiro" BEFORE INSERT ON "public"."movimentos_financeiros" FOR EACH ROW EXECUTE FUNCTION "public"."validar_referencias_movimento_financeiro"();



CREATE OR REPLACE TRIGGER "validar_veiculo_atribuicao_entrega" BEFORE INSERT OR UPDATE OF "parceiro_entrega_id", "veiculo_id" ON "public"."atribuicoes_entrega_encomenda" FOR EACH ROW EXECUTE FUNCTION "public"."validar_veiculo_da_atribuicao_entrega"();



CREATE OR REPLACE TRIGGER "validar_veiculo_documento_parceiro" BEFORE INSERT OR UPDATE ON "public"."documentos_parceiro_entrega" FOR EACH ROW EXECUTE FUNCTION "public"."validar_veiculo_do_documento_parceiro"();



CREATE OR REPLACE TRIGGER "validar_vendedor_elegivel_em_encomenda" BEFORE INSERT ON "public"."encomendas" FOR EACH ROW EXECUTE FUNCTION "public"."validar_vendedor_elegivel_em_encomenda"();



ALTER TABLE ONLY "public"."administradores"
    ADD CONSTRAINT "administradores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."areas_cobertura_entrega"
    ADD CONSTRAINT "areas_cobertura_entrega_parceiro_id_fkey" FOREIGN KEY ("parceiro_id") REFERENCES "public"."parceiros_entrega"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."atribuicoes_entrega_encomenda"
    ADD CONSTRAINT "atribuicoes_entrega_encomenda_atribuido_por_fkey" FOREIGN KEY ("atribuido_por") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."atribuicoes_entrega_encomenda"
    ADD CONSTRAINT "atribuicoes_entrega_encomenda_encomenda_id_fkey" FOREIGN KEY ("encomenda_id") REFERENCES "public"."encomendas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."atribuicoes_entrega_encomenda"
    ADD CONSTRAINT "atribuicoes_entrega_encomenda_parceiro_entrega_id_fkey" FOREIGN KEY ("parceiro_entrega_id") REFERENCES "public"."parceiros_entrega"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."atribuicoes_entrega_encomenda"
    ADD CONSTRAINT "atribuicoes_entrega_encomenda_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "public"."veiculos_entrega"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."auditoria_administrativa"
    ADD CONSTRAINT "auditoria_administrativa_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."codigos_entrega"
    ADD CONSTRAINT "codigos_entrega_atualizado_por_fkey" FOREIGN KEY ("atualizado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."codigos_entrega"
    ADD CONSTRAINT "codigos_entrega_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."codigos_entrega"
    ADD CONSTRAINT "codigos_entrega_encomenda_id_fkey" FOREIGN KEY ("encomenda_id") REFERENCES "public"."encomendas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."codigos_levantamento"
    ADD CONSTRAINT "codigos_levantamento_atualizado_por_fkey" FOREIGN KEY ("atualizado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."codigos_levantamento"
    ADD CONSTRAINT "codigos_levantamento_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."codigos_levantamento"
    ADD CONSTRAINT "codigos_levantamento_encomenda_id_fkey" FOREIGN KEY ("encomenda_id") REFERENCES "public"."encomendas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."disputas_encomenda"
    ADD CONSTRAINT "disputas_encomenda_analisado_por_fkey" FOREIGN KEY ("analisado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."disputas_encomenda"
    ADD CONSTRAINT "disputas_encomenda_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."disputas_encomenda"
    ADD CONSTRAINT "disputas_encomenda_encomenda_id_fkey" FOREIGN KEY ("encomenda_id") REFERENCES "public"."encomendas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."disputas_encomenda"
    ADD CONSTRAINT "disputas_encomenda_pagamento_id_fkey" FOREIGN KEY ("pagamento_id") REFERENCES "public"."pagamentos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."disputas_encomenda"
    ADD CONSTRAINT "disputas_encomenda_resolvido_por_fkey" FOREIGN KEY ("resolvido_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."disputas_encomenda"
    ADD CONSTRAINT "disputas_encomenda_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."documentos_parceiro_entrega"
    ADD CONSTRAINT "documentos_parceiro_entrega_analisado_por_fkey" FOREIGN KEY ("analisado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."documentos_parceiro_entrega"
    ADD CONSTRAINT "documentos_parceiro_entrega_parceiro_id_fkey" FOREIGN KEY ("parceiro_id") REFERENCES "public"."parceiros_entrega"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documentos_parceiro_entrega"
    ADD CONSTRAINT "documentos_parceiro_entrega_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "public"."veiculos_entrega"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documentos_parceiro_entrega"
    ADD CONSTRAINT "documentos_parceiro_versao_atual_fkey" FOREIGN KEY ("versao_atual_id") REFERENCES "public"."versoes_documento_parceiro_entrega"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."documentos_vendedor"
    ADD CONSTRAINT "documentos_vendedor_analisado_por_fkey" FOREIGN KEY ("analisado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."documentos_vendedor_eventos"
    ADD CONSTRAINT "documentos_vendedor_eventos_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos_vendedor"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documentos_vendedor_eventos"
    ADD CONSTRAINT "documentos_vendedor_eventos_realizado_por_fkey" FOREIGN KEY ("realizado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."documentos_vendedor_eventos"
    ADD CONSTRAINT "documentos_vendedor_eventos_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documentos_vendedor"
    ADD CONSTRAINT "documentos_vendedor_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."encomendas"
    ADD CONSTRAINT "encomendas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."encomendas"
    ADD CONSTRAINT "encomendas_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."enderecos_entrega_encomenda"
    ADD CONSTRAINT "enderecos_entrega_encomenda_encomenda_id_fkey" FOREIGN KEY ("encomenda_id") REFERENCES "public"."encomendas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."eventos_documento_parceiro_entrega"
    ADD CONSTRAINT "eventos_documento_parceiro_entrega_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos_parceiro_entrega"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."eventos_documento_parceiro_entrega"
    ADD CONSTRAINT "eventos_documento_parceiro_entrega_parceiro_id_fkey" FOREIGN KEY ("parceiro_id") REFERENCES "public"."parceiros_entrega"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."eventos_documento_parceiro_entrega"
    ADD CONSTRAINT "eventos_documento_parceiro_entrega_utilizador_id_fkey" FOREIGN KEY ("utilizador_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."eventos_documento_parceiro_entrega"
    ADD CONSTRAINT "eventos_documento_parceiro_entrega_versao_id_fkey" FOREIGN KEY ("versao_id") REFERENCES "public"."versoes_documento_parceiro_entrega"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."eventos_encomenda"
    ADD CONSTRAINT "eventos_encomenda_encomenda_id_fkey" FOREIGN KEY ("encomenda_id") REFERENCES "public"."encomendas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."eventos_encomenda"
    ADD CONSTRAINT "eventos_encomenda_utilizador_id_fkey" FOREIGN KEY ("utilizador_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."eventos_pagamento"
    ADD CONSTRAINT "eventos_pagamento_encomenda_id_fkey" FOREIGN KEY ("encomenda_id") REFERENCES "public"."encomendas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."eventos_pagamento"
    ADD CONSTRAINT "eventos_pagamento_pagamento_id_fkey" FOREIGN KEY ("pagamento_id") REFERENCES "public"."pagamentos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."eventos_pagamento"
    ADD CONSTRAINT "eventos_pagamento_tentativa_pagamento_id_fkey" FOREIGN KEY ("tentativa_pagamento_id") REFERENCES "public"."tentativas_pagamento"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."eventos_pagamento"
    ADD CONSTRAINT "eventos_pagamento_utilizador_id_fkey" FOREIGN KEY ("utilizador_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."favoritos"
    ADD CONSTRAINT "favoritos_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favoritos"
    ADD CONSTRAINT "favoritos_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "public"."servicos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favoritos"
    ADD CONSTRAINT "favoritos_utilizador_id_fkey" FOREIGN KEY ("utilizador_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favoritos"
    ADD CONSTRAINT "favoritos_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historico_contactos"
    ADD CONSTRAINT "fk_cliente_auth" FOREIGN KEY ("cliente_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."historico_contactos"
    ADD CONSTRAINT "historico_contactos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historico_contactos"
    ADD CONSTRAINT "historico_contactos_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historico_contactos_servicos"
    ADD CONSTRAINT "historico_contactos_servicos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historico_contactos_servicos"
    ADD CONSTRAINT "historico_contactos_servicos_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "public"."servicos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historico_contactos_servicos"
    ADD CONSTRAINT "historico_contactos_servicos_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."historico_contactos"
    ADD CONSTRAINT "historico_contactos_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historico_pesquisas"
    ADD CONSTRAINT "historico_pesquisas_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."historico_pesquisas"
    ADD CONSTRAINT "historico_pesquisas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."idempotencia_checkout_encomenda"
    ADD CONSTRAINT "idempotencia_checkout_encomenda_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."idempotencia_checkout_encomenda"
    ADD CONSTRAINT "idempotencia_checkout_encomenda_encomenda_id_fkey" FOREIGN KEY ("encomenda_id") REFERENCES "public"."encomendas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."idempotencia_intervencao_entrega_admin"
    ADD CONSTRAINT "idempotencia_intervencao_entrega_admin_administrador_id_fkey" FOREIGN KEY ("administrador_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."idempotencia_intervencao_entrega_admin"
    ADD CONSTRAINT "idempotencia_intervencao_entrega_admin_atribuicao_id_fkey" FOREIGN KEY ("atribuicao_id") REFERENCES "public"."atribuicoes_entrega_encomenda"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."idempotencia_intervencao_entrega_admin"
    ADD CONSTRAINT "idempotencia_intervencao_incidente_fk" FOREIGN KEY ("incidente_id") REFERENCES "public"."incidentes_operacionais_entrega"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."incidentes_operacionais_entrega"
    ADD CONSTRAINT "incidentes_operacionais_entrega_atribuicao_id_fkey" FOREIGN KEY ("atribuicao_id") REFERENCES "public"."atribuicoes_entrega_encomenda"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."incidentes_operacionais_entrega"
    ADD CONSTRAINT "incidentes_operacionais_entrega_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."incidentes_operacionais_entrega"
    ADD CONSTRAINT "incidentes_operacionais_entrega_encomenda_id_fkey" FOREIGN KEY ("encomenda_id") REFERENCES "public"."encomendas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."incidentes_operacionais_entrega"
    ADD CONSTRAINT "incidentes_operacionais_entrega_resolvido_por_fkey" FOREIGN KEY ("resolvido_por") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."itens_encomenda"
    ADD CONSTRAINT "itens_encomenda_encomenda_id_fkey" FOREIGN KEY ("encomenda_id") REFERENCES "public"."encomendas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."itens_encomenda"
    ADD CONSTRAINT "itens_encomenda_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."itens_encomenda"
    ADD CONSTRAINT "itens_encomenda_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."movimentos_financeiros"
    ADD CONSTRAINT "movimentos_financeiros_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."movimentos_financeiros"
    ADD CONSTRAINT "movimentos_financeiros_encomenda_id_fkey" FOREIGN KEY ("encomenda_id") REFERENCES "public"."encomendas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."movimentos_financeiros"
    ADD CONSTRAINT "movimentos_financeiros_pagamento_id_fkey" FOREIGN KEY ("pagamento_id") REFERENCES "public"."pagamentos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."movimentos_financeiros"
    ADD CONSTRAINT "movimentos_financeiros_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."municipios_angola"
    ADD CONSTRAINT "municipios_angola_provincia_id_fkey" FOREIGN KEY ("provincia_id") REFERENCES "public"."provincias_angola"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."notificacoes"
    ADD CONSTRAINT "notificacoes_utilizador_id_fkey" FOREIGN KEY ("utilizador_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_encomenda_id_fkey" FOREIGN KEY ("encomenda_id") REFERENCES "public"."encomendas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pagamentos"
    ADD CONSTRAINT "pagamentos_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."parceiros_entrega"
    ADD CONSTRAINT "parceiros_entrega_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."produtos"
    ADD CONSTRAINT "produtos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id");



ALTER TABLE ONLY "public"."produtos"
    ADD CONSTRAINT "produtos_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reembolsos_pagamento"
    ADD CONSTRAINT "reembolsos_pagamento_aprovado_por_fkey" FOREIGN KEY ("aprovado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reembolsos_pagamento"
    ADD CONSTRAINT "reembolsos_pagamento_encomenda_id_fkey" FOREIGN KEY ("encomenda_id") REFERENCES "public"."encomendas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."reembolsos_pagamento"
    ADD CONSTRAINT "reembolsos_pagamento_pagamento_id_fkey" FOREIGN KEY ("pagamento_id") REFERENCES "public"."pagamentos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."reembolsos_pagamento"
    ADD CONSTRAINT "reembolsos_pagamento_solicitado_por_fkey" FOREIGN KEY ("solicitado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."repasses_vendedor"
    ADD CONSTRAINT "repasses_vendedor_encomenda_id_fkey" FOREIGN KEY ("encomenda_id") REFERENCES "public"."encomendas"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."repasses_vendedor"
    ADD CONSTRAINT "repasses_vendedor_pagamento_id_fkey" FOREIGN KEY ("pagamento_id") REFERENCES "public"."pagamentos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."repasses_vendedor"
    ADD CONSTRAINT "repasses_vendedor_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."servicos"
    ADD CONSTRAINT "servicos_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id");



ALTER TABLE ONLY "public"."tentativas_pagamento"
    ADD CONSTRAINT "tentativas_pagamento_pagamento_id_fkey" FOREIGN KEY ("pagamento_id") REFERENCES "public"."pagamentos"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."veiculos_entrega"
    ADD CONSTRAINT "veiculos_entrega_parceiro_id_fkey" FOREIGN KEY ("parceiro_id") REFERENCES "public"."parceiros_entrega"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendedores"
    ADD CONSTRAINT "vendedores_aprovado_por_fkey" FOREIGN KEY ("aprovado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vendedores"
    ADD CONSTRAINT "vendedores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."versoes_documento_parceiro_entrega"
    ADD CONSTRAINT "versoes_documento_parceiro_entrega_analisado_por_fkey" FOREIGN KEY ("analisado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."versoes_documento_parceiro_entrega"
    ADD CONSTRAINT "versoes_documento_parceiro_entrega_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos_parceiro_entrega"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."versoes_documento_parceiro_entrega"
    ADD CONSTRAINT "versoes_documento_parceiro_entrega_parceiro_id_fkey" FOREIGN KEY ("parceiro_id") REFERENCES "public"."parceiros_entrega"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."versoes_documento_parceiro_entrega"
    ADD CONSTRAINT "versoes_documento_parceiro_entrega_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "public"."veiculos_entrega"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."visualizacoes_produtos"
    ADD CONSTRAINT "visualizacoes_produtos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visualizacoes_produtos"
    ADD CONSTRAINT "visualizacoes_produtos_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visualizacoes_produtos"
    ADD CONSTRAINT "visualizacoes_produtos_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."visualizacoes_servicos"
    ADD CONSTRAINT "visualizacoes_servicos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visualizacoes_servicos"
    ADD CONSTRAINT "visualizacoes_servicos_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "public"."servicos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visualizacoes_servicos"
    ADD CONSTRAINT "visualizacoes_servicos_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE SET NULL;



CREATE POLICY "Admin pode ver historico" ON "public"."historico_contactos" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admin pode ver visualizacoes produtos" ON "public"."visualizacoes_produtos" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admin pode ver visualizacoes servicos" ON "public"."visualizacoes_servicos" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Categorias visiveis publicamente" ON "public"."categorias" FOR SELECT USING (true);



CREATE POLICY "Cliente pode atualizar historico servicos" ON "public"."historico_contactos_servicos" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "cliente_id")) WITH CHECK (("auth"."uid"() = "cliente_id"));



CREATE POLICY "Cliente pode atualizar seu historico" ON "public"."historico_contactos" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "cliente_id")) WITH CHECK (("auth"."uid"() = "cliente_id"));



CREATE POLICY "Cliente pode criar historico servicos" ON "public"."historico_contactos_servicos" FOR INSERT TO "authenticated" WITH CHECK (("cliente_id" = "auth"."uid"()));



CREATE POLICY "Cliente pode criar seu historico" ON "public"."historico_contactos" FOR INSERT TO "authenticated" WITH CHECK (("cliente_id" = "auth"."uid"()));



CREATE POLICY "Cliente pode criar visualizacao produto" ON "public"."visualizacoes_produtos" FOR INSERT WITH CHECK (("cliente_id" = "auth"."uid"()));



CREATE POLICY "Cliente pode criar visualizacao servico" ON "public"."visualizacoes_servicos" FOR INSERT WITH CHECK (("cliente_id" = "auth"."uid"()));



CREATE POLICY "Cliente pode ver historico servicos" ON "public"."historico_contactos_servicos" FOR SELECT TO "authenticated" USING (("cliente_id" = "auth"."uid"()));



CREATE POLICY "Cliente pode ver seu historico" ON "public"."historico_contactos" FOR SELECT TO "authenticated" USING (("cliente_id" = "auth"."uid"()));



CREATE POLICY "Cliente pode ver suas visualizacoes produtos" ON "public"."visualizacoes_produtos" FOR SELECT USING (("cliente_id" = "auth"."uid"()));



CREATE POLICY "Cliente pode ver suas visualizacoes servicos" ON "public"."visualizacoes_servicos" FOR SELECT USING (("cliente_id" = "auth"."uid"()));



CREATE POLICY "Clientes podem inserir suas visualizacoes" ON "public"."visualizacoes_produtos" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "cliente_id"));



CREATE POLICY "Clientes podem inserir suas visualizacoes de servicos" ON "public"."visualizacoes_servicos" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "cliente_id"));



CREATE POLICY "Clientes podem ver suas visualizacoes" ON "public"."visualizacoes_produtos" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "cliente_id"));



CREATE POLICY "Clientes podem ver suas visualizacoes de servicos" ON "public"."visualizacoes_servicos" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "cliente_id"));



CREATE POLICY "Criar proprios favoritos" ON "public"."favoritos" FOR INSERT WITH CHECK (("utilizador_id" = "auth"."uid"()));



CREATE POLICY "Remover proprios favoritos" ON "public"."favoritos" FOR DELETE USING (("utilizador_id" = "auth"."uid"()));



CREATE POLICY "Vendedor pode ver historico dos seus produtos" ON "public"."historico_contactos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendedores"
  WHERE (("vendedores"."user_id" = "auth"."uid"()) AND ("vendedores"."id" = "historico_contactos"."vendedor_id")))));



CREATE POLICY "Vendedor pode ver historico dos seus servicos" ON "public"."historico_contactos_servicos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendedores"
  WHERE (("vendedores"."user_id" = "auth"."uid"()) AND ("vendedores"."id" = "historico_contactos_servicos"."vendedor_id")))));



CREATE POLICY "Ver proprios favoritos" ON "public"."favoritos" FOR SELECT USING (("utilizador_id" = "auth"."uid"()));



CREATE POLICY "admin pode gerir produtos" ON "public"."produtos" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."papel" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."papel" = 'admin'::"text")))));



CREATE POLICY "admin pode gerir servicos" ON "public"."servicos" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."papel" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."papel" = 'admin'::"text")))));



CREATE POLICY "admin pode ver historico pesquisas" ON "public"."historico_pesquisas" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."papel" = 'admin'::"text")))));



ALTER TABLE "public"."administradores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "administradores_apenas_admin" ON "public"."administradores" TO "authenticated" USING ("public"."eh_admin"()) WITH CHECK ("public"."eh_admin"());



ALTER TABLE "public"."areas_cobertura_entrega" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "areas_entrega_dono_ou_admin" ON "public"."areas_cobertura_entrega" TO "authenticated" USING (("public"."eh_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."parceiros_entrega" "p"
  WHERE (("p"."id" = "areas_cobertura_entrega"."parceiro_id") AND ("p"."user_id" = "auth"."uid"())))))) WITH CHECK (("public"."eh_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."parceiros_entrega" "p"
  WHERE (("p"."id" = "areas_cobertura_entrega"."parceiro_id") AND ("p"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."atribuicoes_entrega_encomenda" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "atribuicoes_entrega_leitura_admin_ou_parceiro" ON "public"."atribuicoes_entrega_encomenda" FOR SELECT TO "authenticated" USING (("public"."eh_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."parceiros_entrega" "p"
  WHERE (("p"."id" = "atribuicoes_entrega_encomenda"."parceiro_entrega_id") AND ("p"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."auditoria_administrativa" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auditoria_administrativa_leitura_admin" ON "public"."auditoria_administrativa" FOR SELECT TO "authenticated" USING ("public"."eh_admin"());



CREATE POLICY "catalogo_publico" ON "public"."produtos" FOR SELECT TO "authenticated", "anon" USING ((("publicado" AND "disponivel") OR (EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "produtos"."vendedor_id") AND (("v"."user_id" = "auth"."uid"()) OR "public"."eh_admin"()))))));



ALTER TABLE "public"."categorias" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categorias_admin" ON "public"."categorias" TO "authenticated" USING ("public"."eh_admin"()) WITH CHECK ("public"."eh_admin"());



CREATE POLICY "categorias_leitura_publica" ON "public"."categorias" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."clientes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clientes_atualizar_proprio_ou_admin" ON "public"."clientes" FOR UPDATE TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."eh_admin"())) WITH CHECK ((("id" = "auth"."uid"()) OR "public"."eh_admin"()));



CREATE POLICY "clientes_criar_proprio_ou_admin" ON "public"."clientes" FOR INSERT TO "authenticated" WITH CHECK ((("id" = "auth"."uid"()) OR "public"."eh_admin"()));



CREATE POLICY "clientes_eliminar_somente_admin" ON "public"."clientes" FOR DELETE TO "authenticated" USING ("public"."eh_admin"());



CREATE POLICY "clientes_leitura_propria_ou_admin" ON "public"."clientes" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."eh_admin"()));



ALTER TABLE "public"."codigos_entrega" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."codigos_levantamento" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "codigos_levantamento_sem_acesso_direto" ON "public"."codigos_levantamento" TO "authenticated" USING (false) WITH CHECK (false);



ALTER TABLE "public"."configuracoes_financeiras" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "configuracoes_financeiras_admin_leitura" ON "public"."configuracoes_financeiras" FOR SELECT TO "authenticated" USING ("public"."eh_admin"());



ALTER TABLE "public"."disputas_encomenda" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "disputas_encomenda_leitura_cliente" ON "public"."disputas_encomenda" FOR SELECT TO "authenticated" USING (("cliente_id" = "auth"."uid"()));



CREATE POLICY "disputas_encomenda_leitura_vendedor" ON "public"."disputas_encomenda" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "disputas_encomenda"."vendedor_id") AND ("v"."user_id" = "auth"."uid"())))));



CREATE POLICY "documentos_parceiro_dono_ou_admin" ON "public"."documentos_parceiro_entrega" TO "authenticated" USING (("public"."eh_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."parceiros_entrega" "p"
  WHERE (("p"."id" = "documentos_parceiro_entrega"."parceiro_id") AND ("p"."user_id" = "auth"."uid"())))))) WITH CHECK (("public"."eh_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."parceiros_entrega" "p"
  WHERE (("p"."id" = "documentos_parceiro_entrega"."parceiro_id") AND ("p"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."documentos_parceiro_entrega" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documentos_vendedor" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documentos_vendedor_atualizar_proprio_admin" ON "public"."documentos_vendedor" FOR UPDATE TO "authenticated" USING (("public"."eh_admin"() OR (("estado" = 'rejeitado'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "documentos_vendedor"."vendedor_id") AND ("v"."user_id" = "auth"."uid"()))))))) WITH CHECK (("public"."eh_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "documentos_vendedor"."vendedor_id") AND ("v"."user_id" = "auth"."uid"()))))));



CREATE POLICY "documentos_vendedor_criar_proprio" ON "public"."documentos_vendedor" FOR INSERT TO "authenticated" WITH CHECK (("public"."eh_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "documentos_vendedor"."vendedor_id") AND ("v"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."documentos_vendedor_eventos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documentos_vendedor_eventos_apenas_admin" ON "public"."documentos_vendedor_eventos" FOR SELECT TO "authenticated" USING ("public"."eh_admin"());



CREATE POLICY "documentos_vendedor_leitura_propria_admin" ON "public"."documentos_vendedor" FOR SELECT TO "authenticated" USING (("public"."eh_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "documentos_vendedor"."vendedor_id") AND ("v"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."encomendas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "encomendas_leitura_cliente_vendedor_admin" ON "public"."encomendas" FOR SELECT TO "authenticated" USING ((("cliente_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "encomendas"."vendedor_id") AND ("v"."user_id" = "auth"."uid"())))) OR "public"."eh_admin"()));



ALTER TABLE "public"."enderecos_entrega_encomenda" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enderecos_entrega_encomenda_leitura_participantes" ON "public"."enderecos_entrega_encomenda" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."encomendas" "e"
  WHERE (("e"."id" = "enderecos_entrega_encomenda"."encomenda_id") AND (("e"."cliente_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."vendedores" "v"
          WHERE (("v"."id" = "e"."vendedor_id") AND ("v"."user_id" = "auth"."uid"())))) OR "public"."eh_admin"())))));



ALTER TABLE "public"."eventos_documento_parceiro_entrega" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "eventos_documento_parceiro_leitura" ON "public"."eventos_documento_parceiro_entrega" FOR SELECT TO "authenticated" USING (("public"."eh_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."parceiros_entrega" "p"
  WHERE (("p"."id" = "eventos_documento_parceiro_entrega"."parceiro_id") AND ("p"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."eventos_encomenda" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "eventos_encomenda_leitura_cliente_vendedor_admin" ON "public"."eventos_encomenda" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."encomendas" "e"
  WHERE (("e"."id" = "eventos_encomenda"."encomenda_id") AND (("e"."cliente_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."vendedores" "v"
          WHERE (("v"."id" = "e"."vendedor_id") AND ("v"."user_id" = "auth"."uid"())))) OR "public"."eh_admin"())))));



ALTER TABLE "public"."eventos_pagamento" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "eventos_pagamento_admin_leitura" ON "public"."eventos_pagamento" FOR SELECT TO "authenticated" USING ("public"."eh_admin"());



ALTER TABLE "public"."favoritos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "favoritos_proprios" ON "public"."favoritos" TO "authenticated" USING ((("utilizador_id" = "auth"."uid"()) OR "public"."eh_admin"())) WITH CHECK ((("utilizador_id" = "auth"."uid"()) OR "public"."eh_admin"()));



ALTER TABLE "public"."historico_contactos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "historico_contactos_criar_cliente" ON "public"."historico_contactos" FOR INSERT TO "authenticated" WITH CHECK ((("cliente_id" = "auth"."uid"()) OR "public"."eh_admin"()));



CREATE POLICY "historico_contactos_participantes" ON "public"."historico_contactos" FOR SELECT TO "authenticated" USING ((("cliente_id" = "auth"."uid"()) OR "public"."eh_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "historico_contactos"."vendedor_id") AND ("v"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."historico_contactos_servicos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "historico_contactos_servicos_criar_cliente" ON "public"."historico_contactos_servicos" FOR INSERT TO "authenticated" WITH CHECK ((("cliente_id" = "auth"."uid"()) OR "public"."eh_admin"()));



CREATE POLICY "historico_contactos_servicos_participantes" ON "public"."historico_contactos_servicos" FOR SELECT TO "authenticated" USING ((("cliente_id" = "auth"."uid"()) OR "public"."eh_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "historico_contactos_servicos"."vendedor_id") AND ("v"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."historico_pesquisas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "historico_pesquisas_proprio" ON "public"."historico_pesquisas" TO "authenticated" USING ((("cliente_id" = "auth"."uid"()) OR "public"."eh_admin"())) WITH CHECK ((("cliente_id" = "auth"."uid"()) OR "public"."eh_admin"()));



ALTER TABLE "public"."idempotencia_checkout_encomenda" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."idempotencia_intervencao_entrega_admin" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."incidentes_operacionais_entrega" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."itens_encomenda" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "itens_encomenda_leitura_cliente_vendedor_admin" ON "public"."itens_encomenda" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."encomendas" "e"
  WHERE (("e"."id" = "itens_encomenda"."encomenda_id") AND (("e"."cliente_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."vendedores" "v"
          WHERE (("v"."id" = "e"."vendedor_id") AND ("v"."user_id" = "auth"."uid"())))) OR "public"."eh_admin"())))));



ALTER TABLE "public"."movimentos_financeiros" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "movimentos_financeiros_admin_leitura" ON "public"."movimentos_financeiros" FOR SELECT TO "authenticated" USING ("public"."eh_admin"());



ALTER TABLE "public"."municipios_angola" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notificacoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notificacoes_leitura_propria" ON "public"."notificacoes" FOR SELECT TO "authenticated" USING (("utilizador_id" = "auth"."uid"()));



ALTER TABLE "public"."pagamentos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pagamentos_admin_leitura" ON "public"."pagamentos" FOR SELECT TO "authenticated" USING ("public"."eh_admin"());



ALTER TABLE "public"."parceiros_entrega" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "parceiros_entrega_dono_ou_admin" ON "public"."parceiros_entrega" TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."eh_admin"())) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."eh_admin"()));



ALTER TABLE "public"."produtos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "produtos publicos apenas de vendedores aprovados" ON "public"."produtos" FOR SELECT USING ((("disponivel" = true) AND ("publicado" = true) AND "public"."is_vendedor_publico_aprovado"("vendedor_id")));



CREATE POLICY "produtos_gerir_proprios" ON "public"."produtos" TO "authenticated" USING (("public"."eh_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "produtos"."vendedor_id") AND ("v"."user_id" = "auth"."uid"())))))) WITH CHECK (("public"."eh_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "produtos"."vendedor_id") AND ("v"."user_id" = "auth"."uid"()) AND ("v"."status_aprovacao" = 'aprovado'::"text") AND ("v"."conta_ativa" IS NOT FALSE))))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."provincias_angola" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public pode inserir historico pesquisas exceto admin" ON "public"."historico_pesquisas" FOR INSERT WITH CHECK ((("auth"."uid"() IS NULL) OR ("public"."is_admin_atual"() = false)));



ALTER TABLE "public"."reembolsos_pagamento" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reembolsos_pagamento_admin_leitura" ON "public"."reembolsos_pagamento" FOR SELECT TO "authenticated" USING ("public"."eh_admin"());



CREATE POLICY "repasses_admin_leitura" ON "public"."repasses_vendedor" FOR SELECT TO "authenticated" USING ("public"."eh_admin"());



ALTER TABLE "public"."repasses_vendedor" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."requisitos_documentos_entrega" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."servicos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "servicos publicos apenas de vendedores aprovados" ON "public"."servicos" FOR SELECT USING ((("disponivel" = true) AND ("publicado" = true) AND "public"."is_vendedor_publico_aprovado"("vendedor_id")));



CREATE POLICY "servicos_gerir_proprios" ON "public"."servicos" TO "authenticated" USING (("public"."eh_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "servicos"."vendedor_id") AND ("v"."user_id" = "auth"."uid"())))))) WITH CHECK (("public"."eh_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "servicos"."vendedor_id") AND ("v"."user_id" = "auth"."uid"()) AND ("v"."status_aprovacao" = 'aprovado'::"text") AND ("v"."conta_ativa" IS NOT FALSE))))));



CREATE POLICY "servicos_publicos" ON "public"."servicos" FOR SELECT TO "authenticated", "anon" USING ((("publicado" AND "disponivel") OR (EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "servicos"."vendedor_id") AND (("v"."user_id" = "auth"."uid"()) OR "public"."eh_admin"()))))));



ALTER TABLE "public"."tentativas_pagamento" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tentativas_pagamento_admin_leitura" ON "public"."tentativas_pagamento" FOR SELECT TO "authenticated" USING ("public"."eh_admin"());



ALTER TABLE "public"."veiculos_entrega" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "veiculos_entrega_dono_ou_admin" ON "public"."veiculos_entrega" TO "authenticated" USING (("public"."eh_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."parceiros_entrega" "p"
  WHERE (("p"."id" = "veiculos_entrega"."parceiro_id") AND ("p"."user_id" = "auth"."uid"())))))) WITH CHECK (("public"."eh_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."parceiros_entrega" "p"
  WHERE (("p"."id" = "veiculos_entrega"."parceiro_id") AND ("p"."user_id" = "auth"."uid"()))))));



CREATE POLICY "vendedor aprovado pode atualizar seus produtos" ON "public"."produtos" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "produtos"."vendedor_id") AND ("v"."user_id" = "auth"."uid"()) AND ("v"."status_aprovacao" = 'aprovado'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "produtos"."vendedor_id") AND ("v"."user_id" = "auth"."uid"()) AND ("v"."status_aprovacao" = 'aprovado'::"text")))));



CREATE POLICY "vendedor aprovado pode atualizar seus servicos" ON "public"."servicos" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "servicos"."vendedor_id") AND ("v"."user_id" = "auth"."uid"()) AND ("v"."status_aprovacao" = 'aprovado'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "servicos"."vendedor_id") AND ("v"."user_id" = "auth"."uid"()) AND ("v"."status_aprovacao" = 'aprovado'::"text")))));



CREATE POLICY "vendedor aprovado pode criar produto" ON "public"."produtos" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "produtos"."vendedor_id") AND ("v"."user_id" = "auth"."uid"()) AND ("v"."status_aprovacao" = 'aprovado'::"text")))));



CREATE POLICY "vendedor aprovado pode criar servico" ON "public"."servicos" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "servicos"."vendedor_id") AND ("v"."user_id" = "auth"."uid"()) AND ("v"."status_aprovacao" = 'aprovado'::"text")))));



CREATE POLICY "vendedor aprovado pode eliminar seus produtos" ON "public"."produtos" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "produtos"."vendedor_id") AND ("v"."user_id" = "auth"."uid"()) AND ("v"."status_aprovacao" = 'aprovado'::"text")))));



CREATE POLICY "vendedor aprovado pode eliminar seus servicos" ON "public"."servicos" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "servicos"."vendedor_id") AND ("v"."user_id" = "auth"."uid"()) AND ("v"."status_aprovacao" = 'aprovado'::"text")))));



CREATE POLICY "vendedor pode ver seus produtos" ON "public"."produtos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "produtos"."vendedor_id") AND ("v"."user_id" = "auth"."uid"())))));



CREATE POLICY "vendedor pode ver seus servicos" ON "public"."servicos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendedores" "v"
  WHERE (("v"."id" = "servicos"."vendedor_id") AND ("v"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."vendedores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vendedores_atualizar_proprio" ON "public"."vendedores" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "vendedores_criar_proprio" ON "public"."vendedores" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "vendedores_leitura_publica" ON "public"."vendedores" FOR SELECT TO "authenticated", "anon" USING ((("status_aprovacao" = 'aprovado'::"text") AND (COALESCE("conta_ativa", false) = true)));



ALTER TABLE "public"."versoes_documento_parceiro_entrega" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "versoes_documento_parceiro_leitura" ON "public"."versoes_documento_parceiro_entrega" FOR SELECT TO "authenticated" USING (("public"."eh_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."parceiros_entrega" "p"
  WHERE (("p"."id" = "versoes_documento_parceiro_entrega"."parceiro_id") AND ("p"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."visualizacoes_produtos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "visualizacoes_produtos_proprias" ON "public"."visualizacoes_produtos" TO "authenticated" USING ((("cliente_id" = "auth"."uid"()) OR "public"."eh_admin"())) WITH CHECK ((("cliente_id" = "auth"."uid"()) OR "public"."eh_admin"()));



ALTER TABLE "public"."visualizacoes_servicos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "visualizacoes_servicos_proprias" ON "public"."visualizacoes_servicos" TO "authenticated" USING ((("cliente_id" = "auth"."uid"()) OR "public"."eh_admin"())) WITH CHECK ((("cliente_id" = "auth"."uid"()) OR "public"."eh_admin"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TABLE "public"."disputas_encomenda" TO "service_role";
GRANT SELECT ON TABLE "public"."disputas_encomenda" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."abrir_disputa_encomenda"("p_encomenda_id" "uuid", "p_tipo_problema" "text", "p_descricao" "text", "p_valor_reclamado_centimos" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."abrir_disputa_encomenda"("p_encomenda_id" "uuid", "p_tipo_problema" "text", "p_descricao" "text", "p_valor_reclamado_centimos" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."abrir_disputa_encomenda"("p_encomenda_id" "uuid", "p_tipo_problema" "text", "p_descricao" "text", "p_valor_reclamado_centimos" bigint) TO "service_role";



GRANT ALL ON TABLE "public"."atribuicoes_entrega_encomenda" TO "service_role";
GRANT SELECT ON TABLE "public"."atribuicoes_entrega_encomenda" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."aceitar_atribuicao_entrega"("p_atribuicao_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."aceitar_atribuicao_entrega"("p_atribuicao_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."aceitar_atribuicao_entrega"("p_atribuicao_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."apagar_minha_conta"() TO "anon";
GRANT ALL ON FUNCTION "public"."apagar_minha_conta"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apagar_minha_conta"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."assumir_disputa_admin"("p_disputa_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assumir_disputa_admin"("p_disputa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assumir_disputa_admin"("p_disputa_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."atribuir_entregador_encomenda"("p_encomenda_id" "uuid", "p_parceiro_id" "uuid", "p_veiculo_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."atribuir_entregador_encomenda"("p_encomenda_id" "uuid", "p_parceiro_id" "uuid", "p_veiculo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."atribuir_entregador_encomenda"("p_encomenda_id" "uuid", "p_parceiro_id" "uuid", "p_veiculo_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."areas_cobertura_entrega" TO "anon";
GRANT ALL ON TABLE "public"."areas_cobertura_entrega" TO "authenticated";
GRANT ALL ON TABLE "public"."areas_cobertura_entrega" TO "service_role";



REVOKE ALL ON FUNCTION "public"."atualizar_area_cobertura_entrega"("p_area_id" "uuid", "p_provincia" "text", "p_municipio" "text", "p_bairro" "text", "p_ativo" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."atualizar_area_cobertura_entrega"("p_area_id" "uuid", "p_provincia" "text", "p_municipio" "text", "p_bairro" "text", "p_ativo" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_area_cobertura_entrega"("p_area_id" "uuid", "p_provincia" "text", "p_municipio" "text", "p_bairro" "text", "p_ativo" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_atribuicao_entrega"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_atribuicao_entrega"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_atribuicao_entrega"() TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_codigo_entrega"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_codigo_entrega"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_codigo_entrega"() TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_codigo_levantamento"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_codigo_levantamento"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_codigo_levantamento"() TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_documentos_vendedor"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_documentos_vendedor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_documentos_vendedor"() TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_encomenda"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_encomenda"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_encomenda"() TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_financeiro"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_financeiro"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_financeiro"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."atualizar_atualizado_em_incidente_operacional_entrega"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_incidente_operacional_entrega"() TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_parceiros_entrega"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_parceiros_entrega"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_parceiros_entrega"() TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_taxonomia_territorial"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_taxonomia_territorial"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em_taxonomia_territorial"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."atualizar_estado_vendedor_admin"("p_vendedor_id" "uuid", "p_estado" "text", "p_motivo_rejeicao" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."atualizar_estado_vendedor_admin"("p_vendedor_id" "uuid", "p_estado" "text", "p_motivo_rejeicao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_estado_vendedor_admin"("p_vendedor_id" "uuid", "p_estado" "text", "p_motivo_rejeicao" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."atualizar_plano_vendedor_admin"("p_vendedor_id" "uuid", "p_plano" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."atualizar_plano_vendedor_admin"("p_vendedor_id" "uuid", "p_plano" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_plano_vendedor_admin"("p_vendedor_id" "uuid", "p_plano" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."atualizar_requisito_documento_entrega_em"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."atualizar_requisito_documento_entrega_em"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."atualizar_verificacao_vendedor_admin"("p_vendedor_id" "uuid", "p_verificado" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."atualizar_verificacao_vendedor_admin"("p_vendedor_id" "uuid", "p_verificado" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_verificacao_vendedor_admin"("p_vendedor_id" "uuid", "p_verificado" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."avaliar_compatibilidade_veiculo_encomenda"("p_veiculo_id" "uuid", "p_encomenda_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."avaliar_compatibilidade_veiculo_encomenda"("p_veiculo_id" "uuid", "p_encomenda_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."bloquear_conclusao_com_disputa_ativa"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bloquear_conclusao_com_disputa_ativa"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."calcular_hash_intencao_checkout"("p_intencao" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."calcular_hash_intencao_checkout"("p_intencao" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."calcular_requisitos_logisticos_encomenda"("p_encomenda_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."calcular_requisitos_logisticos_encomenda"("p_encomenda_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."calcular_valores_financeiros_efetivos"("p_pagamento_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."calcular_valores_financeiros_efetivos"("p_pagamento_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."confirmar_chegada_destino_entregador"("p_atribuicao_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirmar_chegada_destino_entregador"("p_atribuicao_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirmar_chegada_destino_entregador"("p_atribuicao_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."confirmar_chegada_origem_entregador"("p_atribuicao_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirmar_chegada_origem_entregador"("p_atribuicao_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirmar_chegada_origem_entregador"("p_atribuicao_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."confirmar_recolha_encomenda_vendedor"("p_atribuicao_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirmar_recolha_encomenda_vendedor"("p_atribuicao_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirmar_recolha_encomenda_vendedor"("p_atribuicao_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."consultar_estado_codigo_levantamento_admin"("p_encomenda_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consultar_estado_codigo_levantamento_admin"("p_encomenda_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."consultar_estado_codigo_levantamento_admin"("p_encomenda_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."contar_notificacoes_nao_lidas"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."contar_notificacoes_nao_lidas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."contar_notificacoes_nao_lidas"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."criar_area_cobertura_entrega"("p_provincia" "text", "p_municipio" "text", "p_bairro" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."criar_area_cobertura_entrega"("p_provincia" "text", "p_municipio" "text", "p_bairro" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."criar_area_cobertura_entrega"("p_provincia" "text", "p_municipio" "text", "p_bairro" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."criar_encomenda_entrega"("p_itens" "jsonb", "p_destinatario_nome" "text", "p_destinatario_telefone" "text", "p_provincia" "text", "p_municipio" "text", "p_bairro" "text", "p_endereco_detalhado" "text", "p_ponto_referencia" "text", "p_instrucoes_entrega" "text", "p_observacoes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."criar_encomenda_entrega"("p_itens" "jsonb", "p_destinatario_nome" "text", "p_destinatario_telefone" "text", "p_provincia" "text", "p_municipio" "text", "p_bairro" "text", "p_endereco_detalhado" "text", "p_ponto_referencia" "text", "p_instrucoes_entrega" "text", "p_observacoes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."criar_encomenda_entrega"("p_itens" "jsonb", "p_destinatario_nome" "text", "p_destinatario_telefone" "text", "p_provincia" "text", "p_municipio" "text", "p_bairro" "text", "p_endereco_detalhado" "text", "p_ponto_referencia" "text", "p_instrucoes_entrega" "text", "p_observacoes" "text", "p_idempotency_key" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."criar_encomenda_entrega"("p_itens" "jsonb", "p_destinatario_nome" "text", "p_destinatario_telefone" "text", "p_provincia" "text", "p_municipio" "text", "p_bairro" "text", "p_endereco_detalhado" "text", "p_ponto_referencia" "text", "p_instrucoes_entrega" "text", "p_observacoes" "text", "p_idempotency_key" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."criar_encomenda_entrega"("p_itens" "jsonb", "p_destinatario_nome" "text", "p_destinatario_telefone" "text", "p_provincia" "text", "p_municipio" "text", "p_bairro" "text", "p_endereco_detalhado" "text", "p_ponto_referencia" "text", "p_instrucoes_entrega" "text", "p_observacoes" "text", "p_idempotency_key" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."criar_encomenda_entrega_base_v1"("p_itens" "jsonb", "p_destinatario_nome" "text", "p_destinatario_telefone" "text", "p_provincia" "text", "p_municipio" "text", "p_bairro" "text", "p_endereco_detalhado" "text", "p_ponto_referencia" "text", "p_instrucoes_entrega" "text", "p_observacoes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."criar_encomenda_entrega_base_v1"("p_itens" "jsonb", "p_destinatario_nome" "text", "p_destinatario_telefone" "text", "p_provincia" "text", "p_municipio" "text", "p_bairro" "text", "p_endereco_detalhado" "text", "p_ponto_referencia" "text", "p_instrucoes_entrega" "text", "p_observacoes" "text") TO "service_role";



GRANT ALL ON TABLE "public"."encomendas" TO "service_role";
GRANT SELECT ON TABLE "public"."encomendas" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."criar_encomenda_levantamento"("p_itens" "jsonb", "p_modalidade" "text", "p_nome_destinatario" "text", "p_telefone_destinatario" "text", "p_observacoes_cliente" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."criar_encomenda_levantamento"("p_itens" "jsonb", "p_modalidade" "text", "p_nome_destinatario" "text", "p_telefone_destinatario" "text", "p_observacoes_cliente" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."criar_encomenda_levantamento"("p_itens" "jsonb", "p_modalidade" "text", "p_nome_destinatario" "text", "p_telefone_destinatario" "text", "p_observacoes_cliente" "text", "p_idempotency_key" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."criar_encomenda_levantamento"("p_itens" "jsonb", "p_modalidade" "text", "p_nome_destinatario" "text", "p_telefone_destinatario" "text", "p_observacoes_cliente" "text", "p_idempotency_key" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."criar_encomenda_levantamento"("p_itens" "jsonb", "p_modalidade" "text", "p_nome_destinatario" "text", "p_telefone_destinatario" "text", "p_observacoes_cliente" "text", "p_idempotency_key" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."criar_encomenda_levantamento_base_v1"("p_itens" "jsonb", "p_modalidade" "text", "p_nome_destinatario" "text", "p_telefone_destinatario" "text", "p_observacoes_cliente" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."criar_encomenda_levantamento_base_v1"("p_itens" "jsonb", "p_modalidade" "text", "p_nome_destinatario" "text", "p_telefone_destinatario" "text", "p_observacoes_cliente" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."criar_notificacao"("p_utilizador_id" "uuid", "p_contexto" "text", "p_tipo" "text", "p_titulo" "text", "p_mensagem" "text", "p_entidade_tipo" "text", "p_entidade_id" "uuid", "p_url_destino" "text", "p_metadata" "jsonb", "p_chave" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."criar_notificacao"("p_utilizador_id" "uuid", "p_contexto" "text", "p_tipo" "text", "p_titulo" "text", "p_mensagem" "text", "p_entidade_tipo" "text", "p_entidade_id" "uuid", "p_url_destino" "text", "p_metadata" "jsonb", "p_chave" "text") TO "service_role";



GRANT ALL ON TABLE "public"."pagamentos" TO "service_role";
GRANT SELECT ON TABLE "public"."pagamentos" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."criar_pagamento_encomenda"("p_encomenda_id" "uuid", "p_chave_idempotencia" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."criar_pagamento_encomenda"("p_encomenda_id" "uuid", "p_chave_idempotencia" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."criar_pagamento_encomenda"("p_encomenda_id" "uuid", "p_chave_idempotencia" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."criar_pedido_parceiro_entrega"("p_dados" "jsonb", "p_veiculo" "jsonb", "p_documentos" "jsonb", "p_area" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."criar_pedido_parceiro_entrega"("p_dados" "jsonb", "p_veiculo" "jsonb", "p_documentos" "jsonb", "p_area" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."criar_pedido_parceiro_entrega"("p_dados" "jsonb", "p_veiculo" "jsonb", "p_documentos" "jsonb", "p_area" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."tentativas_pagamento" TO "service_role";
GRANT SELECT ON TABLE "public"."tentativas_pagamento" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."criar_tentativa_pagamento"("p_pagamento_id" "uuid", "p_metodo" "text", "p_chave_idempotencia" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."criar_tentativa_pagamento"("p_pagamento_id" "uuid", "p_metodo" "text", "p_chave_idempotencia" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."criar_tentativa_pagamento"("p_pagamento_id" "uuid", "p_metodo" "text", "p_chave_idempotencia" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."criar_versao_inicial_documento_parceiro"() TO "anon";
GRANT ALL ON FUNCTION "public"."criar_versao_inicial_documento_parceiro"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."criar_versao_inicial_documento_parceiro"() TO "service_role";



GRANT ALL ON FUNCTION "public"."desativar_minha_conta"() TO "anon";
GRANT ALL ON FUNCTION "public"."desativar_minha_conta"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."desativar_minha_conta"() TO "service_role";



GRANT ALL ON FUNCTION "public"."destacar_produto_gratis"("produto_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."destacar_produto_gratis"("produto_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."destacar_produto_gratis"("produto_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."destacar_servico_gratis"("servico_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."destacar_servico_gratis"("servico_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."destacar_servico_gratis"("servico_uuid" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."eh_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."eh_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."eh_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."eh_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."eliminar_vendedor_admin"("p_vendedor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."eliminar_vendedor_admin"("p_vendedor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."eliminar_vendedor_admin"("p_vendedor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."encomenda_tem_disputa_ativa"("p_encomenda_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."encomenda_tem_disputa_ativa"("p_encomenda_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."entregador_pode_receber_entregas"("p_parceiro_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."entregador_pode_receber_entregas"("p_parceiro_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."expirar_destaques_antigos"() TO "anon";
GRANT ALL ON FUNCTION "public"."expirar_destaques_antigos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."expirar_destaques_antigos"() TO "service_role";



GRANT ALL ON TABLE "public"."clientes" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."clientes" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."garantir_perfil_comprador"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."garantir_perfil_comprador"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."garantir_perfil_comprador"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."gerar_codigo_publico_encomenda"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gerar_codigo_publico_encomenda"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."gerar_otp_entrega_aleatorio"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gerar_otp_entrega_aleatorio"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."gerar_otp_levantamento_aleatorio"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gerar_otp_levantamento_aleatorio"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."gerar_referencia_pagamento_interna"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gerar_referencia_pagamento_interna"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."gerar_referencia_tentativa_pagamento_interna"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gerar_referencia_tentativa_pagamento_interna"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_profile"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."hash_intervencao_entrega_admin"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hash_intervencao_entrega_admin"("p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."incrementar_clique_whatsapp_produto"("produto_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."incrementar_clique_whatsapp_produto"("produto_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."incrementar_clique_whatsapp_produto"("produto_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."incrementar_clique_whatsapp_servico"("servico_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."incrementar_clique_whatsapp_servico"("servico_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."incrementar_clique_whatsapp_servico"("servico_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."incrementar_visualizacao_produto"("produto_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."incrementar_visualizacao_produto"("produto_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."incrementar_visualizacao_produto"("produto_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."incrementar_visualizacao_servico"("servico_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."incrementar_visualizacao_servico"("servico_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."incrementar_visualizacao_servico"("servico_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_atual"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_atual"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_atual"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_dono_vendedor"("vendedor_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_dono_vendedor"("vendedor_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_dono_vendedor"("vendedor_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_vendedor_aprovado"("vendedor_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_vendedor_aprovado"("vendedor_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_vendedor_aprovado"("vendedor_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_vendedor_publico_aprovado"("vendedor_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_vendedor_publico_aprovado"("vendedor_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_vendedor_publico_aprovado"("vendedor_uuid" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."libertar_atribuicao_entrega_admin"("p_atribuicao_id" "uuid", "p_motivo" "text", "p_chave_idempotencia" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."libertar_atribuicao_entrega_admin"("p_atribuicao_id" "uuid", "p_motivo" "text", "p_chave_idempotencia" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."libertar_atribuicao_entrega_admin"("p_atribuicao_id" "uuid", "p_motivo" "text", "p_chave_idempotencia" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_areas_cobertura_entregador_admin"("p_parceiro_id" "uuid", "p_limite" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_areas_cobertura_entregador_admin"("p_parceiro_id" "uuid", "p_limite" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_areas_cobertura_entregador_admin"("p_parceiro_id" "uuid", "p_limite" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_compatibilidade_logistica_encomenda_admin"("p_encomenda_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_compatibilidade_logistica_encomenda_admin"("p_encomenda_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_compatibilidade_logistica_encomenda_admin"("p_encomenda_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_compradores_admin"("p_tipo_comprador" "text", "p_conta_ativa" boolean, "p_provincia" "text", "p_municipio" "text", "p_com_disputas" boolean, "p_com_cancelamentos" boolean, "p_registo_recente" boolean, "p_pesquisa" "text", "p_limite" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_compradores_admin"("p_tipo_comprador" "text", "p_conta_ativa" boolean, "p_provincia" "text", "p_municipio" "text", "p_com_disputas" boolean, "p_com_cancelamentos" boolean, "p_registo_recente" boolean, "p_pesquisa" "text", "p_limite" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_compradores_admin"("p_tipo_comprador" "text", "p_conta_ativa" boolean, "p_provincia" "text", "p_municipio" "text", "p_com_disputas" boolean, "p_com_cancelamentos" boolean, "p_registo_recente" boolean, "p_pesquisa" "text", "p_limite" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_contactos_produtos_vendedor"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_contactos_produtos_vendedor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_contactos_produtos_vendedor"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_contactos_servicos_vendedor"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_contactos_servicos_vendedor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_contactos_servicos_vendedor"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_disputas_admin"("p_estado" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_disputas_admin"("p_estado" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_disputas_admin"("p_estado" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_disputas_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_disputas_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_disputas_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_documentos_entregador_admin"("p_parceiro_id" "uuid", "p_limite" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_documentos_entregador_admin"("p_parceiro_id" "uuid", "p_limite" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_documentos_entregador_admin"("p_parceiro_id" "uuid", "p_limite" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_encomendas_admin"("p_estado" "text", "p_cliente_id" "uuid", "p_vendedor_id" "uuid", "p_estado_pagamento" "text", "p_com_disputa" boolean, "p_de" timestamp with time zone, "p_ate" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_encomendas_admin"("p_estado" "text", "p_cliente_id" "uuid", "p_vendedor_id" "uuid", "p_estado_pagamento" "text", "p_com_disputa" boolean, "p_de" timestamp with time zone, "p_ate" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_encomendas_admin"("p_estado" "text", "p_cliente_id" "uuid", "p_vendedor_id" "uuid", "p_estado_pagamento" "text", "p_com_disputa" boolean, "p_de" timestamp with time zone, "p_ate" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_encomendas_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_encomendas_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_encomendas_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_financeiro_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_financeiro_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_financeiro_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_historico_documental_entregador_admin"("p_parceiro_id" "uuid", "p_limite" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_historico_documental_entregador_admin"("p_parceiro_id" "uuid", "p_limite" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_historico_documental_entregador_admin"("p_parceiro_id" "uuid", "p_limite" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_historico_documental_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_historico_documental_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_historico_documental_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_municipios_angola"("p_provincia_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_municipios_angola"("p_provincia_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."listar_municipios_angola"("p_provincia_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."listar_municipios_angola"("p_provincia_id" "uuid") TO "authenticated";



GRANT ALL ON TABLE "public"."notificacoes" TO "service_role";
GRANT SELECT ON TABLE "public"."notificacoes" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."listar_notificacoes"("p_limite" integer, "p_antes_de" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_notificacoes"("p_limite" integer, "p_antes_de" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_notificacoes"("p_limite" integer, "p_antes_de" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_pagamentos_cliente"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_pagamentos_cliente"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_pagamentos_cliente"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_produtos_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_produtos_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_produtos_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_provincias_angola"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_provincias_angola"() TO "service_role";
GRANT ALL ON FUNCTION "public"."listar_provincias_angola"() TO "anon";
GRANT ALL ON FUNCTION "public"."listar_provincias_angola"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."listar_resumo_financeiro_vendedor"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_resumo_financeiro_vendedor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_resumo_financeiro_vendedor"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_servicos_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_servicos_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_servicos_vendedor_admin"("p_vendedor_id" "uuid", "p_limite" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_tarefas_entregador"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_tarefas_entregador"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_tarefas_entregador"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_utilizadores_admin"("p_papel" "text", "p_estado" "text", "p_provincia" "text", "p_registo_recente" boolean, "p_pesquisa" "text", "p_limite" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_utilizadores_admin"("p_papel" "text", "p_estado" "text", "p_provincia" "text", "p_registo_recente" boolean, "p_pesquisa" "text", "p_limite" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_utilizadores_admin"("p_papel" "text", "p_estado" "text", "p_provincia" "text", "p_registo_recente" boolean, "p_pesquisa" "text", "p_limite" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_veiculos_compativeis_encomenda"("p_encomenda_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_veiculos_compativeis_encomenda"("p_encomenda_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_veiculos_entregador_admin"("p_parceiro_id" "uuid", "p_limite" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_veiculos_entregador_admin"("p_parceiro_id" "uuid", "p_limite" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_veiculos_entregador_admin"("p_parceiro_id" "uuid", "p_limite" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."listar_vendedores_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listar_vendedores_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."listar_vendedores_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."marcar_notificacao_como_lida"("p_notificacao_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."marcar_notificacao_como_lida"("p_notificacao_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."marcar_notificacao_como_lida"("p_notificacao_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."marcar_todas_notificacoes_como_lidas"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."marcar_todas_notificacoes_como_lidas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."marcar_todas_notificacoes_como_lidas"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."motivos_compatibilidade_veiculo_encomenda"("p_veiculo_id" "uuid", "p_encomenda_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."motivos_compatibilidade_veiculo_encomenda"("p_veiculo_id" "uuid", "p_encomenda_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."motivos_elegibilidade_entregador"("p_parceiro_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."motivos_elegibilidade_entregador"("p_parceiro_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."motivos_operacionais_veiculo_entrega"("p_veiculo_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."motivos_operacionais_veiculo_entrega"("p_veiculo_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalizar_itens_checkout_idempotencia"("p_itens" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalizar_itens_checkout_idempotencia"("p_itens" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalizar_texto_territorial"("p_texto" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalizar_texto_territorial"("p_texto" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."notificar_ciclo_entrega_fase_1"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notificar_ciclo_entrega_fase_1"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notificar_evento_encomenda"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notificar_evento_encomenda"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notificar_intervencao_admin_entrega"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notificar_intervencao_admin_entrega"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notificar_recolha_entrega_fase_2"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notificar_recolha_entrega_fase_2"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_atribuicao_entrega_encomenda_admin"("p_encomenda_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_atribuicao_entrega_encomenda_admin"("p_encomenda_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_atribuicao_entrega_encomenda_admin"("p_encomenda_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_codigo_entrega_cliente"("p_encomenda_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_codigo_entrega_cliente"("p_encomenda_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_codigo_entrega_cliente"("p_encomenda_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_codigo_levantamento_cliente"("p_encomenda_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_codigo_levantamento_cliente"("p_encomenda_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_codigo_levantamento_cliente"("p_encomenda_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_comprador_admin"("p_cliente_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_comprador_admin"("p_cliente_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_comprador_admin"("p_cliente_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_disputa_admin"("p_disputa_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_disputa_admin"("p_disputa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_disputa_admin"("p_disputa_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_documentos_legados_vendedor"("p_vendedor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_documentos_legados_vendedor"("p_vendedor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."obter_documentos_legados_vendedor"("p_vendedor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_documentos_legados_vendedor"("p_vendedor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_elegibilidade_entregador_admin"("p_parceiro_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_elegibilidade_entregador_admin"("p_parceiro_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_elegibilidade_entregador_admin"("p_parceiro_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_encomenda_admin"("p_encomenda_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_encomenda_admin"("p_encomenda_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_encomenda_admin"("p_encomenda_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_entrega_encomenda_participante"("p_encomenda_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_entrega_encomenda_participante"("p_encomenda_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_entrega_encomenda_participante"("p_encomenda_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_entregador_admin"("p_parceiro_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_entregador_admin"("p_parceiro_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_entregador_admin"("p_parceiro_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_incidente_operacional_entrega_admin"("p_encomenda_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_incidente_operacional_entrega_admin"("p_encomenda_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_incidente_operacional_entrega_admin"("p_encomenda_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_meu_vendedor"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_meu_vendedor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_meu_vendedor"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_pagamento_encomenda_cliente"("p_encomenda_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_pagamento_encomenda_cliente"("p_encomenda_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_pagamento_encomenda_cliente"("p_encomenda_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_resumo_financeiro_encomenda_vendedor"("p_encomenda_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_resumo_financeiro_encomenda_vendedor"("p_encomenda_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_resumo_financeiro_encomenda_vendedor"("p_encomenda_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_tarefa_entregador"("p_atribuicao_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_tarefa_entregador"("p_atribuicao_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_tarefa_entregador"("p_atribuicao_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_vendedor_admin"("p_vendedor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_vendedor_admin"("p_vendedor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_vendedor_admin"("p_vendedor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."preencher_snapshot_logistico_item_encomenda"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."preencher_snapshot_logistico_item_encomenda"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proteger_analise_documento_vendedor"() TO "anon";
GRANT ALL ON FUNCTION "public"."proteger_analise_documento_vendedor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proteger_analise_documento_vendedor"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proteger_auditoria_administrativa_append_only"() TO "anon";
GRANT ALL ON FUNCTION "public"."proteger_auditoria_administrativa_append_only"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proteger_auditoria_administrativa_append_only"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proteger_campos_vendedor"() TO "anon";
GRANT ALL ON FUNCTION "public"."proteger_campos_vendedor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proteger_campos_vendedor"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proteger_estado_parceiro_entrega"() TO "anon";
GRANT ALL ON FUNCTION "public"."proteger_estado_parceiro_entrega"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proteger_estado_parceiro_entrega"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proteger_eventos_documento_parceiro"() TO "anon";
GRANT ALL ON FUNCTION "public"."proteger_eventos_documento_parceiro"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proteger_eventos_documento_parceiro"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proteger_eventos_pagamento_append_only"() TO "anon";
GRANT ALL ON FUNCTION "public"."proteger_eventos_pagamento_append_only"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proteger_eventos_pagamento_append_only"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."proteger_identidade_verificada_vendedor"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."proteger_identidade_verificada_vendedor"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."proteger_marco_aprovacao_vendedor"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."proteger_marco_aprovacao_vendedor"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."proteger_movimentos_financeiros_append_only"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."proteger_movimentos_financeiros_append_only"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."proteger_nome_verificado_parceiro_entrega"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."proteger_nome_verificado_parceiro_entrega"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."proteger_snapshot_destino_entrega_encomenda"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."proteger_snapshot_destino_entrega_encomenda"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proteger_verificacao_logistica"() TO "anon";
GRANT ALL ON FUNCTION "public"."proteger_verificacao_logistica"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proteger_verificacao_logistica"() TO "service_role";



GRANT ALL ON FUNCTION "public"."proteger_versao_documento_parceiro"() TO "anon";
GRANT ALL ON FUNCTION "public"."proteger_versao_documento_parceiro"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proteger_versao_documento_parceiro"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."recusar_atribuicao_entrega"("p_atribuicao_id" "uuid", "p_motivo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recusar_atribuicao_entrega"("p_atribuicao_id" "uuid", "p_motivo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recusar_atribuicao_entrega"("p_atribuicao_id" "uuid", "p_motivo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reenviar_documento_parceiro"("p_documento_id" "uuid", "p_frente_path" "text", "p_verso_path" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reenviar_documento_parceiro"("p_documento_id" "uuid", "p_frente_path" "text", "p_verso_path" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reenviar_documento_parceiro"("p_documento_id" "uuid", "p_frente_path" "text", "p_verso_path" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reenviar_documento_parceiro"("p_documento_id" "uuid", "p_frente_path" "text", "p_verso_path" "text", "p_numero_documento" "text", "p_validade" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reenviar_documento_parceiro"("p_documento_id" "uuid", "p_frente_path" "text", "p_verso_path" "text", "p_numero_documento" "text", "p_validade" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reenviar_documento_parceiro"("p_documento_id" "uuid", "p_frente_path" "text", "p_verso_path" "text", "p_numero_documento" "text", "p_validade" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."registar_evento_documento_vendedor"() TO "anon";
GRANT ALL ON FUNCTION "public"."registar_evento_documento_vendedor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."registar_evento_documento_vendedor"() TO "service_role";



GRANT ALL ON TABLE "public"."incidentes_operacionais_entrega" TO "service_role";



REVOKE ALL ON FUNCTION "public"."registar_incidente_operacional_entrega_admin"("p_atribuicao_id" "uuid", "p_tipo" "text", "p_motivo" "text", "p_chave_idempotencia" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registar_incidente_operacional_entrega_admin"("p_atribuicao_id" "uuid", "p_tipo" "text", "p_motivo" "text", "p_chave_idempotencia" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registar_incidente_operacional_entrega_admin"("p_atribuicao_id" "uuid", "p_tipo" "text", "p_motivo" "text", "p_chave_idempotencia" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."registar_pagamento_na_entrega_entregador"("p_atribuicao_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registar_pagamento_na_entrega_entregador"("p_atribuicao_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registar_pagamento_na_entrega_entregador"("p_atribuicao_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."remover_area_cobertura_entrega"("p_area_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remover_area_cobertura_entrega"("p_area_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remover_area_cobertura_entrega"("p_area_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."remover_destaque_produto"("produto_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remover_destaque_produto"("produto_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remover_destaque_produto"("produto_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."remover_destaque_servico"("servico_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remover_destaque_servico"("servico_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remover_destaque_servico"("servico_uuid" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolver_disputa_reembolso_parcial_admin"("p_disputa_id" "uuid", "p_valor_produtos_centimos" bigint, "p_valor_entrega_centimos" bigint, "p_valor_taxa_processador_centimos" bigint, "p_observacao" "text", "p_chave_idempotencia" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolver_disputa_reembolso_parcial_admin"("p_disputa_id" "uuid", "p_valor_produtos_centimos" bigint, "p_valor_entrega_centimos" bigint, "p_valor_taxa_processador_centimos" bigint, "p_observacao" "text", "p_chave_idempotencia" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolver_disputa_reembolso_parcial_admin"("p_disputa_id" "uuid", "p_valor_produtos_centimos" bigint, "p_valor_entrega_centimos" bigint, "p_valor_taxa_processador_centimos" bigint, "p_observacao" "text", "p_chave_idempotencia" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolver_disputa_reembolso_total_admin"("p_disputa_id" "uuid", "p_observacao" "text", "p_chave_idempotencia" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolver_disputa_reembolso_total_admin"("p_disputa_id" "uuid", "p_observacao" "text", "p_chave_idempotencia" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolver_disputa_reembolso_total_admin"("p_disputa_id" "uuid", "p_observacao" "text", "p_chave_idempotencia" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolver_disputa_sem_reembolso_admin"("p_disputa_id" "uuid", "p_observacao" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolver_disputa_sem_reembolso_admin"("p_disputa_id" "uuid", "p_observacao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolver_disputa_sem_reembolso_admin"("p_disputa_id" "uuid", "p_observacao" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolver_incidente_operacional_entrega_admin"("p_incidente_id" "uuid", "p_observacao" "text", "p_chave_idempotencia" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolver_incidente_operacional_entrega_admin"("p_incidente_id" "uuid", "p_observacao" "text", "p_chave_idempotencia" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolver_incidente_operacional_entrega_admin"("p_incidente_id" "uuid", "p_observacao" "text", "p_chave_idempotencia" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolver_territorio_angola"("p_provincia" "text", "p_municipio" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolver_territorio_angola"("p_provincia" "text", "p_municipio" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sincronizar_analise_versao_documento_parceiro"() TO "anon";
GRANT ALL ON FUNCTION "public"."sincronizar_analise_versao_documento_parceiro"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sincronizar_analise_versao_documento_parceiro"() TO "service_role";



GRANT ALL ON TABLE "public"."parceiros_entrega" TO "anon";
GRANT ALL ON TABLE "public"."parceiros_entrega" TO "authenticated";
GRANT ALL ON TABLE "public"."parceiros_entrega" TO "service_role";



GRANT ALL ON FUNCTION "public"."submeter_pedido_parceiro_entrega"("p_parceiro_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."submeter_pedido_parceiro_entrega"("p_parceiro_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submeter_pedido_parceiro_entrega"("p_parceiro_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."territorio_angola_valido"("p_provincia" "text", "p_municipio" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."territorio_angola_valido"("p_provincia" "text", "p_municipio" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."transicionar_encomenda_levantamento"("p_encomenda_id" "uuid", "p_proximo_estado" "text", "p_motivo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transicionar_encomenda_levantamento"("p_encomenda_id" "uuid", "p_proximo_estado" "text", "p_motivo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transicionar_encomenda_levantamento"("p_encomenda_id" "uuid", "p_proximo_estado" "text", "p_motivo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."validar_codigo_entrega_entregador"("p_atribuicao_id" "uuid", "p_codigo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validar_codigo_entrega_entregador"("p_atribuicao_id" "uuid", "p_codigo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_codigo_entrega_entregador"("p_atribuicao_id" "uuid", "p_codigo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."validar_codigo_levantamento_vendedor"("p_encomenda_id" "uuid", "p_codigo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validar_codigo_levantamento_vendedor"("p_encomenda_id" "uuid", "p_codigo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_codigo_levantamento_vendedor"("p_encomenda_id" "uuid", "p_codigo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."validar_compra_produto_alheio"("p_itens" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validar_compra_produto_alheio"("p_itens" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."validar_integridade_destino_entrega_encomenda"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validar_integridade_destino_entrega_encomenda"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validar_limites_reembolso_pagamento"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validar_limites_reembolso_pagamento"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_motivo_rejeicao_vendedor"() TO "anon";
GRANT ALL ON FUNCTION "public"."validar_motivo_rejeicao_vendedor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_motivo_rejeicao_vendedor"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validar_referencias_movimento_financeiro"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validar_referencias_movimento_financeiro"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_veiculo_da_atribuicao_entrega"() TO "anon";
GRANT ALL ON FUNCTION "public"."validar_veiculo_da_atribuicao_entrega"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_veiculo_da_atribuicao_entrega"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_veiculo_do_documento_parceiro"() TO "anon";
GRANT ALL ON FUNCTION "public"."validar_veiculo_do_documento_parceiro"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_veiculo_do_documento_parceiro"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validar_vendedor_elegivel_em_encomenda"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validar_vendedor_elegivel_em_encomenda"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."veiculo_compativel_com_encomenda"("p_veiculo_id" "uuid", "p_encomenda_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."veiculo_compativel_com_encomenda"("p_veiculo_id" "uuid", "p_encomenda_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."veiculo_operacional_para_entregas"("p_veiculo_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."veiculo_operacional_para_entregas"("p_veiculo_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."veiculo_pode_receber_entregas"("p_veiculo_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."veiculo_pode_receber_entregas"("p_veiculo_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."vendedor_pode_receber_encomendas"("p_vendedor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vendedor_pode_receber_encomendas"("p_vendedor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."vendedor_pode_receber_encomendas"("p_vendedor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vendedor_pode_receber_encomendas"("p_vendedor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."verificar_disponibilidade_cadastro"("p_telefone" "text", "p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verificar_disponibilidade_cadastro"("p_telefone" "text", "p_email" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."verificar_disponibilidade_cadastro"("p_telefone" "text", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verificar_disponibilidade_cadastro"("p_telefone" "text", "p_email" "text") TO "authenticated";



GRANT ALL ON TABLE "public"."administradores" TO "anon";
GRANT ALL ON TABLE "public"."administradores" TO "authenticated";
GRANT ALL ON TABLE "public"."administradores" TO "service_role";



GRANT ALL ON TABLE "public"."auditoria_administrativa" TO "service_role";
GRANT SELECT ON TABLE "public"."auditoria_administrativa" TO "authenticated";



GRANT ALL ON TABLE "public"."categorias" TO "anon";
GRANT ALL ON TABLE "public"."categorias" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias" TO "service_role";



GRANT ALL ON TABLE "public"."codigos_entrega" TO "service_role";



GRANT ALL ON TABLE "public"."codigos_levantamento" TO "service_role";



GRANT ALL ON TABLE "public"."configuracoes_financeiras" TO "service_role";
GRANT SELECT ON TABLE "public"."configuracoes_financeiras" TO "authenticated";



GRANT ALL ON TABLE "public"."documentos_parceiro_entrega" TO "anon";
GRANT ALL ON TABLE "public"."documentos_parceiro_entrega" TO "authenticated";
GRANT ALL ON TABLE "public"."documentos_parceiro_entrega" TO "service_role";



GRANT ALL ON TABLE "public"."documentos_vendedor" TO "anon";
GRANT ALL ON TABLE "public"."documentos_vendedor" TO "authenticated";
GRANT ALL ON TABLE "public"."documentos_vendedor" TO "service_role";



GRANT ALL ON TABLE "public"."documentos_vendedor_eventos" TO "anon";
GRANT ALL ON TABLE "public"."documentos_vendedor_eventos" TO "authenticated";
GRANT ALL ON TABLE "public"."documentos_vendedor_eventos" TO "service_role";



GRANT ALL ON TABLE "public"."enderecos_entrega_encomenda" TO "service_role";
GRANT SELECT ON TABLE "public"."enderecos_entrega_encomenda" TO "authenticated";



GRANT ALL ON TABLE "public"."eventos_documento_parceiro_entrega" TO "service_role";



GRANT ALL ON TABLE "public"."eventos_encomenda" TO "service_role";
GRANT SELECT ON TABLE "public"."eventos_encomenda" TO "authenticated";



GRANT ALL ON TABLE "public"."eventos_pagamento" TO "service_role";
GRANT SELECT ON TABLE "public"."eventos_pagamento" TO "authenticated";



GRANT ALL ON TABLE "public"."favoritos" TO "anon";
GRANT ALL ON TABLE "public"."favoritos" TO "authenticated";
GRANT ALL ON TABLE "public"."favoritos" TO "service_role";



GRANT ALL ON TABLE "public"."historico_contactos" TO "anon";
GRANT ALL ON TABLE "public"."historico_contactos" TO "authenticated";
GRANT ALL ON TABLE "public"."historico_contactos" TO "service_role";



GRANT ALL ON TABLE "public"."historico_contactos_servicos" TO "anon";
GRANT ALL ON TABLE "public"."historico_contactos_servicos" TO "authenticated";
GRANT ALL ON TABLE "public"."historico_contactos_servicos" TO "service_role";



GRANT ALL ON TABLE "public"."historico_pesquisas" TO "anon";
GRANT ALL ON TABLE "public"."historico_pesquisas" TO "authenticated";
GRANT ALL ON TABLE "public"."historico_pesquisas" TO "service_role";



GRANT ALL ON TABLE "public"."idempotencia_checkout_encomenda" TO "service_role";



GRANT ALL ON TABLE "public"."idempotencia_intervencao_entrega_admin" TO "service_role";



GRANT ALL ON TABLE "public"."itens_encomenda" TO "service_role";
GRANT SELECT ON TABLE "public"."itens_encomenda" TO "authenticated";



GRANT ALL ON TABLE "public"."movimentos_financeiros" TO "service_role";
GRANT SELECT ON TABLE "public"."movimentos_financeiros" TO "authenticated";



GRANT ALL ON TABLE "public"."municipios_angola" TO "service_role";



GRANT ALL ON TABLE "public"."produtos" TO "anon";
GRANT ALL ON TABLE "public"."produtos" TO "authenticated";
GRANT ALL ON TABLE "public"."produtos" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."provincias_angola" TO "service_role";



GRANT ALL ON TABLE "public"."reembolsos_pagamento" TO "service_role";
GRANT SELECT ON TABLE "public"."reembolsos_pagamento" TO "authenticated";



GRANT ALL ON TABLE "public"."repasses_vendedor" TO "service_role";
GRANT SELECT ON TABLE "public"."repasses_vendedor" TO "authenticated";



GRANT ALL ON TABLE "public"."requisitos_documentos_entrega" TO "service_role";



GRANT ALL ON TABLE "public"."servicos" TO "anon";
GRANT ALL ON TABLE "public"."servicos" TO "authenticated";
GRANT ALL ON TABLE "public"."servicos" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."veiculos_entrega" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."veiculos_entrega" TO "authenticated";
GRANT ALL ON TABLE "public"."veiculos_entrega" TO "service_role";



GRANT UPDATE("capacidade_kg") ON TABLE "public"."veiculos_entrega" TO "authenticated";



GRANT UPDATE("capacidade_volume_m3") ON TABLE "public"."veiculos_entrega" TO "authenticated";



GRANT UPDATE("possui_caixa_carga") ON TABLE "public"."veiculos_entrega" TO "authenticated";



GRANT UPDATE("aceita_paletes") ON TABLE "public"."veiculos_entrega" TO "authenticated";



GRANT UPDATE("possui_refrigeracao") ON TABLE "public"."veiculos_entrega" TO "authenticated";



GRANT ALL ON TABLE "public"."vendedores" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("id") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("nome_comercial") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("nome_comercial"),INSERT("nome_comercial"),UPDATE("nome_comercial") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("descricao") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("descricao"),INSERT("descricao"),UPDATE("descricao") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("telefone_whatsapp") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("telefone_whatsapp"),INSERT("telefone_whatsapp"),UPDATE("telefone_whatsapp") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("provincia") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("provincia"),INSERT("provincia"),UPDATE("provincia") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("municipio") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("municipio"),INSERT("municipio"),UPDATE("municipio") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("mercado_bairro") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("mercado_bairro"),INSERT("mercado_bairro"),UPDATE("mercado_bairro") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("tipo_vendedor") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("tipo_vendedor"),INSERT("tipo_vendedor"),UPDATE("tipo_vendedor") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("verificado") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("verificado") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("foto_perfil") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("foto_perfil"),INSERT("foto_perfil"),UPDATE("foto_perfil") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("criado_em") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("criado_em") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("bairro") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("bairro"),INSERT("bairro"),UPDATE("bairro") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("endereco_detalhado") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("endereco_detalhado"),INSERT("endereco_detalhado"),UPDATE("endereco_detalhado") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("whatsapp") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("whatsapp"),INSERT("whatsapp"),UPDATE("whatsapp") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("horario_atendimento") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("horario_atendimento"),INSERT("horario_atendimento"),UPDATE("horario_atendimento") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("ano_inicio") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("ano_inicio"),INSERT("ano_inicio"),UPDATE("ano_inicio") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("entrega_disponivel") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("entrega_disponivel"),INSERT("entrega_disponivel"),UPDATE("entrega_disponivel") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("tipo_producao") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("tipo_producao"),INSERT("tipo_producao"),UPDATE("tipo_producao") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("area_cultivada") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("area_cultivada"),INSERT("area_cultivada"),UPDATE("area_cultivada") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("principais_culturas") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("principais_culturas"),INSERT("principais_culturas"),UPDATE("principais_culturas") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("producao_mensal") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("producao_mensal"),INSERT("producao_mensal"),UPDATE("producao_mensal") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("tipos_produtos") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("tipos_produtos"),INSERT("tipos_produtos"),UPDATE("tipos_produtos") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("compra_produtores") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("compra_produtores"),INSERT("compra_produtores"),UPDATE("compra_produtores") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("volume_minimo") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("volume_minimo"),INSERT("volume_minimo"),UPDATE("volume_minimo") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("entrega_outras_provincias") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("entrega_outras_provincias"),INSERT("entrega_outras_provincias"),UPDATE("entrega_outras_provincias") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("tipo_loja") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("tipo_loja"),INSERT("tipo_loja"),UPDATE("tipo_loja") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("mercado_localizado") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("mercado_localizado"),INSERT("mercado_localizado"),UPDATE("mercado_localizado") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("venda_presencial") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("venda_presencial"),INSERT("venda_presencial"),UPDATE("venda_presencial") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("venda_grosso") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("venda_grosso"),INSERT("venda_grosso"),UPDATE("venda_grosso") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("venda_retalho") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("venda_retalho"),INSERT("venda_retalho"),UPDATE("venda_retalho") ON TABLE "public"."vendedores" TO "authenticated";



GRANT SELECT("data_inicio_atividade") ON TABLE "public"."vendedores" TO "anon";
GRANT SELECT("data_inicio_atividade"),INSERT("data_inicio_atividade"),UPDATE("data_inicio_atividade") ON TABLE "public"."vendedores" TO "authenticated";



GRANT INSERT("user_id") ON TABLE "public"."vendedores" TO "authenticated";



GRANT INSERT("nome_responsavel"),UPDATE("nome_responsavel") ON TABLE "public"."vendedores" TO "authenticated";



GRANT INSERT("email"),UPDATE("email") ON TABLE "public"."vendedores" TO "authenticated";



GRANT INSERT("atualizado_em"),UPDATE("atualizado_em") ON TABLE "public"."vendedores" TO "authenticated";



GRANT INSERT("email_login"),UPDATE("email_login") ON TABLE "public"."vendedores" TO "authenticated";



GRANT INSERT("indicativo_telefone"),UPDATE("indicativo_telefone") ON TABLE "public"."vendedores" TO "authenticated";



GRANT INSERT("telefone_nacional"),UPDATE("telefone_nacional") ON TABLE "public"."vendedores" TO "authenticated";



GRANT ALL ON TABLE "public"."versoes_documento_parceiro_entrega" TO "service_role";



GRANT ALL ON TABLE "public"."visualizacoes_produtos" TO "anon";
GRANT ALL ON TABLE "public"."visualizacoes_produtos" TO "authenticated";
GRANT ALL ON TABLE "public"."visualizacoes_produtos" TO "service_role";



GRANT ALL ON TABLE "public"."visualizacoes_servicos" TO "anon";
GRANT ALL ON TABLE "public"."visualizacoes_servicos" TO "authenticated";
GRANT ALL ON TABLE "public"."visualizacoes_servicos" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
