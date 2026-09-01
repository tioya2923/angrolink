# Testes manuais — Compradores 360 V1

Execute estes testes apenas após aplicar a migration e regenerar `src/types/database.types.ts`.

1. Inicie sessão como administrador real. A chamada a `listar_compradores_admin()` deve devolver `itens`, `paginacao` e `contagens`, inclusive para uma pesquisa sem resultados ou um offset além da última página.
2. Confirme filtros server-side por pesquisa, tipo `casa`/`negocio`, conta ativa, província, município, disputas, cancelamentos e registo recente. O limite máximo deve ser 100.
3. Confirme que cliente, vendedor, parceiro e anon recebem erro de permissão ao chamar ambas as RPCs.
4. Abra `obter_comprador_admin(cliente_id)` com um comprador de teste. Confirme os dados do comprador, resumo, encomendas, cancelamentos e recusas do vendedor em listas distintas, pagamentos resumidos, disputas e atividade agregada.
5. Confirme que uma conta com outros papéis apresenta somente indicadores desses papéis, sem misturar os estados ou dados de vendedor/parceiro no perfil de comprador.
6. Confirme que não são devolvidos OTP, hashes, tokens, documentos, caminhos privados de documentos, metadados de PSP, palavras-passe ou dados de `auth.users` além do identificador usado internamente.
7. Confirme que não existe ação de eliminar, suspender ou reativar o comprador nesta V1. Essa ação exigirá RPC transacional, motivo obrigatório e expansão de `auditoria_administrativa` para `entidade_tipo = 'cliente'`.

Nenhum destes testes deve processar pagamentos reais, executar reembolsos, alterar estados financeiros ou usar dados de produção.
