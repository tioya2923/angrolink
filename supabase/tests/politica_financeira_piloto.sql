-- Teste controlado pós-migration. Executar numa sessão administrativa de TESTE.
-- Não expor como RPC. Tudo é revertido pelo ROLLBACK final.
begin;

do $$
begin
  if not exists (
    select 1 from public.configuracoes_financeiras
    where chave = 'padrao' and ativo and comissao_bps = 500 and prazo_repasse_horas = 48
  ) then
    raise exception 'Política financeira piloto não configurada.';
  end if;
end;
$$;

do $$
declare
  v_encomenda public.encomendas%rowtype;
  v_pagamento_id uuid := gen_random_uuid();
  v_outro_vendedor uuid;
  v_outro_cliente uuid;
  v_outra_encomenda uuid;
  v_movimento_id uuid;
  v_valores record;
begin
  -- Não cria encomendas artificiais: aproveita exclusivamente uma encomenda de
  -- teste sem obrigação financeira. Sem fixture, os casos dependentes ficam
  -- documentados como manuais e não alteram dados.
  select e.* into v_encomenda
  from public.encomendas e
  where not exists (select 1 from public.pagamentos p where p.encomenda_id = e.id)
  order by e.criado_em
  limit 1;

  if not found then
    raise notice 'SKIP: não existe encomenda de teste sem pagamento. Execute os casos de fixture manualmente.';
    return;
  end if;

  -- Obrigação financeira confirmada exclusivamente nesta transação de teste:
  -- 10 000 produtos + 1 000 entrega; 5%% = 500 de comissão.
  insert into public.pagamentos (
    id, encomenda_id, cliente_id, vendedor_id, moeda, estado, referencia_interna,
    chave_idempotencia_criacao, subtotal_centimos, desconto_centimos, entrega_centimos,
    taxa_processador_centimos, comissao_angrolink_centimos, valor_vendedor_centimos,
    valor_logistica_centimos, valor_total_centimos, total_cliente_centimos,
    comissao_bps_snapshot, confirmado_em
  ) values (
    v_pagamento_id, v_encomenda.id, v_encomenda.cliente_id, v_encomenda.vendedor_id,
    'AOA', 'confirmado', 'TESTE-PGT-' || replace(v_pagamento_id::text, '-', ''), gen_random_uuid(),
    10000, 0, 1000, 0, 500, 9500, 1000, 11000, 11000, 500, now()
  );

  -- O total solicitado também não pode superar o que foi efetivamente pago.
  begin
    insert into public.reembolsos_pagamento (
      pagamento_id, encomenda_id, estado, motivo, valor_solicitado_centimos,
      valor_produtos_solicitado_centimos, valor_entrega_solicitado_centimos,
      referencia_interna, chave_idempotencia
    ) values (
      v_pagamento_id, v_encomenda.id, 'solicitado', 'Teste de limite total', 11001,
      10000, 1001, 'TESTE-RMB-TOTAL-' || replace(gen_random_uuid()::text, '-', ''),
      gen_random_uuid()
    );
    raise exception 'O limite total solicitado deveria falhar.';
  exception when others then
    if position('não pode exceder os valores da obrigação financeira' in sqlerrm) = 0 then raise; end if;
  end;

  -- Não é permitido aprovar 2 000 em produtos quando foram solicitados apenas
  -- 1 000 em produtos e 1 000 em entrega, ainda que o total seja igual.
  begin
    insert into public.reembolsos_pagamento (
      pagamento_id, encomenda_id, estado, motivo, valor_solicitado_centimos,
      valor_produtos_solicitado_centimos, valor_entrega_solicitado_centimos,
      valor_aprovado_centimos, valor_produtos_aprovado_centimos,
      valor_entrega_aprovado_centimos, referencia_interna, chave_idempotencia,
      aprovado_em
    ) values (
      v_pagamento_id, v_encomenda.id, 'aprovado', 'Teste de componente inválido', 2000,
      1000, 1000, 2000, 2000, 0, 'TESTE-RMB-COMP-' || replace(gen_random_uuid()::text, '-', ''),
      gen_random_uuid(), now()
    );
    raise exception 'O limite aprovado por componente deveria falhar.';
  exception when check_violation then null;
  end;

  -- Reembolso parcial de produtos: a base passa de 10 000 para 8 000 e a
  -- comissão passa de 500 para 400. A entrega não entra na comissão.
  insert into public.reembolsos_pagamento (
    pagamento_id, encomenda_id, estado, motivo, valor_solicitado_centimos,
    valor_produtos_solicitado_centimos, valor_aprovado_centimos,
    valor_produtos_aprovado_centimos, referencia_interna, chave_idempotencia,
    aprovado_em
  ) values (
    v_pagamento_id, v_encomenda.id, 'aprovado', 'Teste de reembolso parcial', 2000,
    2000, 2000, 2000, 'TESTE-RMB-PARC-' || replace(gen_random_uuid()::text, '-', ''),
    gen_random_uuid(), now()
  );

  select * into v_valores from public.calcular_valores_financeiros_efetivos(v_pagamento_id);
  if v_valores.base_comissionavel_centimos <> 8000
    or v_valores.comissao_efetiva_centimos <> 400
    or v_valores.valor_vendedor_efetivo_centimos <> 7600
    or v_valores.valor_logistica_efetivo_centimos <> 1000 then
    raise exception 'Cálculo efetivo não respeitou comissão de 5%% sem entrega na base.';
  end if;

  -- O movimento correto completa vendedor e cliente a partir do pagamento.
  insert into public.movimentos_financeiros (
    pagamento_id, encomenda_id, tipo_movimento, direcao, entidade_debitada,
    entidade_creditada, moeda, valor_centimos, referencia_origem
  ) values (
    v_pagamento_id, v_encomenda.id, 'venda_registada', 'credito', 'cliente',
    'vendedor', 'AOA', 11000, 'TESTE-LEDGER-CORRETO'
  ) returning id into v_movimento_id;

  if not exists (
    select 1 from public.movimentos_financeiros
    where id = v_movimento_id and vendedor_id = v_encomenda.vendedor_id and cliente_id = v_encomenda.cliente_id
  ) then
    raise exception 'Ledger não completou referências do pagamento.';
  end if;

  -- Append-only: UPDATE e DELETE devem falhar.
  begin
    update public.movimentos_financeiros set valor_centimos = 1 where id = v_movimento_id;
    raise exception 'UPDATE de ledger deveria falhar.';
  exception when others then
    if position('append-only' in sqlerrm) = 0 then raise; end if;
  end;
  begin
    delete from public.movimentos_financeiros where id = v_movimento_id;
    raise exception 'DELETE de ledger deveria falhar.';
  exception when others then
    if position('append-only' in sqlerrm) = 0 then raise; end if;
  end;

  select id into v_outro_vendedor from public.vendedores where id <> v_encomenda.vendedor_id limit 1;
  if v_outro_vendedor is not null then
    begin
      insert into public.movimentos_financeiros (pagamento_id, encomenda_id, vendedor_id, tipo_movimento, direcao, entidade_debitada, entidade_creditada, moeda, valor_centimos, referencia_origem)
      values (v_pagamento_id, v_encomenda.id, v_outro_vendedor, 'ajuste_debito', 'debito', 'vendedor', 'angrolink', 'AOA', 1, 'TESTE-LEDGER-VENDEDOR');
      raise exception 'Vendedor incoerente deveria falhar.';
    exception when others then
      if position('vendedor do movimento' in sqlerrm) = 0 then raise; end if;
    end;
  else raise notice 'SKIP parcial: não existe segundo vendedor de teste.'; end if;

  select id into v_outro_cliente from public.clientes where id <> v_encomenda.cliente_id limit 1;
  if v_outro_cliente is not null then
    begin
      insert into public.movimentos_financeiros (pagamento_id, encomenda_id, cliente_id, tipo_movimento, direcao, entidade_debitada, entidade_creditada, moeda, valor_centimos, referencia_origem)
      values (v_pagamento_id, v_encomenda.id, v_outro_cliente, 'ajuste_debito', 'debito', 'cliente', 'angrolink', 'AOA', 1, 'TESTE-LEDGER-CLIENTE');
      raise exception 'Cliente incoerente deveria falhar.';
    exception when others then
      if position('cliente do movimento' in sqlerrm) = 0 then raise; end if;
    end;
  else raise notice 'SKIP parcial: não existe segundo cliente de teste.'; end if;

  select id into v_outra_encomenda from public.encomendas where id <> v_encomenda.id limit 1;
  if v_outra_encomenda is not null then
    begin
      insert into public.movimentos_financeiros (pagamento_id, encomenda_id, tipo_movimento, direcao, entidade_debitada, entidade_creditada, moeda, valor_centimos, referencia_origem)
      values (v_pagamento_id, v_outra_encomenda, 'ajuste_debito', 'debito', 'cliente', 'angrolink', 'AOA', 1, 'TESTE-LEDGER-ENCOMENDA');
      raise exception 'Encomenda incoerente deveria falhar.';
    exception when others then
      if position('encomenda do movimento' in sqlerrm) = 0 then raise; end if;
    end;
  else raise notice 'SKIP parcial: não existe segunda encomenda de teste.'; end if;

  -- Cancelamento/recusa anulam a comissão efetiva sem reescrever snapshots.
  update public.encomendas set estado = 'cancelada', cancelado_em = now() where id = v_encomenda.id;
  select * into v_valores from public.calcular_valores_financeiros_efetivos(v_pagamento_id);
  if v_valores.comissao_efetiva_centimos <> 0 or v_valores.valor_vendedor_efetivo_centimos <> 0 then
    raise exception 'Cancelamento deveria anular comissão e valor comercial efetivos.';
  end if;

  update public.encomendas set estado = 'recusada' where id = v_encomenda.id;
  select * into v_valores from public.calcular_valores_financeiros_efetivos(v_pagamento_id);
  if v_valores.comissao_efetiva_centimos <> 0 or v_valores.valor_vendedor_efetivo_centimos <> 0 then
    raise exception 'Recusa deveria anular comissão e valor comercial efetivos.';
  end if;
end;
$$;

rollback;

-- Manual após a migration, com sessões autenticadas diferentes: verificar que
-- cliente, vendedor e parceiro não têm INSERT/UPDATE/DELETE direto em
-- pagamentos, reembolsos ou movimentos. O script acima usa sessão privilegiada
-- deliberadamente para testar constraints e triggers sem criar uma RPC pública.
