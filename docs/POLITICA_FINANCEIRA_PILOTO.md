# Política financeira V1 — piloto

## Regra ativa para novas obrigações

- Comissão ANGROLINK: 5% (`500` pontos-base).
- A comissão é suportada pelo vendedor.
- A comissão incide sobre produtos após descontos e reembolsos de produtos.
- Entrega e taxa de processador ficam fora da base comissionável.
- Janela de segurança do repasse: 48 horas.

Cada pagamento guarda o snapshot dos pontos-base na criação. Alterações futuras
em `configuracoes_financeiras` não alteram pagamentos já criados.

## Reembolsos e saldos efetivos

`reembolsos_pagamento` separa produtos, entrega e taxa do processador. Apenas
valores aprovados, em processamento ou concluídos reduzem os saldos efetivos.
Os snapshots de `pagamentos` não são reescritos.

`calcular_valores_financeiros_efetivos(pagamento_id)` é uma função interna: a
base efetiva reduz reembolsos de produtos e é anulada para encomenda cancelada
ou recusada. A comissão e o valor comercial do vendedor tornam-se zero nesses
casos. A entrega permanece um domínio logístico separado.

## Repasse e conclusão comercial

Pagamento confirmado não libera repasse. O ciclo futuro precisa exigir:

1. pagamento confirmado;
2. encomenda `concluida` após levantamento;
3. nenhum reembolso, disputa ou bloqueio pendente;
4. prazo configurado de 48 horas cumprido.

Para o piloto, a recomendação é manter `levantada` como confirmação física via
OTP e permitir conclusão posterior por confirmação do cliente, com uma regra
automática futura somente após existir política de disputas.

## Pagamento no levantamento

Quando o cliente paga fisicamente ao vendedor, a comissão continua
economicamente devida, mas a ANGROLINK não pode representar isso como dinheiro
recebido ou split financeiro. Uma futura `conta_corrente_vendedor`/`comissoes_devidas`
será necessária antes de tornar esse método operacional em escala.

## Pagamento digital

O caminho futuro é obrigação → tentativa → PSP → webhook confiável → tentativa
confirmada → pagamento agregado confirmado. Nenhuma função pública confirma
pagamentos nesta fase.
