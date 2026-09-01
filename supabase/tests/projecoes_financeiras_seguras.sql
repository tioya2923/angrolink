-- Executar APÓS aplicar a migration, numa base de testes, sempre em transação.
-- Não cria ou altera dados persistentes. Os casos que exigem duas contas usam
-- fixtures reais e são ignorados quando a fixture ainda não existir.
begin;

do $$
begin
  if to_regprocedure('public.obter_pagamento_encomenda_cliente(uuid)') is null
    or to_regprocedure('public.obter_resumo_financeiro_encomenda_vendedor(uuid)') is null then
    raise exception 'As projeções financeiras seguras não foram instaladas.';
  end if;
end;
$$;

-- Verificação manual obrigatória em sessões autenticadas distintas:
-- 1. cliente dono da encomenda: RPC cliente devolve método e nunca comissão;
-- 2. cliente B, parceiro e anónimo: RPC cliente devolve zero linhas;
-- 3. vendedor dono ativo, suspenso ou atualmente inelegível continua a ler o
--    próprio histórico; vendedor B, cliente, parceiro e anónimo devolvem zero linhas;
-- 4. vendedor dono lê subtotal, desconto, comissão e líquido efetivos;
-- 5. pagamento não confirmado: inserir/usar tentativas às 10:00 pendente e
--    às 11:00 falhada; a RPC deve exibir a tentativa/método das 11:00;
-- 6. pagamento não confirmado: inserir/usar tentativa online falhada às 10:00
--    e pagamento_no_levantamento pendente às 11:00; a RPC deve exibir o método
--    pagamento_no_levantamento;
-- 7. pagamento confirmado: a RPC só pode exibir a tentativa confirmada mais
--    recente. Se não existir tentativa confirmada, método deve ser nulo e o
--    dado deve ser corrigido por fluxo administrativo/auditoria futura;
-- 8. cancelada/recusada devolve comissão e valor vendedor iguais a zero;
-- 9. reembolso parcial reduz base, comissão e valor vendedor devolvidos.
-- Estas verificações requerem fixtures com perfis autenticais reais; não são
-- fabricadas neste script para não introduzir credenciais nem dados de produção.

rollback;
