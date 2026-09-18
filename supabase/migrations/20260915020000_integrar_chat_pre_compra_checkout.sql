begin;

alter table public.idempotencia_checkout_encomenda
  add column conversa_pre_compra_id uuid references public.conversas_pre_compra(id) on delete restrict;
create unique index idempotencia_checkout_encomenda_conversa_unica_idx
  on public.idempotencia_checkout_encomenda(conversa_pre_compra_id)
  where conversa_pre_compra_id is not null;

create or replace function public.criar_encomenda_levantamento_com_conversa(
  p_itens jsonb,p_modalidade text,p_nome_destinatario text,p_telefone_destinatario text,p_observacoes_cliente text,p_idempotency_key uuid,p_conversa_pre_compra_id uuid
) returns public.encomendas language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_registo public.idempotencia_checkout_encomenda%rowtype; v_encomenda public.encomendas%rowtype; v_atualizados integer;
begin
  if auth.uid() is null or p_conversa_pre_compra_id is null or p_idempotency_key is null then raise exception 'Não foi possível criar a encomenda com conversa.'; end if;
  -- O lock transacional é reentrante na mesma sessão: a RPC existente usa a mesma chave.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':levantamento:'||p_idempotency_key::text,0));
  select * into v_registo from public.idempotencia_checkout_encomenda r where r.cliente_id=auth.uid() and r.modalidade_recebimento='levantamento' and r.chave_idempotencia=p_idempotency_key for update;
  if found and v_registo.conversa_pre_compra_id is distinct from p_conversa_pre_compra_id then raise exception 'Esta chave de idempotência pertence a outra intenção.'; end if;
  v_encomenda:=public.criar_encomenda_levantamento(p_itens,p_modalidade,p_nome_destinatario,p_telefone_destinatario,p_observacoes_cliente,p_idempotency_key);
  perform public.vincular_conversa_pre_compra_encomenda(p_conversa_pre_compra_id,v_encomenda.id);
  update public.idempotencia_checkout_encomenda r set conversa_pre_compra_id=p_conversa_pre_compra_id where r.cliente_id=auth.uid() and r.modalidade_recebimento='levantamento' and r.chave_idempotencia=p_idempotency_key and r.encomenda_id=v_encomenda.id and (r.conversa_pre_compra_id is null or r.conversa_pre_compra_id=p_conversa_pre_compra_id);
  get diagnostics v_atualizados=row_count; if v_atualizados<>1 then raise exception 'Não foi possível concluir a encomenda com conversa.'; end if; return v_encomenda;
end $$;

create or replace function public.criar_encomenda_entrega_com_conversa(
  p_itens jsonb,p_destinatario_nome text,p_destinatario_telefone text,p_provincia text,p_municipio text,p_bairro text,p_endereco_detalhado text,p_ponto_referencia text,p_instrucoes_entrega text,p_observacoes text,p_idempotency_key uuid,p_conversa_pre_compra_id uuid
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_registo public.idempotencia_checkout_encomenda%rowtype; v_resultado jsonb; v_encomenda_id uuid; v_atualizados integer;
begin
  if auth.uid() is null or p_conversa_pre_compra_id is null or p_idempotency_key is null then raise exception 'Não foi possível criar a encomenda com conversa.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':entrega:'||p_idempotency_key::text,0));
  select * into v_registo from public.idempotencia_checkout_encomenda r where r.cliente_id=auth.uid() and r.modalidade_recebimento='entrega' and r.chave_idempotencia=p_idempotency_key for update;
  if found and v_registo.conversa_pre_compra_id is distinct from p_conversa_pre_compra_id then raise exception 'Esta chave de idempotência pertence a outra intenção.'; end if;
  v_resultado:=public.criar_encomenda_entrega(p_itens,p_destinatario_nome,p_destinatario_telefone,p_provincia,p_municipio,p_bairro,p_endereco_detalhado,p_ponto_referencia,p_instrucoes_entrega,p_observacoes,p_idempotency_key);
  v_encomenda_id:=(v_resultado->>'id')::uuid; perform public.vincular_conversa_pre_compra_encomenda(p_conversa_pre_compra_id,v_encomenda_id);
  update public.idempotencia_checkout_encomenda r set conversa_pre_compra_id=p_conversa_pre_compra_id where r.cliente_id=auth.uid() and r.modalidade_recebimento='entrega' and r.chave_idempotencia=p_idempotency_key and r.encomenda_id=v_encomenda_id and (r.conversa_pre_compra_id is null or r.conversa_pre_compra_id=p_conversa_pre_compra_id);
  get diagnostics v_atualizados=row_count; if v_atualizados<>1 then raise exception 'Não foi possível concluir a encomenda com conversa.'; end if; return v_resultado;
end $$;

revoke all on function public.criar_encomenda_levantamento_com_conversa(jsonb,text,text,text,text,uuid,uuid),public.criar_encomenda_entrega_com_conversa(jsonb,text,text,text,text,text,text,text,text,text,uuid,uuid) from public,anon;
grant execute on function public.criar_encomenda_levantamento_com_conversa(jsonb,text,text,text,text,uuid,uuid),public.criar_encomenda_entrega_com_conversa(jsonb,text,text,text,text,text,text,text,text,text,uuid,uuid) to authenticated;
commit;
