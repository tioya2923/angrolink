<#
.SYNOPSIS
Executa a Reserva de Stock V1 exclusivamente numa base PostgreSQL local de teste.

.DESCRIPTION
O draft original termina com ROLLBACK e nunca é alterado. Este harness cria uma
cópia temporária, substitui somente o ROLLBACK terminal por COMMIT nessa cópia,
aplica-a após uma baseline local explicitamente indicada e executa os testes SQL.
Recusa hosts remotos e nomes de base que não indiquem ambiente de teste.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$DatabaseUrl,

  [Parameter(Mandatory)]
  [string]$BaselineSql,

  [string]$SmokeSql = (Join-Path $PSScriptRoot '..\supabase\tests\baseline\50_smoke_funcional_inventario.sql'),

  [string]$TestSql = (Join-Path $PSScriptRoot '..\supabase\tests\reserva_stock_inventario_v1.sql'),

  [switch]$ManterArtefactosTemporarios
)

$ErrorActionPreference = 'Stop'

function Assert-CaminhoExistente([string]$Caminho, [string]$Descricao) {
  if (-not (Test-Path -LiteralPath $Caminho -PathType Leaf)) {
    throw "$Descricao não encontrado: $Caminho"
  }
}

try {
  $uri = [Uri]$DatabaseUrl
} catch {
  throw 'DatabaseUrl inválida.'
}

if ($uri.Scheme -notin @('postgres', 'postgresql')) {
  throw 'A base de testes deve usar uma URL PostgreSQL local.'
}

if ($uri.Host -notin @('localhost', '127.0.0.1', '::1', 'host.docker.internal')) {
  throw 'Execução recusada: DatabaseUrl não aponta para um host PostgreSQL local.'
}

$nomeBase = $uri.AbsolutePath.Trim('/')
if ([string]::IsNullOrWhiteSpace($nomeBase) -or $nomeBase -notmatch '(?i)(test|teste)$') {
  throw 'Execução recusada: use uma base local descartável cujo nome termine em test ou teste.'
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  throw 'psql não está disponível. Instale/configure PostgreSQL local antes de executar este harness.'
}

$raiz = Resolve-Path (Join-Path $PSScriptRoot '..')
$draftOriginal = Join-Path $raiz 'supabase\drafts\reserva_stock_v1.sql'
Assert-CaminhoExistente $draftOriginal 'Draft de Reserva Stock V1'
Assert-CaminhoExistente $BaselineSql 'Baseline SQL local'
Assert-CaminhoExistente $SmokeSql 'Smoke funcional local'
Assert-CaminhoExistente $TestSql 'Teste SQL de Reserva Stock V1'

$partesBaselineEsperadas = @(
  '00_auth_test_shim.sql',
  '10_schema_pre_reserva_stock.sql',
  '20_funcoes_pre_reserva_stock.sql',
  '30_rls_grants_pre_reserva_stock.sql',
  '40_smoke_pre_reserva_stock.sql'
)
$conteudoComposicao = Get-Content -LiteralPath $BaselineSql -Raw -Encoding UTF8
$inclusoesBaseline = [regex]::Matches($conteudoComposicao, '(?im)^\s*\\ir\s+([^\r\n]+?)\s*$') |
  ForEach-Object { $_.Groups[1].Value.Trim() }
if (@($inclusoesBaseline).Count -ne $partesBaselineEsperadas.Count -or
  (Compare-Object $inclusoesBaseline $partesBaselineEsperadas -SyncWindow 0)) {
  throw 'A composição da baseline não contém exatamente as cinco partes test-only aprovadas.'
}

$diretorioBaseline = Split-Path -Parent (Resolve-Path -LiteralPath $BaselineSql)
$fontesBaseline = foreach ($parte in $partesBaselineEsperadas) {
  $caminho = Join-Path $diretorioBaseline $parte
  Assert-CaminhoExistente $caminho "Parte da baseline $parte"
  $conteudo = Get-Content -LiteralPath $caminho -Raw -Encoding UTF8
  if ($conteudo -notmatch 'TEST-ONLY' -or $conteudo -match '(?im)^\s*(begin|commit|rollback|start\s+transaction)\s*;') {
    throw "A parte da baseline $parte não é segura para composição transacional."
  }
  $conteudo
}

$conteudoDraft = Get-Content -LiteralPath $draftOriginal -Raw -Encoding UTF8
$cabecalhoEsperado = '(?s)\A\s*--\s*DRAFT LOCAL\s+—\s+NÃO APLICAR.*?\bbegin\s*;'
if ($conteudoDraft -notmatch $cabecalhoEsperado) {
  throw 'O draft não começa pelo contrato DRAFT LOCAL e BEGIN esperado; o original não foi alterado.'
}

# Esta expressão é deliberadamente ancorada ao fim absoluto: só aceita o
# ROLLBACK como último comando significativo, seguido no máximo de whitespace.
$rollbackTerminal = [regex]::Match(
  $conteudoDraft,
  '(?is)\A(?<corpo>[\s\S]*)(?:\r?\n)[ \t]*ROLLBACK;[ \t]*(?:\r?\n)*\z'
)
if (-not $rollbackTerminal.Success) {
  throw 'O draft deve terminar exatamente em ROLLBACK; sem SQL significativo posterior; o original não foi alterado.'
}

$rollbacks = [regex]::Matches($conteudoDraft, '(?im)^[ \t]*ROLLBACK;[ \t]*$')
if ($rollbacks.Count -ne 1) {
  throw 'O draft contém ROLLBACK adicional ou ambíguo; nenhuma cópia foi aplicada.'
}

$semRollback = $rollbackTerminal.Groups['corpo'].Value
$envelopeInicial = [regex]::Match($semRollback, '(?is)\A(?<antes>.*?)\bbegin\s*;(?<corpo>[\s\S]*)\z')
if (-not $envelopeInicial.Success -or $envelopeInicial.Groups['antes'].Value -notmatch '(?is)\A\s*(?:--[^\r\n]*(?:\r?\n|$)\s*)+\z') {
  throw 'O draft não possui um BEGIN inicial isolado após o cabeçalho; a cópia não foi criada.'
}
$corpoDraft = $envelopeInicial.Groups['corpo'].Value

# Não reaproveita uma base que já contenha objetos de aplicação. O harness não
# apaga nem reinicializa bases: a base local descartável tem de nascer limpa.
$objetosPublicos = & psql $DatabaseUrl '--tuples-only' '--no-align' '--set=ON_ERROR_STOP=1' '--command' "select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'auth') and c.relkind in ('r','p','v','m','S','f');"
if ($LASTEXITCODE -ne 0) { throw "Não foi possível verificar se a base local está limpa (exit code $LASTEXITCODE)." }
if ([int]($objetosPublicos | Select-Object -First 1).Trim() -ne 0) {
  throw 'Execução recusada: a base de teste já contém objetos nos schemas public/auth. Crie uma base descartável vazia; o harness não apaga dados.'
}

$preRequisitos = & psql $DatabaseUrl '--tuples-only' '--no-align' '--field-separator=|' '--set=ON_ERROR_STOP=1' '--command' "select exists(select 1 from pg_roles where rolname = 'anon'), exists(select 1 from pg_roles where rolname = 'authenticated'), exists(select 1 from pg_available_extensions where name = 'pgcrypto'), has_database_privilege(current_database(), 'CREATE'), has_privs_of_role(session_user, 'authenticated');"
if ($LASTEXITCODE -ne 0) { throw "Não foi possível validar roles/pgcrypto locais (exit code $LASTEXITCODE)." }
$preRequisitosPartes = ($preRequisitos | Select-Object -First 1).Trim().Split('|')
if ($preRequisitosPartes.Count -ne 5 -or $preRequisitosPartes[0] -ne 't' -or $preRequisitosPartes[1] -ne 't') {
  throw 'O cluster local precisa das roles anon e authenticated antes da baseline. O harness não cria roles globais automaticamente.'
}
if ($preRequisitosPartes[2] -ne 't' -or $preRequisitosPartes[3] -ne 't') {
  throw 'O utilizador local precisa de pgcrypto disponível e privilégio CREATE na base descartável. Nenhuma alteração foi executada.'
}
if ($preRequisitosPartes[4] -ne 't') {
  throw 'O utilizador local precisa poder SET ROLE authenticated para o smoke do shim. O harness não altera memberships globais.'
}

$diretorioTemporario = Join-Path ([System.IO.Path]::GetTempPath()) ("angrolink-reserva-stock-" + [guid]::NewGuid())
$null = New-Item -ItemType Directory -Path $diretorioTemporario
$preparacaoTemporaria = Join-Path $diretorioTemporario 'preparacao_reserva_stock_v1.sql'
$composicao = @(
  '-- ARTEFACTO TEMPORÁRIO GERADO PELO HARNESS — NÃO VERSIONAR',
  '\set ON_ERROR_STOP on',
  'begin;'
) + $fontesBaseline + @($corpoDraft.Trim()) + @('commit;')
Set-Content -LiteralPath $preparacaoTemporaria -Value (($composicao -join [Environment]::NewLine) + [Environment]::NewLine) -Encoding UTF8

try {
  # CREATE SCHEMA/TABLE/FUNCTION/EXTENSION, ALTER, RLS e grants desta baseline
  # são transacionais no PostgreSQL. Se baseline ou draft falhar, o psql termina
  # sem COMMIT e a preparação é revertida; roles globais nunca são criadas aqui.
  & psql $DatabaseUrl '--set=ON_ERROR_STOP=1' '--file' $preparacaoTemporaria
  if ($LASTEXITCODE -ne 0) { throw "A preparação atómica baseline+draft falhou (exit code $LASTEXITCODE); a base não foi preparada." }

  & psql $DatabaseUrl '--set=ON_ERROR_STOP=1' '--file' $SmokeSql
  if ($LASTEXITCODE -ne 0) { throw "O smoke funcional local falhou (exit code $LASTEXITCODE). A preparação foi concluída, mas a base deve ser descartada e recriada antes de nova tentativa; o harness não apaga dados." }

  & psql $DatabaseUrl '--set=ON_ERROR_STOP=1' '--file' $TestSql
  if ($LASTEXITCODE -ne 0) { throw "Os testes SQL falharam (exit code $LASTEXITCODE). A preparação foi concluída, mas a base deve ser descartada e recriada antes de nova tentativa; o harness não apaga dados." }
} finally {
  if (-not $ManterArtefactosTemporarios -and (Test-Path -LiteralPath $diretorioTemporario)) {
    Remove-Item -LiteralPath $diretorioTemporario -Recurse -Force
  }
}
