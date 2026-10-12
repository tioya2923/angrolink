-- Alertas privados de operações de entrega que exigem ação administrativa.
-- A falha destes alertas não pode reverter a transição comercial que os originou.
-- O WARNING técnico não garante entrega nem existe retry automático neste bloco.
begin;

create or replace function public.notificar_administradores_operacao_entrega(
  p_evento_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_evento public.eventos_encomenda%rowtype;
  v_encomenda public.encomendas%rowtype;
  v_admin public.administradores%rowtype;
  v_tipo text;
  v_titulo text;
  v_mensagem text;
begin
  select * into v_evento
  from public.eventos_encomenda e
  where e.id = p_evento_id;

  if not found or v_evento.tipo_evento not in ('pronta_para_levantamento', 'entregador_recusou') then
    return;
  end if;

  select * into v_encomenda
  from public.encomendas e
  where e.id = v_evento.encomenda_id;

  if not found or v_encomenda.modalidade_recebimento <> 'entrega' then
    return;
  end if;

  if v_evento.tipo_evento = 'pronta_para_levantamento' then
    v_tipo := 'entrega_pronta_atribuicao';
    v_titulo := 'Entrega pronta para atribuição';
    v_mensagem := 'Uma entrega está pronta para receber um entregador.';
  else
    v_tipo := 'entrega_reatribuicao_necessaria';
    v_titulo := 'Nova atribuição de entrega necessária';
    v_mensagem := 'Uma entrega aguarda nova atribuição de entregador.';
  end if;

  for v_admin in select a.* from public.administradores a loop
    perform public.criar_notificacao(
      v_admin.user_id,
      'admin',
      v_tipo,
      v_titulo,
      v_mensagem,
      'encomenda',
      v_encomenda.id,
      '/dashboard/encomendas/' || v_encomenda.id::text,
      '{}'::jsonb,
      'admin:operacao-entrega:' || v_evento.id::text || ':admin:' || v_admin.user_id::text
    );
  end loop;
end;
$$;

create or replace function public.criar_alerta_admin_operacao_entrega()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  begin
    perform public.notificar_administradores_operacao_entrega(new.id);
  exception when others then
    -- Apenas produtor, evento e SQLSTATE: nunca expõe a mensagem bruta do erro.
    raise warning 'Alerta administrativo de entrega ignorado (produtor=% evento=% sqlstate=%)', tg_name, new.id, sqlstate;
  end;

  return new;
end;
$$;

drop trigger if exists criar_alerta_admin_operacao_entrega on public.eventos_encomenda;
create trigger criar_alerta_admin_operacao_entrega
after insert on public.eventos_encomenda
for each row
when (new.tipo_evento in ('pronta_para_levantamento', 'entregador_recusou'))
execute function public.criar_alerta_admin_operacao_entrega();

revoke all on function public.notificar_administradores_operacao_entrega(uuid), public.criar_alerta_admin_operacao_entrega()
from public, anon, authenticated;

commit;
