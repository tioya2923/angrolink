# Baseline Supabase da ANGROLINK

## Estado legado

O schema remoto da ANGROLINK foi construído historicamente com scripts SQL executados manualmente, guardados diretamente em `supabase/`. Estes scripts incluem fundação, correções, RLS, Realtime, documentos e parceiros de entrega, mas não formam uma cadeia de migrations da Supabase CLI com ordem e histórico comprováveis.

Os ficheiros legados permanecem no local atual como registo histórico. Não devem ser movidos para `supabase/migrations/`, renomeados, reaplicados nem convertidos retroativamente em migrations. Tentar fazê-lo poderia reaplicar operações já existentes, alterar dados ou criar uma cronologia falsa.

O histórico remoto consultado pela CLI está vazio. Por isso, a estratégia adotada é iniciar uma cadeia limpa **apenas para alterações futuras**, sem reparar o histórico e sem criar uma migration de baseline retroativa.

## Novo padrão

- Todas as novas alterações estruturais ficam exclusivamente em `supabase/migrations/`.
- O nome segue `YYYYMMDDHHMMSS_descricao_curta.sql`, em UTC e `snake_case`.
- Cada migration tem uma intenção clara e um timestamp único.
- Uma migration já aplicada num ambiente partilhado não é editada; a correção é feita numa migration nova.
- O schema remoto não deve ser alterado pelo SQL Editor sem que o mesmo SQL seja primeiro preparado e revisto no repositório.
- Após aplicar migrations no remoto, regenere `src/types/database.types.ts` a partir do projeto Supabase ligado.

## Aplicação segura

Ordem preferida:

1. Ambiente local ou de teste.
2. Staging, quando existir.
3. Produção.

Fluxo para uma alteração futura:

```powershell
git checkout -b nome-da-alteracao
npx supabase migration new descricao_curta
# editar supabase/migrations/YYYYMMDDHHMMSS_descricao_curta.sql
npx supabase migration list --linked
npx supabase db push --dry-run
# testar localmente/num projeto de teste e executar os testes da aplicação
npx supabase db push --linked
npx supabase gen types typescript --project-id <PROJECT_REF> --schema public > src/types/database.types.ts
```

Antes de `db push --linked`, confirmar o projeto ligado e rever o SQL. A opção `--include-all` não deve ser usada para tentar incluir os scripts legados; ela existe para migrations da pasta oficial que não estejam no histórico remoto.

Comandos úteis:

```powershell
npx supabase migration new descricao_curta
npx supabase migration list --linked
npx supabase db push --dry-run
npx supabase db push --linked
npx supabase gen types typescript --project-id <PROJECT_REF> --schema public
```

Não executar `supabase db reset` contra o projeto remoto. `supabase db pull` também não deve ser usado cegamente: pode produzir uma migration volumosa que descreve objetos já criados manualmente e induzir duplicação ou divergência.

## Baseline e histórico remoto

Uma eventual baseline oficial ou `supabase migration repair` precisa de uma tarefa própria e aprovação explícita. Embora opere primariamente no histórico de migrations, pode fazer a CLI considerar estado como aplicado e afetar aplicações futuras. Antes disso, é necessário decidir a versão de baseline, documentar o efeito e validar num ambiente não produtivo.

## Rollback e segurança de dados

Produção não depende de rollback automático destrutivo. Para alterações críticas:

- criar uma migration corretiva;
- preservar dados existentes;
- preferir adições e migrações progressivas;
- evitar `DROP COLUMN`, `DROP TABLE` ou reescritas irreversíveis no mesmo lançamento;
- descontinuar campos em etapas depois de verificar utilização e migração dos dados.

## Schema, seeds e tipos

- **Migrations**: estrutura, constraints, RLS, policies, funções, triggers e grants.
- **Seeds**: somente dados de desenvolvimento/teste. Nunca utilizadores reais, palavras-passe, chaves ou credenciais.
- O script legado `supabase/seed_dados_demo.sql` é apenas seed de demonstração e não pertence à cadeia de migrations.
- Depois de cada alteração remota de schema, regenerar os tipos e executar a validação TypeScript.

O template em `docs/TEMPLATE_MIGRACAO_SUPABASE.sql.md` é uma referência de boas práticas; não é uma migration aplicável.
