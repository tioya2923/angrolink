begin;

create or replace function public.notificar_mensagem_pre_compra()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_conversa public.conversas_pre_compra%rowtype; v_vendedor_user uuid; v_destinatario uuid; v_contexto text;
begin
  select * into v_conversa from public.conversas_pre_compra where id=new.conversa_id;
  select v.user_id into v_vendedor_user from public.vendedores v where v.id=v_conversa.vendedor_id;
  if new.remetente_user_id=v_conversa.solicitante_user_id then v_destinatario:=v_vendedor_user; v_contexto:='venda'; else v_destinatario:=v_conversa.solicitante_user_id; v_contexto:='compra'; end if;
  if v_destinatario is not null and v_destinatario is distinct from new.remetente_user_id then
    perform public.criar_notificacao(v_destinatario,v_contexto,'mensagem_pre_compra','Nova mensagem','Recebeste uma nova mensagem.','conversa_pre_compra',new.conversa_id,'/dashboard/conversas-produtos/'||new.conversa_id::text,'{}'::jsonb,'mensagem-pre-compra:'||new.id::text||':'||v_destinatario::text);
  end if;
  return new;
end $$;

create or replace function public.marcar_conversa_pre_compra_como_lida(p_conversa_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  perform public.validar_participacao_conversa_pre_compra(p_conversa_id);
  insert into public.leituras_mensagens_pre_compra(conversa_id,utilizador_id,ultima_leitura_em)
  values(p_conversa_id,auth.uid(),now())
  on conflict(conversa_id,utilizador_id) do update set ultima_leitura_em=excluded.ultima_leitura_em;
  update public.notificacoes n set lida_em=coalesce(n.lida_em,now())
  where n.utilizador_id=auth.uid() and n.tipo='mensagem_pre_compra'
    and n.entidade_tipo='conversa_pre_compra' and n.entidade_id=p_conversa_id and n.lida_em is null;
end $$;

revoke all on function public.notificar_mensagem_pre_compra(),public.marcar_conversa_pre_compra_como_lida(uuid) from public,anon;
grant execute on function public.marcar_conversa_pre_compra_como_lida(uuid) to authenticated;

commit;
