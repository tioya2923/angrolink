# Rollout da renovação documental de entregadores

Esta alteração depende da migration `20260814190000_criar_versionamento_documental_entregadores.sql`.

## Ordem obrigatória

1. Aplicar a migration no Supabase.
2. Regenerar `src/types/database.types.ts` a partir do projeto Supabase já migrado.
3. Integrar a chamada tipada de `reenviar_documento_parceiro` com cinco parâmetros no formulário de documentos do parceiro.
4. Publicar frontend e backend na mesma janela de deploy.

Não é seguro declarar manualmente a nova assinatura em `database.types.ts`, nem enviar parâmetros que ainda não existem no backend remoto.

## Contratos durante a transição

- A assinatura legada `(documento_id, frente_path, verso_path)` continua destinada a documentos rejeitados.
- Um documento expirado que possua validade só pode ser renovado com a assinatura de cinco parâmetros e uma validade posterior à anterior.
- O formulário moderno deve sempre exigir frente, verso e, para esse caso, nova validade. Número documental é opcional e, se não for alterado, mantém o valor anterior.

Até o passo 2, o frontend atualmente publicado não deve expor a renovação de documentos expirados. A validação no servidor continuará a recusá-la com uma mensagem clara, sem reutilizar a validade expirada.

## Roteiro de validação pós-migration

Use uma conta de parceiro de teste e execute cada cenário numa transação revertida ou com ficheiros de teste.

1. Reenviar documento rejeitado pela assinatura de três parâmetros: deve criar nova versão pendente.
2. Reenviar documento expirado com a assinatura de três parâmetros: deve falhar, pedindo nova validade.
3. Reenviar documento expirado pela assinatura de cinco parâmetros com validade igual ou anterior a `current_date`: deve falhar.
4. Reenviar o mesmo documento com validade posterior a `current_date` e à validade anterior: deve passar; a nova versão guarda a nova data e a anterior permanece intacta.
5. Com o parceiro em `documentacao_expirada`, o reenvio deve alterar o estado para `em_analise` e manter `disponibilidade = false`.
6. Confirmar na timeline um evento `substituido` para a versão anterior e `reenviado` para a nova.
7. Executar `supabase/tests/versionamento_documental_entregadores.sql` para validar assinaturas, privilégios e estruturas.

## Privacidade das versões

As tabelas de versões e de eventos não concedem `SELECT` direto ao browser,
incluindo administradores autenticados. O histórico administrativo permanece
disponível apenas pela RPC `listar_historico_documental_entregador_admin`, que
devolve metadados e nunca `frente_path` ou `verso_path`.
