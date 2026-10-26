# Email obrigatório de novos parceiros — prova local

Não executar no staging/produção. Estes scripts criam identidades SQL sintéticas,
não contas através do serviço Auth; não enviam emails e não testam passwords.
Não usar os UUIDs de teste como critério da migration de produção.

## Contrato e dependências

- Migration: `20261026010000_email_obrigatorio_novos_parceiros.sql`.
- O snapshot privado contém apenas quem já possuía candidatura na primeira ativação.
  A isenção sobrevive à recriação da linha; não depende da idade de Auth ou de metadata.
- A captura única e instalação do trigger são transacionais e bloqueiam escritas
  concorrentes. Reaplicar não recaptura novos parceiros.
- Schema/tabelas já existentes devem ser os objetos desta migration, com owner e
  estrutura esperados. Colisões ou alterações manuais exigem investigação, não reparação
  automática nem remoção do marcador de ativação para voltar a capturar dados.
- Parceiros históricos não são revalidados. Contas novas precisam de email externo
  válido em INSERT e UPDATE, inclusive dentro da RPC; não há confirmação de titularidade.
- Não muda RPCs, RLS, grants públicos, identidade Auth ou fluxos de outros papéis.
- Requer o domínio versionado de parceiros, `auth.users`, roles Supabase e os contratos
  documentais/territoriais. A baseline local v7 usada na prova não tem histórico de
  migrations; recebeu **na cópia** a dependência versionada
  `20260928010000_reabrir_analise_parceiro_documentos.sql` para reproduzir a proteção
  administrativa atual. Não reaplicar indiscriminadamente essa migration noutra base.

## Preparação das cópias

Usar o contentor PostgreSQL local já saudável. Não reiniciar serviços. Confirmar por
catálogos e contagens que a baseline original não contém contas nem dados comerciais.
Não presumir segurança pelo nome da base. Não imprimir rows, credenciais ou envs.

Exemplo PowerShell, executado na raiz do repositório:

```powershell
$dockerExe = 'C:\Users\willi\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
$container = 'supabase_db_angrolink-chat-precompra-local'
$baseline = 'angrolink_email_contacto_contract_20261021_v7'
$db = 'angrolink_parceiros_email_20261026_versionada_d'
$race = 'angrolink_parceiros_email_20261026_versionada_race_e'
$remoteDir = '/tmp/angrolink_pe_versionada_20261026_d'

# Confirmar que ambos os nomes de base e remoteDir estão livres antes de criar.
# CREATE DATABASE falha se já existir; nunca apagar ou substituir a base existente.
& $dockerExe exec $container psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $db TEMPLATE $baseline;"
if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar cópia funcional' }
& $dockerExe exec $container psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $race TEMPLATE $baseline;"
if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar cópia concorrente' }
& $dockerExe exec $container mkdir $remoteDir
if ($LASTEXITCODE -ne 0) { throw 'Diretório de prova já existe ou não foi criado' }
$files = @(Get-ChildItem supabase/tests/parceiros_email_obrigatorio_*.sql) + @(
  Get-Item supabase/migrations/20261026010000_email_obrigatorio_novos_parceiros.sql
  Get-Item supabase/migrations/20260928010000_reabrir_analise_parceiro_documentos.sql
)
foreach ($file in $files) {
  & $dockerExe cp $file.FullName "${container}:${remoteDir}/$($file.Name)"
  if ($LASTEXITCODE -ne 0) { throw "Falha na cópia de $($file.Name)" }
}
function Invoke-ProvaSql([string]$Database, [string]$File) {
  if ($Database -notmatch '^angrolink_parceiros_email_[a-zA-Z0-9_]+$') { throw 'Nome não autorizado' }
  & $dockerExe exec $container psql -X -U postgres -d $Database -v ON_ERROR_STOP=1 -v "prova_db=$Database" -f "$remoteDir/$File"
  if ($LASTEXITCODE -ne 0) { throw "Falha em $Database / $File" }
}
foreach ($copy in @($db, $race)) {
  Invoke-ProvaSql $copy '20260928010000_reabrir_analise_parceiro_documentos.sql'
  Invoke-ProvaSql $copy 'parceiros_email_obrigatorio_preparacao.sql'
}
```

Variáveis de nomes de base no exemplo devem permanecer limitadas a identificadores
locais fixos. Não aceitar valores externos para montar CREATE DATABASE.

## Funcional, reaplicação e limpeza

```powershell
Invoke-ProvaSql $db '20261026010000_email_obrigatorio_novos_parceiros.sql'
Invoke-ProvaSql $db 'parceiros_email_obrigatorio_funcional.sql'       # 30 assertions; ROLLBACK
Invoke-ProvaSql $db 'parceiros_email_obrigatorio_adicionais.sql'      # 10 assertions; ROLLBACK
Invoke-ProvaSql $db 'parceiros_email_obrigatorio_reaplicacao_pre.sql' # persiste uma candidatura posterior
Invoke-ProvaSql $db '20261026010000_email_obrigatorio_novos_parceiros.sql'
Invoke-ProvaSql $db 'parceiros_email_obrigatorio_reaplicacao_pos.sql' # 2 assertions; ROLLBACK
Invoke-ProvaSql $db 'parceiros_email_obrigatorio_cleanup.sql'        # exige zero fixtures; COMMIT
```

As operações browser usam `SET LOCAL ROLE authenticated`, confirmam `auth.uid()` e
as negativas de email exigem SQLSTATE `23514` **e** constraint
`parceiro_email_nova_candidatura`. Recusas por privilégios/RLS não substituem essas
assertions. Helpers de teste são temporários, não privilégios de produção.

A preparação histórica ocorre antes da migration e fora do rollback funcional.
A limpeza remove exclusivamente os oito UUIDs sintéticos conhecidos, falha se o
conjunto divergir e confirma zero fixtures também nas tabelas relacionadas.
Não aplicar novamente a preparação numa base já ativada/limpa como se fosse pré-política.

## Concorrência: três sessões e observador

Na cópia `$race`, ainda **sem** aplicar a migration, executar:

```powershell
Invoke-ProvaSql $race 'parceiros_email_obrigatorio_concorrencia_bootstrap.sql'
```

O bootstrap cria somente objetos privados vazios para coordenar locks da primeira
ativação. Nunca faz parte da migration real. Executar as sessões em paralelo, com
as mesmas variáveis do exemplo, em terminais distintos:

1. Bloqueador: `Invoke-ProvaSql $race 'parceiros_email_obrigatorio_concorrencia_bloqueador.sql'`.
   O lock privado termina automaticamente com ROLLBACK após 55 segundos.
2. Ativação:
   `& $dockerExe exec -e PGAPPNAME=parceiros_email_ativacao $container psql -X -U postgres -d $race -v ON_ERROR_STOP=1 -f "$remoteDir/20261026010000_email_obrigatorio_novos_parceiros.sql"`.
3. Observador, antes do writer:
   `& $dockerExe exec $container psql -X -U postgres -d $race -v ON_ERROR_STOP=1 -v "prova_db=$race" -v observar_writer=false -f "$remoteDir/parceiros_email_obrigatorio_concorrencia_observar.sql"`.
   Exigir exit 0: ativação espera no objeto privado, mantendo ShareRowExclusiveLock em parceiros.
4. Writer:
   `& $dockerExe exec -e PGAPPNAME=parceiros_email_writer $container psql -X -U postgres -d $race -v ON_ERROR_STOP=1 -v "prova_db=$race" -f "$remoteDir/parceiros_email_obrigatorio_concorrencia_writer.sql"`.
5. Enquanto o writer espera, o observador executa o comando do passo 3 com
   `-v observar_writer=true`. Exigir exit 0: RowExclusiveLock do writer não concedido.
6. Exigir exit 0 nas três sessões: ativação COMMIT; writer recebe a constraint de
   email esperada e faz ROLLBACK. Se a janela de locks não for observada, o ensaio é
   inconclusivo, não PASS. Não enfraquecer as observações.
7. Executar `Invoke-ProvaSql $race 'parceiros_email_obrigatorio_concorrencia_pos.sql'` e
   depois `Invoke-ProvaSql $race 'parceiros_email_obrigatorio_cleanup.sql'`.

Registar os exits separadamente. Não terminar processos pelo nome nem mexer nas
bases originais para recuperar uma prova. As cópias limpas podem ser preservadas
para diagnóstico; não apagar bases/contentores de ensaios anteriores.

## Limitações

Prova PostgreSQL local de obrigatoriedade, não prova de posse do email nem de
entrega SMTP. Não demonstra equivalência automática com o staging. Antes de futura
aplicação remota será necessário preflight autorizado de histórico, objetos privados,
owners, grants, triggers e restantes contratos efetivamente aplicados.
