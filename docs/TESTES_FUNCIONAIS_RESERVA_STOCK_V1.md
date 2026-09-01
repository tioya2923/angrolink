# Testes funcionais â€” Reserva Transacional de Stock V1

## Estado local confirmado

- PostgreSQL local em `127.0.0.1:5432`: disponÃ­vel.
- `psql`: disponÃ­vel.
- Docker: indisponÃ­vel.
- Stack completa Supabase local: indisponÃ­vel.
- Baseline histÃ³rica oficial ANGROLINK: ausente por decisÃ£o documentada.

Existe uma baseline **exclusivamente para testes**, em
`supabase/tests/baseline/`. Ela Ã© uma composiÃ§Ã£o mÃ­nima para validar o draft de
Reserva Stock V1 numa base PostgreSQL local, vazia e descartÃ¡vel; nÃ£o Ã© uma
migration e nÃ£o pode ser usada contra produÃ§Ã£o ou o Supabase remoto.

## Harness

```powershell
.\scripts\test-reserva-stock-local.ps1 `
  -DatabaseUrl 'postgresql://USER:PASSWORD@HOST:PORT/DATABASE' `
  -BaselineSql '.\supabase\tests\baseline\baseline_pre_reserva_stock.sql'
```

O harness recusa hosts remotos, bases cujo nome nÃ£o termine em `test`/`teste` e
bases que jÃ¡ contenham objetos no schema `public`. Ele nunca altera o draft:
gera uma cÃ³pia temporÃ¡ria e troca apenas o `ROLLBACK;` terminal por `COMMIT;`.

O Docker continua indisponÃ­vel, mas nÃ£o Ã© necessÃ¡rio para este teste limitado:
o shim de Auth da baseline emula apenas `auth.uid()`, `auth.role()`, os papÃ©is
locais `authenticated`/`anon` e as claims de sessÃ£o PostgreSQL. NÃ£o emula GoTrue,
JWT assinado, Storage, Realtime nem polÃ­ticas externas da plataforma Supabase.

## Acesso local

Porta PostgreSQL disponÃ­vel nÃ£o significa autenticaÃ§Ã£o disponÃ­vel. Para evitar
credenciais no repositÃ³rio, configure uma entrada local em `%APPDATA%\postgresql\pgpass.conf`
ou execute o harness num terminal onde o `psql` possa pedir a password de forma
interativa. NÃ£o use `PGPASSWORD` persistente, argumentos gravados, nem URLs
remotas. O harness valida ainda `anon`, `authenticated`, a possibilidade de
`SET ROLE authenticated`, `pgcrypto` e privilÃ©gio `CREATE` antes de escrever na
base descartÃ¡vel.

## Matriz funcional posterior

| Grupo | CenÃ¡rios mÃ­nimos |
| --- | --- |
| InventÃ¡rio | legado; 0; 0.001; 1.125; 10.500; mÃ¡ximo numeric(18,3); negativos e precisÃ£o invÃ¡lida |
| Reserva | checkout controlado; snapshot; sem dÃ©bito fÃ­sico; produto legado sem reserva |
| ConcorrÃªncia | duas sessÃµes/compradores disputando o Ãºltimo stock; uma Ãºnica vencedora |
| Atomicidade | grupo multi-item falha sem encomenda, item, reserva, pagamento ou evento parcial |
| IdempotÃªncia | mesma chave/payload; mesma chave/payload diferente; resposta perdida; chaves por utilizador/modalidade |
| TransiÃ§Ãµes | confirmaÃ§Ã£o, recusa, cancelamento, expiraÃ§Ã£o, OTP e recolha bilateral sem duplicar dÃ©bito/evento |
| Unidade | sem inventÃ¡rio; sem reservas; mesma unidade; ativa; vencida; confirmada; outro campo |
| SeguranÃ§a | anon; comprador; vendedor alheio; grants diretos; helpers privados |

O cenÃ¡rio de Ãºltimo stock requer duas conexÃµes PostgreSQL locais em paralelo;
nÃ£o Ã© vÃ¡lido executÃ¡-lo sequencialmente no mesmo `psql`.
