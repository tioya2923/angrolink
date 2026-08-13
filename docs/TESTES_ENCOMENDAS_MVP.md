# Testes técnicos — fundação de encomendas

## Cobertura da migration/RPC a executar num ambiente de teste

1. Cliente ativo cria encomenda de produto publicado/disponível e vendedor aprovado; confirmar código público único, totais em cêntimos, item e evento `encomenda_criada`.
2. Produto inexistente, indisponível, não publicado, vendedor suspenso/não aprovado e quantidade zero/negativa falham na RPC.
3. Itens de vendedores diferentes falham; o preço, desconto ou total enviados pelo browser não existem no contrato e não influenciam o total.
4. Depois de criar a encomenda, alterar produto, preço, descrição, imagem, unidade ou localização do vendedor; confirmar que os snapshots comerciais e de levantamento permanecem originais.
5. Eliminar fisicamente o produto: confirmar que `itens_encomenda.produto_id` passa a `null`, sem eliminar item, encomenda ou snapshots.
6. Tentar eliminar uma encomenda com itens/eventos: deve falhar por `ON DELETE RESTRICT`. Tentar eliminar um evento deve falhar por grants/RLS.
7. Cliente A não lê encomenda/itens/eventos de Cliente B; Vendedor A não lê pedidos do Vendedor B; parceiro de entrega não lê nenhuma encomenda.
8. Cliente, vendedor, parceiro e admin autenticados não conseguem fazer `INSERT`, `UPDATE` ou `DELETE` direto nas três tabelas pelo PostgREST.
9. Vendedor dono confirma, recusa com motivo, inicia preparação e marca pronta; vendedor alheio falha; transição fora da sequência falha.
10. Cliente cancela apenas antes da confirmação. Cliente não pode marcar levantamento nem concluir pela RPC genérica antes do fluxo OTP seguro. Cada ação permitida cria exatamente um evento append-only.
11. Confirmar a política de preço na RPC, nunca no browser:
   - produto apenas de retalho usa `preco_aproximado` e respeita `quantidade_minima`;
   - promoção válida de retalho usa `preco_promocional`;
   - produto apenas de grosso usa `preco_grosso` se existir, ou o preço base legado (`preco_aproximado`) quando este é o único preço configurado;
   - produto `ambos` abaixo do mínimo grossista mantém o preço de retalho;
   - produto `ambos` no mínimo grossista, com preço e mínimo grossistas válidos, usa `preco_grosso`;
   - preço grossista ausente/inválido num produto `ambos` não ativa grosso; a encomenda só usa retalho se cumprir o respetivo mínimo;
   - preço normal ausente sem alternativa aplicável falha;
   - promoção e quantidade de grosso usam a regra explícita: grosso prevalece quando a tabela grossista está completa; promoção é apenas de retalho;
   - editar preços depois da encomenda não altera `valor_unitario_centimos` nem `tipo_preco_snapshot`;
   - preço, subtotal, desconto ou total forjados pelo frontend são ignorados pelo contrato e pela RPC;
   - desconto superior ao subtotal falha pela constraint `encomendas_desconto_nao_supera_subtotal`.
12. Confirmar os cálculos: 1 unidade, 2 unidades, 0,5 kg e 1,250 kg; o subtotal é arredondado uma vez por linha em cêntimos.
13. Confirmar as unidades: `kg` e `litro` aceitam até três casas decimais; `unidade`, `animal`, `saco` e `caixa` rejeitam frações. A quantidade deve cumprir o mínimo do modo de venda aplicado.
14. Confirmar elegibilidade transacional do vendedor na função `vendedor_pode_receber_encomendas(id)` e na inserção da encomenda: aprovado/ativo com Auth e profile de vendedor passa; `user_id` nulo, Auth inexistente, profile ausente ou com outro papel, rejeitado, suspenso ou inativo falham. O cliente nunca informa `vendedor_id`; a RPC obtém-no do produto e a trigger volta a validá-lo antes do `INSERT`.

## Decisões intencionalmente adiadas

- Não existe reserva de stock: o catálogo não tem stock quantitativo. A confirmação do vendedor representa a validação manual da disponibilidade.
- Apenas `levantamento` é aceite. A coluna de modalidade está preparada para entrega, mas a constraint e a RPC impedem criar entregas sem entidade logística.
- `levantada` e `concluida` permanecem reservados no modelo, mas a RPC genérica não permite alcançá-los sem um futuro fluxo OTP com expiração, tentativas limitadas e validação no servidor.
- Serviços não fazem parte de `itens_encomenda` nesta fase.
- Não existe código/OTP de levantamento: fazê-lo sem limite de tentativas, expiração e canal de entrega seria segurança incompleta.
- Não existem pagamentos, reembolsos, disputa, parceiros atribuídos, tracking ou comissões.
- Não há promoção grossista nesta fase. Uma promoção futura para grosso deve ter semântica e validade próprias, sem reutilizar silenciosamente `preco_promocional`.
