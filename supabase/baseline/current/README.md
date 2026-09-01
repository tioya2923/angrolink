# Baseline atual da ANGROLINK para staging

Este diretório é uma fotografia estrutural **local** do projeto remoto em
2026-08-31. Não é migration, não deve ser colocado em `supabase/migrations/`
e não deve ser aplicado no projeto remoto atual.

> Estado: `01_public_schema.sql`, `02_auth_custom.sql`, `03_storage_custom.sql`
> e `04_realtime.sql` foram revistos após o hardening `20260830020000`.

Ordem de aplicação futura, apenas num projeto Supabase novo e isolado:

1. infraestrutura nativa do novo projeto Supabase;
2. `01_public_schema.sql`;
3. `02_auth_custom.sql`;
4. `03_storage_custom.sql`;
5. `04_realtime.sql`;
6. `05_reference_data.sql`;
7. inicialização controlada do histórico de migrations **somente no staging**.

## Conteúdo

| Ficheiro | Conteúdo | Dados operacionais |
| --- | --- | --- |
| `01_public_schema.sql` | Schema `public`: DDL, funções, RPCs, triggers, RLS, policies e grants | Não |
| `02_auth_custom.sql` | Dois triggers sobre `auth.users`; não inclui utilizadores Auth | Não |
| `03_storage_custom.sql` | Cinco buckets e 16 policies; não inclui `storage.objects` | Não |
| `04_realtime.sql` | Membership confirmado de quatro tabelas | Não |
| `05_reference_data.sql` | Seed canónico de referência | Não |

## Storage auditado

| Bucket | Público | Limite | MIME | Necessário em staging |
| --- | --- | --- | --- | --- |
| `produtos` | Sim | Sem limite | Sem restrição | Sim |
| `vendedores` | Sim | Sem limite | Sem restrição | Sim |
| `clientes` | Sim | Sem limite | Sem restrição | Sim |
| `documentos-parceiros` | Não | Sem limite | Sem restrição | Sim |
| `documentos-vendedores` | Não | Sem limite | Sem restrição | Sim |

As políticas de fotografias de vendedores e clientes mantêm primeira pasta
igual a `auth.uid()` em INSERT/UPDATE/DELETE; UPDATE preserva `USING` e
`WITH CHECK`. O bucket `produtos` também exige que a primeira pasta do objeto
seja igual a `auth.uid()` em INSERT, UPDATE e DELETE.

## Estado da referência canónica

`05_reference_data.sql` contém as seis categorias, a política financeira
canónica, os 16 requisitos documentais, as 21 `provincias_angola` e os 326
`municipios_angola`. O seed usa chaves naturais e não contém dados
operacionais.
