# Testes de aceitação — documentos privados de vendedores

Execute esta lista somente depois de aplicar `supabase/20260813_documentos_privados_vendedores.sql` num ambiente de testes. Não use a conta de produção como ambiente de ensaio.

## Vendedor autenticado

1. Criar um vendedor e inserir um documento próprio em estado `pendente`: deve funcionar.
2. Tentar inserir documento com `vendedor_id` de outro vendedor: a RLS deve bloquear.
3. Tentar inserir com `estado = 'aprovado'`: a trigger deve bloquear.
4. Tentar inserir ou atualizar `obrigatorio_para_aprovacao = true`: a trigger deve bloquear.
5. Tentar atualizar ficheiros ou metadados de documento `pendente`: deve bloquear.
6. Repetir para estados `em_analise`, `aprovado` e `expirado`: todos devem bloquear.
7. Um documento `rejeitado` pode ser reenviado apenas para `pendente`, com frente nova e verso opcional novo.
8. Confirmar em `documentos_vendedor_eventos` o evento `reenviado`, os caminhos anterior/novo em `detalhes` e a limpeza do motivo/analisador.
9. Confirmar em Storage que o caminho original continua existente e que o reenvio tem UUID diferente.
10. Tentar `storage.from('documentos-vendedores').upload(caminho_existente, ficheiro, { upsert: true })`: deve falhar, pois não existe policy `UPDATE` para vendedor.
11. Com outro vendedor e com cliente autenticado, tentar criar URL assinada ou descarregar o objeto: ambos devem falhar.

## Administrador autenticado

12. Consultar documentos e eventos: deve funcionar.
13. Aprovar documento: estado, `analisado_por` e `analisado_em` devem ser preenchidos.
14. Rejeitar documento sem motivo: deve falhar; com motivo deve funcionar.
15. Expirar documento: deve funcionar e registar análise.
16. Confirmar que nenhuma ação administrativa altera o objeto original no Storage.

## Regressão de marketplace

17. Como visitante, abrir perfil, produto e serviço de vendedor: devem carregar sem a coluna `documentos`.
18. Como vendedor, iniciar sessão e consultar o próprio perfil: deve carregar normalmente.
19. Como administrador, abrir um pedido novo e abrir frente/verso: as URLs devem ser temporárias.

## Roteiro de correção de candidatura rejeitada

1. Como administrador, rejeite um documento com um motivo claro e rejeite o cadastro do vendedor quando aplicável.
2. Como vendedor rejeitado, faça login: a sessão deve abrir e encaminhar para o dashboard em modo restrito, sem logout automático.
3. Confirme o aviso de cadastro rejeitado, o motivo geral e o motivo do documento rejeitado em **Documentos**.
4. Abra a frente/verso do próprio documento e envie uma nova versão. A interface deve mostrar **Aguardando nova análise**.
5. Como administrador, atualize a página de pedidos, confirme o novo estado, abra a nova versão e aprove ou rejeite novamente.
6. Confirme que o vendedor continua restrito até o administrador alterar explicitamente o estado global da conta.
## Rejeição documental e rejeição geral

1. Como administrador, abra um pedido de vendedor e abra a frente/verso de cada documento.
2. Aprove NIF e Alvará; rejeite apenas o BI, preenchendo o motivo específico. Confirme que só o BI muda para `rejeitado`.
3. Tente rejeitar a candidatura escolhendo **Documentos precisam de correção** sem rejeitar nenhum documento: a aplicação deve impedir e indicar: “Indique primeiro quais documentos precisam de correção.”
4. Depois de rejeitar o BI, rejeite a candidatura como documental. No vendedor, apenas o BI deve ter o botão **Reenviar documento**; NIF/Alvará aprovados devem permanecer imutáveis.
5. Reenvie o BI. Confirme que o estado muda para `pendente`, o botão desaparece e a candidatura global permanece `rejeitado`.
6. Como administrador, abra a nova frente do BI, aprove-a e só depois aprove a candidatura. A conta só deve ficar operacional após esta aprovação global.
7. Faça uma rejeição escolhendo **Motivo não documental**. Confirme que nenhum documento muda de estado e que o vendedor lê: “Não existem documentos assinalados para correção.”
8. Verificações de segurança no Supabase: um vendedor não pode atualizar documento `pendente`, `em_analise`, `aprovado` ou `expirado`; outro vendedor e um cliente não podem ler nem atualizar documentos alheios. Estas verificações dependem das políticas RLS e do trigger `proteger_analise_documento_vendedor` após a migração estar aplicada.
