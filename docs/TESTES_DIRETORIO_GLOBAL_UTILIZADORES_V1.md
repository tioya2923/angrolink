# Testes — Diretório Global de Utilizadores V1

Execute estes cenários somente depois de aplicar a migration e regenerar `src/types/database.types.ts`.

1. Inicie sessão como administrador real presente em `public.administradores` e execute `listar_utilizadores_admin()`.
   Confirme um único objeto com `itens`, `paginacao` e `contagens`; cada conta deve aparecer no máximo uma vez em `itens`.
2. Use uma conta cliente, vendedor e parceiro. Cada uma deve receber erro de permissão ao chamar a RPC.
3. Sem sessão, confirme que a chamada é bloqueada e que `anon` não possui `EXECUTE`.
4. Numa conta que seja cliente e parceiro, confirme que aparece uma vez em “Todos”, com ambos os papéis; deve aparecer nos dois filtros específicos.
5. Valide pesquisa por nome, e-mail e telefone; confirme que não retorna documentos, paths, URLs assinadas, contacto de emergência ou dados financeiros.
6. Confirme filtros por papel, estado por papel, província e registo recente. O diretório não interpreta um estado global de Auth que não existe no schema atual.
7. Confirme limites: `p_limite` acima de 100 retorna no máximo 100 itens; offsets sucessivos não repetem itens. Uma pesquisa sem resultados e um offset após a última página devem devolver `itens: []` com `paginacao` e `contagens` presentes.
8. Confirme que as contagens globais representam contas únicas e contam cada capacidade nos respetivos filtros; `total_resultados` deve representar apenas o filtro atual.
9. Confirme que foto de parceiro privado não é devolvida como URL pelo diretório.
10. Confirme que a página administrativa, após a integração, não oferece eliminação de conta até existir operação servidor-side transacional e auditada.
