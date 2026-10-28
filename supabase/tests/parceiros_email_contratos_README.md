# Incremento I — contratos privados passivos

Migration: `../migrations/20261027010000_contratos_privados_verificacao_email_parceiros.sql`.
Requer PostgreSQL 15+; prova executada em PostgreSQL 17.6 local. Executor/owner: `postgres`.
Nao aplicar remotamente como parte desta prova.

## Fronteira e contratos

O schema novo `parceiros_email_verificacao_privado` separa estes contratos do snapshot
fechado `parceiros_email_privado.legados`. Nao existe dependencia do snapshot nem
recaptura de isencoes. Nao sao criados endpoints, funcoes operacionais, workers,
policies permissivas, triggers comerciais ou exigencias de verificacao ativas.

| Tabela | Contrato estrutural | Nao implementa |
| --- | --- | --- |
| desafios | UUID/email/finalidade/geracao, verificador HMAC versionado de 32 bytes, tentativas, prazo e estado | Geracao, comparacao de OTP, cooldown ou consumo atomico |
| comprovacoes | Origem consumida, UUID/email/finalidade exatos, versao, auditoria e uma prova ativa por identidade/finalidade | Prova criptografica de posse, imutabilidade perante o owner ou elegibilidade comercial |
| continuacoes | Prova vinculada, tentativa, operacao/chave, prazo curto independente e estados | Autorizacao operacional, verificacao da revogacao ou conclusao comercial |
| outbox | Geracao exata, deduplicacao, lease, tentativas e envelope AES-GCM versionado | Cifragem real, entrega, exclusao concorrente de workers ou exactly-once SMTP |
| idempotencia | UUID/operacao/chave, tentativa, hash versionado e resposta minima | Canonicalizacao da intencao, retry/replay ou transacao da RPC comercial |
| orcamentos | Identidade/endereco/origem/global, janela, metrica, reservas e limite | Incremento atomico, normalizacao de janelas, antissobreposicao ou rate limiting distribuido |

Todos os dados usados pelos testes sao ficticios. Valores bytea de teste sao apenas
fixtures de formato: nao representam HMAC ou cifragem validos.

### Validades, retencao e FKs

- OTP tem prazo proprio; comprovacao persistente nao tem TTL de OTP.
- Uma comprovacao exige uma origem com estado `consumido`. Esse estado terminal
  deve ser retido enquanto existir a comprovacao. Nao converter um desafio consumido
  em expirado/invalidado por ter decorrido o prazo. Expiracao e invalidacao aplicam-se
  aos desafios ainda nao consumidos. A FK recusa a alteracao da origem comprovada.
- E permitido purgar o verificador de um desafio terminal, guardando a data de
  eliminacao; a linha de origem e a comprovacao continuam auditaveis.
- Revogar/substituir a comprovacao exige estado e data explicitos. Nao apaga a
  origem. Um novo desafio, inclusive para outro email, nao revoga automaticamente
  a comprovacao anterior e nao autoriza o email novo sem nova prova.
- Continuacao tem expiracao independente; a sua expiracao nao revoga a prova.
  O backend futuro deve consultar estado/prazo da continuacao e estado da prova,
  sob controlo transacional, antes de permitir qualquer operacao.
- Nao ha checks contra `now()` nem processamento automatico de expiracoes. Os
  testes de expiracao demonstram independencia estrutural, nao um executor temporal.
- FKs compostas impedem combinar origem/UUID/email/finalidade distintos. Nao
  equivalem a um registo imutavel contra o owner nem a uma verificacao de posse real.
- As FKs entre tabelas privadas sao `NO ACTION DEFERRABLE INITIALLY DEFERRED`;
  as FKs para Auth sao `ON DELETE CASCADE`. Isso permite a eliminacao transacional
  de todas as linhas privadas da identidade, sem remover isoladamente uma origem.
  Os orcamentos pseudonimizados/globais nao pertencem a um UUID e requerem uma
  futura politica de retencao propria.
- `resultado_parceiro_id` e referencia logica, sem FK comercial, para nao bloquear
  a recriacao legitima de candidaturas atuais. Ownership, existencia do resultado,
  comportamento apos eliminacao e replay devem ser definidos no Incremento III.
- A unicidade `(user_id,tentativa_id)` limita a uma linha de continuacao por tentativa.
  Renovacao exige protocolo transacional futuro explicito; nao inserir continuacoes
  concorrentes com a mesma tentativa. O ledger isola a chave por identidade/operacao.

## Privilegios

Owner explicito `postgres`; RLS nas seis tabelas e nenhuma policy. Sem USAGE/CREATE
no schema ou grants nas tabelas para PUBLIC, anon, authenticated e service_role.
Nao ha funcoes operacionais nem SECURITY DEFINER neste incremento. Os helpers de
teste sao temporarios, SECURITY INVOKER, e desaparecem com o rollback/sessao.

Os REVOKEs de default privileges sao limitados a este schema; nao alteram defaults
globais nem grants comerciais. PostgreSQL nao permite que um REVOKE por schema
anule um grant global de default privileges (incluindo EXECUTE de PUBLIC em futuras
funcoes). Qualquer funcao futura devera revogar EXECUTE explicitamente, ter ACL
testada e privilegios minimos; este incremento nao concede identidade de backend.
RLS nao protege contra o owner/superuser e service_role continua a precisar de
ACL/USAGE mesmo tendo BYPASSRLS. Nao ha novas permissoes de acesso ao public.

As FKs instalam triggers **internos** de integridade referencial, inclusive no lado
Auth referenciado. Nao ha ALTER de colunas/dados Auth, triggers de negocio novos,
mudancas a login/Confirm Email/recuperacao, RPCs, Storage ou politicas comerciais.

## Prova local reproduzivel

Usar apenas uma copia descartavel, sem servicos Auth/PostgREST apontados para ela.
Nunca usar staging, nem `psql --single-transaction` envolvendo a migration (ela tem
BEGIN/COMMIT proprios). Manter `ON_ERROR_STOP=1` em todos os comandos.

1. Confirmar baseline local vazia e criar copia com prefixo
   `angrolink_parceiros_email_inc1_` (nome literal escolhido e confirmado como livre).
   Na prova foi usada a baseline `angrolink_email_contacto_contract_20261021_v7`.
2. Na copia, aplicar a dependencia versionada
   `20260928010000_reabrir_analise_parceiro_documentos.sql`.
3. Executar `parceiros_email_obrigatorio_preparacao.sql` com
   `-v prova_db=NOME_EXATO_DA_COPIA`. Cria oito fixtures Auth SQL (sem credenciais)
   e dois parceiros historicos ficticios; nao envia emails nem usa contas reais.
4. Aplicar `20261026010000_email_obrigatorio_novos_parceiros.sql` apenas na copia.
5. Na **mesma sessao psql**, executar nesta ordem:

   ```sql
   \set ON_ERROR_STOP on
   \i supabase/tests/parceiros_email_contratos_antes.sql
   \i supabase/migrations/20261027010000_contratos_privados_verificacao_email_parceiros.sql
   \i supabase/tests/parceiros_email_contratos_funcional.sql
   ```

   Fornecer `-v prova_db=NOME_EXATO_DA_COPIA`. Alternativamente concatenar esses
   tres ficheiros em memoria e encaminhar por stdin para psql no contentor local.
   A captura usa objetos temporarios que sobrevivem ao COMMIT da migration.
   Nao regista nem imprime dados individuais.
6. A suite usa as fixtures Auth locais 3 e 4 e termina com ROLLBACK. Cada negativa
   valida SQLSTATE; a primeira divergencia interrompe com exit nao zero. FKs
   diferidas sao forcadas com SET CONSTRAINTS antes de avaliar o resultado.
7. Confirmar seis tabelas privadas vazias, oito fixtures preparadas e snapshot de
   dois parceiros ficticios; remover exclusivamente a base criada para esta prova.
   Nao parar contentores nem remover volumes, bases ou scripts anteriores.

O catalogo compara owners/ACL/RLS de relacoes e schemas, indices, constraints,
policies, definicoes e ACLs de funcoes e triggers comerciais, alem do conteudo do
snapshot. Nao inclui triggers internos das novas FKs na contagem comercial.

## Aplicacao unica e limites

DDL estrito: CREATE SCHEMA falha em colisao. A migration e transacional, sem
DROP CASCADE, reparacao automatica ou recaptura de historico. Aplicacao limpa,
reaplicacao manual e idempotencia comercial sao conceitos diferentes. O runner
nao deve reaplicar DDL numa copia onde a primeira aplicacao ja terminou.

Reexecutar apenas a suite numa copia ja migrada testa constraints, mas uma nova
captura nessa fase nao prova a comparacao com o estado anterior a primeira aplicacao.
Para uma prova integral, usar a ordem acima numa copia nova.

Ficam para o Incremento II: backend confiavel com identidade/grants minimos,
segredos externos e rotacao, geracao/HMAC/cifragem reais, consumo atomico, quotas
distribuidas, reenvio, outbox/entrega controlada e logs sanitizados. Exigem provas
especificas, incluindo concorrencia e falhas ambiguas de SMTP. Enforcement e
idempotencia comercial (III), Storage (IV), React (V) e rollout/regressao (VI)
continuam fora do ambito. A criacao inicial de identidades Auth com email ainda
nao comprovado continua a ser um risco residual, nao resolvido por estas tabelas.

## Resultado da retoma (28/10/2026)

- Os tres ficheiros existentes foram reutilizados. Corrigidos cinco nomes de CHECK
  em colisao com nomes automaticos; nenhuma regra foi relaxada.
- Corrigida a referencia a pg_temp no teste de permissoes. Duas negativas de FK
  passaram a alterar uma unica identidade, para nao colidirem antes com UNIQUE.
- Reforcados os testes de origem consumida, purga de verificador, prova ativa unica,
  papel efetivo e mesma chave entre duas operacoes e identidades.
- Execucao integral final: **51 assertions PASS, 0 FAIL, exit 0**, com captura
  anterior e posterior na mesma sessao, sobre a copia
  `angrolink_parceiros_email_inc1_20261028_final_b`.
- Preparacao final: exit 0. Migration aplicada uma unica vez por copia, com COMMIT.
  As execucoes intermedias que falharam tiveram exit 3 e nao contam como aprovadas.
- A copia anterior `angrolink_parceiros_email_inc1_20261027_a` foi reutilizada ate
  concluir os testes; a copia final permitiu verificar os tres scripts finais em
  sequencia sem reaplicar a migration ja instalada na primeira.
- Antes da limpeza, ambas tinham oito fixtures Auth, dois parceiros ficticios no
  snapshot e zero linhas nas seis tabelas novas. DROP de cada copia: exit 0;
  verificacao posterior: zero copias remanescentes, exit 0. Bases anteriores mantidas.
- Nenhum acesso remoto, envio, stage, commit ou alteracao de frontend. Os tres
  parceiros historicos do staging nao foram consultados nem modificados; a sua
  preservacao remota nao foi revalidada por esta prova local.

Estes resultados sao estruturais e de constraints PostgreSQL. Nao demonstram
validacao de OTP real, cifragem real, entrega SMTP, idempotencia comercial ou
seguranca operacional de um backend ainda inexistente.
