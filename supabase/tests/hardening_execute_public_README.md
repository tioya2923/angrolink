# Hardening seletivo de EXECUTE — candidato local

## Âmbito e estado

Migration: `20261028010000_hardening_execute_public_funcoes_comerciais.sql`.
Candidata apenas: não aplicada ao staging. Não implementa o Incremento II-A.
Retira somente EXECUTE de PUBLIC nas 22 assinaturas constantes da migration e de
`hardening_execute_public_contexto.sql`. Nenhuma descoberta dinâmica amplia a lista.
Preserva todos os grants diretos não PUBLIC, incluindo grantor e grant option.
Não altera corpos, owners, search_paths, triggers, policies, defaults, Auth ou Storage.

## Contrato e abortos

Executar como postgres. Todas as 22 assinaturas são verificadas antes do primeiro
REVOKE: existência, owner postgres, SECURITY DEFINER, proconfig e definição.
Os fingerprints são MD5 de pg_get_functiondef com search_path pg_catalog e CR
removido; são detectores de divergência, não provas criptográficas.
Mudanças cosméticas ou de deparse entre versões PostgreSQL podem abortar
legitimamente. Não atualizar hashes para contornar um aborto sem nova auditoria.

Grants explícitos EXECUTE de postgres, anon, authenticated e service_role são
obrigatórios. Grants adicionais são aceites, não reparados nem removidos.
PUBLIC só pode ter EXECUTE não delegável concedido pelo owner. Um objeto já sem
PUBLIC é reconhecido e deixado intacto; a reaplicação não reabre acesso.
Divergências geram SQLSTATE 55000. Pós-verificações comparam OID, definição,
owner e todos os grants não PUBLIC; qualquer falha reverte a transação inteira.

Não há serialização universal de DDL administrativo concorrente. Reservar janela
sem DDL/grants concorrentes na futura aplicação. Novas funções e outros caminhos
de privilégio não são automaticamente endurecidos. Este candidato não define o
papel de backend futuro nem concede privilégios para II-A.

## Reprodução exclusivamente local

Pré-requisitos: Node, Docker Desktop ativo e PostgreSQL 17.6 já disponível no
contentor local `supabase_db_angrolink-chat-precompra-local`.
A baseline `angrolink_email_contacto_contract_20261021_v7` deve existir e ter
auth.users vazio. O runner aborta se o nome da sua cópia ou role já existir.
Não aceita URL remota nem credenciais.

No PowerShell, na raiz do repositório:

```powershell
node supabase/tests/hardening_execute_public_prova.cjs
```

Para executar apenas a prova corrigida de rollback (sem repetir regressões,
capacidades ou os cinco casos de divergência):

```powershell
node supabase/tests/hardening_execute_public_prova.cjs --rollback-only
```

Este modo reutiliza apenas a preparação da cópia e dos contratos locais,
incluindo as fixtures fictícias necessárias ao snapshot. Não aceita destinos
remotos ou outros argumentos. Aplica a migration efetiva somente no clone de
rollback; não executa as 170 assertions anteriores.

O runner cria exclusivamente a cópia
`angrolink_parceiros_email_acl_versionada_20261028_a`, clones de falha com
sufixos e o papel NOLOGIN `angrolink_acl_probe_versionada_20261028`.
O controlador postgres recebe SET nesse papel, não o inverso. O papel não recebe
membership em papéis privilegiados. Os scripts SQL exigem prova_db igual à base
corrente e prefixo descartável próprio; não os executar no staging.

Ordem aplicada integralmente na cópia, após clonar a baseline:

1. 20260901020000_corrigir_policies_catalogo_publico.sql
2. 20260901030000_corrigir_policies_operacionais_catalogo.sql
3. 20260901040000_aprovar_parceiro_entrega_atomicamente.sql
4. 20260904030000_corrigir_ownership_documentos_vendedor.sql
5. 20260909040000_aplicar_gates_operacionais_catalogo_huambo.sql
6. 20260909050000_proteger_metricas_comerciais_produtos.sql
7. 20260910010000_proteger_candidatura_vendedor_huambo_documentos.sql
8. 20260928010000_reabrir_analise_parceiro_documentos.sql
9. 20261001010000_alertar_admin_operacoes_entrega.sql
10. parceiros_email_obrigatorio_preparacao.sql (oito fixtures SQL fictícias)
11. 20261026010000_email_obrigatorio_novos_parceiros.sql
12. 20261027010000_contratos_privados_verificacao_email_parceiros.sql
13. contexto; regressao e antes; clones negativos/compatibilidade;
    migration candidata efetiva; depois; regressao; integridade.

Os helpers de teste são SECURITY INVOKER, apenas na cópia. As regressões usam
papéis SQL e claims locais, não sessões HTTP Auth. Dados de Auth são fixtures
SQL sem credenciais reais. Não se testam SMTP, PostgREST, Storage ou Auth nativo.

## Testes e evidência desta implementação

Execução conclusiva em 28/10/2026: PROOF_EXIT=0.

- Regressão antes: 22 assertions.
- Capacidades indevidas antes: 10 assertions.
- Capacidades bloqueadas depois: 39 assertions.
- Regressão depois: 22 assertions.
- Integridade depois: 77 assertions, incluindo as 22 ACLs individuais.
- Total: 170 assertions satisfeitas; **168 não são as duas reproduções da
  falha comercial conhecida**. Não apresentar 170 como percursos funcionais PASS.
- Cinco clones divergentes: assinatura ausente, owner, grant obrigatório ausente,
  corpo redefinido e atributo SECURITY INVOKER. Todos rejeitados com 55000,
  psql exit 3 esperado e todas as ACLs iguais às anteriores à tentativa.
- Clone compatível: 21 revogações/1 já protegida, grant extra preservado;
  reaplicação 0 revogações/22 protegidas, ACLs idênticas.
- O ensaio original de rollback intermediário ficou **inconclusivo na revisão**:
  PgSleep, 57014 e ACLs finais iguais não identificavam a instrução interrompida.
  As 170 assertions anteriores não demonstraram esse ponto. A prova corrigida
  e isolada está documentada abaixo.
- Aplicação nominal, regressões e integridade: exit 0.
- DROP das sete cópias de casos, cópia principal e role próprios: exit 0.

Resultados sanitizados são gerados fora do repositório numa pasta exclusiva
TEMP/angrolink-acl-versionada-*. A execução conclusiva desta tarefa ficou em
angrolink-acl-versionada-2lcBkM. Duas execuções anteriores não passaram:
a primeira teve erro de sintaxe na fixture de redefinição (42601); a segunda
não confirmou o locker e deixou uma cópia/role até limpeza própria posterior.
Ambas são preservadas como evidência de falha, não convertidas em PASS.
Corrigiu-se somente o teste: delimitador SQL e controlo concorrente num worker
independente do event loop síncrono. A migration não foi enfraquecida.

O runner remove apenas recursos que criou, sem FORCE, sem matar backends ou
parar contentores. Se houver falha de limpeza, não repetir: inspecionar a
identidade da cópia/role próprios e sessões antes de qualquer ação adicional.
Nunca remover a baseline ou recursos das provas anteriores.

## Correção focada da prova de rollback intermediário

Execução isolada em 28/10/2026, resultado em
TEMP/angrolink-acl-versionada-dZItPv: PROOF_EXIT=0. Não foram repetidas as
170 assertions nem os cinco casos negativos. Alteraram-se somente o runner e
este README; a migration conserva o SHA-256 aprovado
0E539BFE13C9B1FD41BACDE0BF7E1ECF6C647E612B88D3DAE38C08ECC717459B.

Técnica e critérios obrigatórios:

1. Duas sessões psql próprias, identificadas por application_name exclusivo,
   base corrente e PID. O locker executa BEGIN e ALTER FUNCTION da última
   assinatura, mantém a transação aberta e só é libertado por ROLLBACK.
   O marcador de prontidão só confirma a aquisição inicial, não o progresso
   da migration. Há limites de timeout no PostgreSQL e nos processos próprios.
2. A sessão migradora executa o ficheiro versionado inalterado. Um observador
   exige pg_blocking_pids apontando para o PID do locker, espera transactionid
   ShareLock pelo XID que o locker mantém em ExclusiveLock e tuple lock do
   migrador na linha pg_proc da última assinatura. Exige também backend_xid
   atribuído e o bloco DO efetivo em pg_stat_activity.
3. O erro verbose do servidor deve identificar exatamente
   `revoke execute on function public.validar_veiculo_do_documento_parceiro() from public`
   no contexto SQL, inline_code_block em EXECUTE, SQLSTATE 57014 e causa
   statement timeout. Um timeout no preflight, uma observação ambígua ou a
   ausência do objeto/lock esperado falham o teste. Não se aceita apenas 57014.
4. Antes do ensaio, as 22 funções devem ter PUBLIC EXECUTE. O hash fixo e a
   inspeção do fluxo garantem um ciclo linear na ordem do array, sem captura
   de exceções por REVOKE. A última instrução identificada pelo PostgreSQL só
   é alcançada depois de completar os 21 REVOKEs anteriores na mesma transação.
   Esta é uma prova por fluxo de controlo da migration inalterada, apoiada na
   observação do objeto e no contexto do servidor; **não** é uma leitura externa
   de ACLs não confirmadas, que não ficam visíveis a outra sessão por MVCC.
5. Após a saída do migrador sem COMMIT e ROLLBACK do locker, comparam-se todas
   as ACLs brutas das funções public por OID, abrangendo as 22 e todos os grants
   explícitos. Exige-se ausência dos dois backends e de todos os seus locks.

Evidência observada nesta execução (PIDs são históricos, não alvos de comandos):

- Locker PID 25184, XID 111519; migrador PID 25210, XID 111520.
- Bloqueio transactionid: ShareLock aguardado / ExclusiveLock do locker.
- Tuple lock na última função e bloco DO observados: true.
- Último REVOKE identificado pelo contexto SQL; migrador exit 3 / SQLSTATE 57014.
- 21 REVOKEs anteriores estabelecidos pelo fluxo sequencial acima.
- Locker ROLLBACK e exit 0; ACLs e grants explícitos antes/depois idênticos.
- Zero sessões e locks próprios pendentes; cópia, clone e role removidos com
  exit 0. Resultado isolado PROOF_EXIT=0.

A demonstração é limitada à atomicidade desta execução local; não prova
serialização contra DDL administrativo arbitrário nem compatibilidade remota.

## Cobertura e defeito separado

A regressão cobre RPC de candidatura, submissão, aprovação administrativa,
documentos/versões/eventos, triggers de Auth/profiles, catálogo/RLS, métricas,
helpers e gestão da própria conta. Integridade compara definições, owners,
search_paths, triggers, policies, constraints, tabelas/RLS/grants, defaults,
snapshot histórico e dados. O papel experimental não acede às tabelas privadas
do Incremento I nem executa DEFINER comerciais ou associa triggers DEFINER.

**Primeiro destaque gratuito: não aprovado funcionalmente.**
destacar_servico_gratis tenta atualizar proximo_destaque_servico_em e
proteger_campos_vendedor recusa (P0001), antes e depois. Duas assertions apenas
demonstram a mesma falha preexistente. Não foi corrigida aqui.
O ramo de destaque com período já existente e a remoção têm testes separados.

## Histórico, compatibilidade e limites

A baseline representa um estado local, não uma reprodução integral de todas
as migrations em ordem. A revisão das definições/ACLs posteriores identificou:
versionamento documental 20260814190000 redefine funções alvo já presentes
na baseline; 20260830020000 redefine proteger_campos_vendedor, também presente.
A migration acoplada a Storage não foi reaplicada parcialmente para construir
um estado fictício. As dependências acima usam ficheiros integrais.
20260909050000 já protege métricas de produtos; 20260928010000 converte dois
guards de parceiro para INVOKER: estes cinco objetos não pertencem à lista22.
Grants editoriais de 20261012010000 e administrativos de 20261020010000 não
reabrem as 22 assinaturas. Não foi identificada outra redefinição posterior
dos alvos no histórico revisto; isto não comprova o estado remoto.

**GO para revisão local; NO-GO para aplicação remota agora.**
Antes de qualquer futura autorização de aplicação: inventário remoto read-only
nominal das 22 assinaturas/ACLs/fingerprints/owners/config, versão PostgreSQL,
heranças dos papéis consumidores, compatibilidade do histórico completo,
janela sem DDL e plano transacional de falha. Não reparar diferenças
automaticamente nem generalizar a prova representativa para todo o staging.
Não regrantar PUBLIC como rollback automático. Qualquer restauração exige
auditoria nominal do estado efetivo.

Nenhum frontend, migration anterior, Incremento I, ficheiro legado, artefacto
experimental anterior ou recurso preexistente é alterado por esta tarefa.
