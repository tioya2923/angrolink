# Testes manuais — Backend Admin 360 V1

Execute este roteiro apenas após a migration `20260814031500_criar_backend_admin_360.sql` estar aplicada. Use contas e encomendas de teste. As decisões criam reembolsos lógicos; não processam dinheiro real.

## Cenário de administrador

1. Inicie sessão com uma conta presente na tabela `administradores`.
2. Consulte `listar_encomendas_admin`, abra uma encomenda com `obter_encomenda_admin` e confirme que não há OTP, hashes ou outros segredos na resposta.
3. Consulte `listar_financeiro_admin` e confirme valores financeiros, estado do pagamento e informação de reembolso conforme o histórico.
4. Consulte `listar_disputas_admin`, abra uma disputa com `obter_disputa_admin` e confirme que pertencem à mesma encomenda.
5. Assuma uma disputa `aberta` com `assumir_disputa_admin`.
6. Confirme estado `em_analise`, `analisado_por`, `analisado_em` e um único registo de auditoria da assunção.

## Cenário de resolução sem reembolso

1. Use uma disputa de teste em `em_analise` assumida pelo administrador autenticado.
2. Execute `resolver_disputa_sem_reembolso_admin` com observação válida.
3. Confirme o estado resolvido sem reembolso, a auditoria com estado anterior/novo, motivo e data.
4. Confirme que não foi criado um novo registo em `reembolsos_pagamento` para a encomenda.

## Cenário de reembolso parcial

1. Use uma disputa de teste em análise, com pagamento confirmado.
2. Execute `resolver_disputa_reembolso_parcial_admin` com produtos apenas, entrega apenas e produtos mais entrega: os três cenários devem ser permitidos quando respeitarem os limites financeiros.
3. Em todos os cenários permitidos, envie `p_valor_taxa_processador_centimos = 0` e confirme um único reembolso lógico aprovado, os componentes efetivos e o registo de auditoria.
4. Tente enviar taxa do processador maior ou menor que zero: confirme o bloqueio com a mensagem da política V1.
5. Repita uma operação permitida com a mesma chave, mesmos componentes e mesma observação: confirme que continua a existir apenas um reembolso e uma auditoria de resolução.
6. Repita a chave com valores diferentes: confirme que a operação é bloqueada.

## Cenário de reembolso total

1. Use uma disputa em análise elegível, incluindo eventual reembolso parcial anterior.
2. Execute `resolver_disputa_reembolso_total_admin` com UUID novo e observação válida.
3. Confirme que apenas o valor remanescente de produtos e entrega é registado.
4. Confirme taxa do processador igual a zero, conforme a política V1.
5. Repita com a mesma chave e observação: confirme que continua a existir apenas um reembolso, uma auditoria de resolução e o saldo já calculado.

## Cenário de não administrador

1. Inicie sessão separadamente como cliente, vendedor e parceiro de entrega.
2. Tente executar cada RPC administrativa deste módulo.
3. Confirme que todos recebem erro de autorização e não conseguem ler ou modificar dados administrativos.

## Cenário de auditoria

1. Como administrador, confira em `auditoria_administrativa`: `admin_user_id`, ação, estado anterior, estado novo, motivo e timestamp.
2. Tente `UPDATE` num registo de auditoria: a operação deve falhar.
3. Tente `DELETE` no mesmo registo: a operação deve falhar.
4. Confirme que os testes não envolvem gateway, repasse nem dinheiro real.
