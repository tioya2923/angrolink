# Baseline local de testes — Reserva Stock V1

Esta baseline vive em `supabase/tests/baseline/`. É **test-only**, não é migration,
não representa uma cronologia histórica remota e não pode ser usada por `supabase db push`.

## Estratégia

Foi usado DDL final mínimo reconstruído, em vez de concatenar scripts antigos. O
histórico anterior à primeira migration oficial contém scripts manuais sem cronologia
verificável; reaplicá-los cegamente numa base vazia introduziria estados intermédios,
dados demo e políticas substituídas.

| Ficheiro | Proveniência | Objetos cobertos |
|---|---|---|
| `00_auth_test_shim.sql` | contratos Supabase Auth usados no SQL | `auth.users`, `auth.uid()`, roles locais, `pgcrypto` |
| `10_schema_pre_reserva_stock.sql` | scripts legados + fundações de encomendas/finanças/entrega | perfis, catálogo, encomendas, pagamentos, entrega e notificações |
| `20_funcoes_pre_reserva_stock.sql` | migrations de encomendas, elegibilidade, finanças, território, comprador e notificações | helpers de checkout e notificação |
| `30_rls_grants_pre_reserva_stock.sql` | padrão RLS aplicado | leitura mínima e execução por `authenticated` |
| `40_smoke_pre_reserva_stock.sql` | dependências extraídas do draft | contratos mínimos antes de aplicar o draft |

## Inventário e grafo mínimo

Os scripts raiz `supabase/20260802_*` e `20260803_*` definem e corrigem o domínio
legado de perfis, vendedores, clientes, produtos e parceiros. Não são uniformemente
idempotentes e não são uma cadeia oficial de bootstrap; `seed_dados_demo.sql` foi
excluído. As migrations relevantes são `20260813033038`, `20260813142502`,
`20260813174612`, `20260814220000`, `20260820120000`, `20260822180000`–
`20260824130000`, `20260822200000`, `20260823010000` e `20260823020000`.

| Script histórico | Contribuição observada | Reaplicar numa base vazia? |
|---|---|---|
| `20260802_contactos_vendedor_clientes.sql` | contactos de vendedor/cliente | Não: altera tabelas legadas prévias |
| `20260802_hardening_rls_e_tipos_vendedor.sql` | RLS, tipos e hardening de vendedor | Não: depende do schema legado |
| `20260802_motivo_rejeicao_vendedor.sql` | motivo de rejeição | Não: alteração incremental |
| `20260802_visibilidade_vendedores_suspensos.sql` | catálogo de vendedores suspensos | Não: políticas/consultas incrementais |
| `20260803_descontos_servicos.sql` | descontos de serviços | Não: domínio independente do smoke |
| `20260803_normalizar_perfis_e_servicos.sql` | perfis e serviços | Não: estado intermédio legado |
| `20260803_parceiros_entrega_fundacao.sql` | parceiros e documentos | Parcial: depende de Auth/perfis pré-existentes |
| `20260803_telefone_indicativo_separado.sql` | telefone normalizado | Não: alteração incremental |
| `20260804_*`, `20260805_*`, `20260811_*` | correções do cadastro de parceiros | Não: correções sucessivas |
| `20260812_ativar_realtime.sql` | publication Realtime | Excluído: não é necessário no teste PostgreSQL puro |
| `20260813_documentos_privados_vendedores.sql` | media/documentos privados | Excluído: não é dependência do draft |
| `mais_destaques.sql`, `migracao_consolidar_tipo_vendedor.sql` | catálogo/taxonomia comercial | Não: scripts de alteração sem ordem comprovada |
| `seed_dados_demo.sql` | dados de demonstração | Nunca: dados não pertencem à baseline |

Os scripts legados podem ter triggers, índices, grants e efeitos sobre Storage/Auth;
não foram copiados porque a baseline não exerce documentos, Storage nem Realtime.

`Reserva Stock` depende de produtos/vendedores/clientes, encomendas/itens/eventos,
pagamentos/tentativas/eventos financeiros e, nas transições já presentes, códigos de
levantamento, endereços, parceiros e atribuições. Notificações são usadas apenas na
expiração idempotente.

## Limites do shim Auth

Os testes definem `SET LOCAL request.jwt.claim.sub` e `SET LOCAL ROLE authenticated`.
Isto valida autorização SQL e RLS local, mas não valida JWT assinado, GoTrue, Storage,
Realtime ou Edge Functions. Use apenas uma base PostgreSQL local vazia cujo nome termine
em `test` ou `teste`, e apenas dados sintéticos.

## Preparação atómica e pré-requisitos locais

O harness gera um artefacto temporário que contém uma única transação:
`BEGIN;` → cinco partes da baseline → corpo do draft sem o seu `BEGIN`/`ROLLBACK`
próprios → `COMMIT;`. As operações usadas nesta composição (`CREATE SCHEMA`,
`CREATE EXTENSION pgcrypto`, DDL, funções, RLS e grants) são transacionais em
PostgreSQL. Se baseline ou draft falhar, a sessão termina sem `COMMIT` e não
deixa uma base parcialmente preparada.

As roles `anon` e `authenticated` são cluster-level. Para evitar efeito global
irreversível por base, a baseline não as cria nem as remove. Antes de executar,
o administrador do PostgreSQL local deve providenciar ambas e permitir que o
utilizador de teste faça `SET ROLE authenticated`. O harness também exige que
`pgcrypto` esteja disponível e que a conta tenha `CREATE` na base descartável.

Se o smoke funcional ou o teste estrutural falhar depois do `COMMIT` de
preparação, o harness não apaga a base: ele indica explicitamente que ela deve
ser descartada e recriada antes de nova tentativa.
