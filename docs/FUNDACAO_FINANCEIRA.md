# Fundação financeira interna

Esta fase cria apenas o registo financeiro interno. Não integra provedores,
não recebe credenciais de pagamento, não confirma cobranças e não movimenta
dinheiro.

## Modelo

- `pagamentos`: uma obrigação financeira lógica por encomenda, com chave de
  idempotência de criação e snapshots imutáveis dos valores comerciais.
- `tentativas_pagamento`: cada tentativa concreta, com método, provedor futuro,
  referência externa futura e chave de idempotência própria.
- `repasses_vendedor`: preparado para o ciclo pendente → disponível →
  processando → concluído, mas não é criado até uma confirmação financeira
  futura e controlada.
- `eventos_pagamento`: histórico append-only de pagamentos e repasses.
- `configuracoes_financeiras`: política de comissão usada apenas na criação
  de novos pagamentos. O valor é congelado no pagamento criado.

Todos os valores usam cêntimos inteiros. A configuração inicial é `0` pontos
base de comissão e `0` horas de prazo de repasse, por ainda não existir uma
decisão comercial aprovada. Alterar essa configuração só deverá afetar novas
intenções de pagamento.

## Limites de acesso

As tabelas não permitem escrita direta a `authenticated`. Cliente e vendedor
acedem apenas às projeções mínimas fornecidas por RPCs seguras; a consulta
direta é administrativa. Não há RPC de confirmação de pagamento nesta fase.

## Próxima decisão de negócio necessária

Antes de integrar um provedor, definir por escrito a comissão por categoria,
quem suporta a taxa do processador, regra de disponibilidade do repasse,
política de reembolso e reconciliação do pagamento na entrega.
