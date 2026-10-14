<#
  Executar apenas numa base PostgreSQL local descartável já preparada com a
  migration 20261012010000. Este roteiro abre duas sessões psql independentes.
  A sessão coordenadora segura o mesmo advisory lock usado pela RPC e só é
  terminada depois de pg_stat_activity confirmar as duas chamadas à espera;
  portanto o teste não depende de um atraso arbitrário para simular corrida.
#>
[CmdletBinding()]
param(
  [string]$HostName = '127.0.0.1',
  [int]$Port = 54322,
  [string]$Database = 'angrolink_destaques_editoriais_clean_20261013',
  [string]$UserName = 'postgres'
)

$ErrorActionPreference = 'Stop'
$previousPassword = $env:PGPASSWORD
$env:PGPASSWORD = 'postgres'
$tempRoot = Join-Path $env:TEMP ('angrolink-destaques-concorrencia-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tempRoot | Out-Null
$assertions = 0
$cleanupExit = 1
$succeeded = $false

function Invoke-LocalPsql {
  param([string]$File, [switch]$AllowFailure)
  & psql.exe -h $HostName -p $Port -U $UserName -d $Database -v ON_ERROR_STOP=1 -f $File | Out-Host
  $exit = $LASTEXITCODE
  if (-not $AllowFailure -and $exit -ne 0) { throw "psql falhou ($exit): $File" }
  return $exit
}

function Write-Utf8File {
  param([string]$Path, [string]$Contents)
  [System.IO.File]::WriteAllText($Path, $Contents, [System.Text.UTF8Encoding]::new($false))
}

function New-FixturesSql {
  param([bool]$SameVendor)
  $vendorForSecond = if ($SameVendor) { 'd2200000-0000-4000-8000-000000000008' } else { 'd2200000-0000-4000-8000-000000000009' }
  @"
delete from public.eventos_destaques_produtos_editoriais
where destaque_id in (select id from public.destaques_produtos_editoriais where produto_id::text like 'd2300000-0000-4000-8000-%');
delete from public.destaques_produtos_editoriais where produto_id::text like 'd2300000-0000-4000-8000-%';
delete from public.produtos where id::text like 'd2300000-0000-4000-8000-%';
delete from public.vendedores where id::text like 'd2200000-0000-4000-8000-%';
delete from public.administradores where user_id in ('d2000000-0000-4000-8000-000000000001'::uuid, 'd2000000-0000-4000-8000-000000000002'::uuid);
delete from public.clientes where id::text like 'd2100000-0000-4000-8000-%';
delete from auth.users where id in ('d2000000-0000-4000-8000-000000000001'::uuid, 'd2000000-0000-4000-8000-000000000002'::uuid)
   or id::text like 'd2100000-0000-4000-8000-%';

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated','authenticated', email, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  values
    ('d2000000-0000-4000-8000-000000000001'::uuid, 'conc-admin-1@test.local'),
    ('d2000000-0000-4000-8000-000000000002'::uuid, 'conc-admin-2@test.local')
) admins(id,email);
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000',
       ('d2100000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
       'authenticated','authenticated','conc-vendedor-' || i || '@test.local','',now(),'{}'::jsonb,'{}'::jsonb,now(),now()
from generate_series(1,9) i;
insert into public.administradores(user_id) values
('d2000000-0000-4000-8000-000000000001'),('d2000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','d2000000-0000-4000-8000-000000000001',false);
insert into public.vendedores(id,user_id,nome_comercial,nome_responsavel,telefone_whatsapp,email,provincia,municipio,tipo_vendedor,status_aprovacao,conta_ativa)
select ('d2200000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
       ('d2100000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
       'Vendedor concorrencia ' || i,'Responsavel','9232000' || lpad(i::text,2,'0'),'conc-vendedor-' || i || '@test.local','Huambo','Huambo','revendedor','aprovado',true
from generate_series(1,9) i;
insert into public.produtos(id,vendedor_id,nome_produto,categoria_id,provincia,municipio,publicado,disponivel,preco_aproximado,unidade,tipo_venda)
select ('d2300000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
       case when i=9 then '$vendorForSecond'::uuid else ('d2200000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid end,
       'Produto concorrencia ' || i,c.id,'Huambo','Huambo',true,true,100,'unidade','retalho'
from generate_series(1,9) i cross join lateral (select id from public.categorias where lower(btrim(nome))='alimentos' limit 1) c;
insert into public.destaques_produtos_editoriais(produto_id,vendedor_id,posicao,inicio_em,fim_em,criado_por)
select ('d2300000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
       ('d2200000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
       i,now(),now()+interval '7 days','d2000000-0000-4000-8000-000000000001'::uuid
from generate_series(1,7) i;
insert into public.eventos_destaques_produtos_editoriais(destaque_id,acao,ator_admin_id)
select id,'criado','d2000000-0000-4000-8000-000000000001'::uuid
from public.destaques_produtos_editoriais where produto_id::text like 'd2300000-0000-4000-8000-%';
"@
}

function Invoke-Race {
  param([string]$Name)
  $lockSql = Join-Path $tempRoot "$Name-lock.sql"
  $jobOneSql = Join-Path $tempRoot "$Name-admin-1.sql"
  $jobTwoSql = Join-Path $tempRoot "$Name-admin-2.sql"
  $lockLog = Join-Path $tempRoot "$Name-lock.log"
  $jobOneLog = Join-Path $tempRoot "$Name-admin-1.log"
  $jobTwoLog = Join-Path $tempRoot "$Name-admin-2.log"
  $lockError = Join-Path $tempRoot "$Name-lock.err"
  $jobOneError = Join-Path $tempRoot "$Name-admin-1.err"
  $jobTwoError = Join-Path $tempRoot "$Name-admin-2.err"
  Write-Utf8File $lockSql "select pg_advisory_lock(hashtextextended('destaques-produtos-editoriais', 0)); select pg_sleep(30);"
  Write-Utf8File $jobOneSql "set statement_timeout='15s'; select set_config('request.jwt.claim.sub','d2000000-0000-4000-8000-000000000001',false); select pg_backend_pid(), d.id, d.posicao from public.criar_destaque_produto_editorial_admin('d2300000-0000-4000-8000-000000000008'::uuid) d;"
  Write-Utf8File $jobTwoSql "set statement_timeout='15s'; select set_config('request.jwt.claim.sub','d2000000-0000-4000-8000-000000000002',false); select pg_backend_pid(), d.id, d.posicao from public.criar_destaque_produto_editorial_admin('d2300000-0000-4000-8000-000000000009'::uuid) d;"
  $lock = Start-Process -FilePath 'psql.exe' -ArgumentList @('-h',$HostName,'-p',$Port,'-U',$UserName,'-d',$Database,'-v','ON_ERROR_STOP=1','-f',$lockSql) -RedirectStandardOutput $lockLog -RedirectStandardError $lockError -PassThru -WindowStyle Hidden
  try {
    $lockHeld = $false
    for ($i=0; $i -lt 50; $i++) {
      $held = & psql.exe -h $HostName -p $Port -U $UserName -d $Database -Atc "select exists(select 1 from pg_locks where locktype='advisory' and granted);"
      if ($held -match 't') { $lockHeld = $true; break }
      Start-Sleep -Milliseconds 100
    }
    if (-not $lockHeld) { throw 'A barreira advisory local não ficou ativa.' }
    $lockBackendId = & psql.exe -h $HostName -p $Port -U $UserName -d $Database -Atc "select pid from pg_stat_activity where datname=current_database() and query like 'select pg_sleep(30)%' order by backend_start desc limit 1;"
    if ($lockBackendId -notmatch '^\d+$') { throw 'Não foi possível identificar a sessão coordenadora local.' }
    $jobOne = Start-Process -FilePath 'psql.exe' -ArgumentList @('-h',$HostName,'-p',$Port,'-U',$UserName,'-d',$Database,'-v','ON_ERROR_STOP=1','-f',$jobOneSql) -RedirectStandardOutput $jobOneLog -RedirectStandardError $jobOneError -PassThru -WindowStyle Hidden
    $jobTwo = Start-Process -FilePath 'psql.exe' -ArgumentList @('-h',$HostName,'-p',$Port,'-U',$UserName,'-d',$Database,'-v','ON_ERROR_STOP=1','-f',$jobTwoSql) -RedirectStandardOutput $jobTwoLog -RedirectStandardError $jobTwoError -PassThru -WindowStyle Hidden
    $waiters = $false
    for ($i=0; $i -lt 100; $i++) {
      $count = & psql.exe -h $HostName -p $Port -U $UserName -d $Database -Atc "select count(*) from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and wait_event='advisory' and query ilike '%criar_destaque_produto_editorial_admin%';"
      if ([int]$count -ge 2) { $waiters = $true; break }
      Start-Sleep -Milliseconds 100
    }
    if (-not $waiters) { throw 'As duas sessões não ficaram simultaneamente bloqueadas no advisory lock.' }
    $terminated = & psql.exe -h $HostName -p $Port -U $UserName -d $Database -Atc "select pg_terminate_backend($lockBackendId);"
    if ($terminated -notmatch 't') { throw 'Não foi possível terminar a sessão coordenadora local.' }
    $lock.WaitForExit()
    $jobOne.WaitForExit(); $jobTwo.WaitForExit()
    $jobOne.Refresh(); $jobTwo.Refresh()
    # Start-Process nem sempre expõe ExitCode depois de redirecionamento no
    # PowerShell 5.1; o stderr do psql é a fonte conclusiva do mesmo resultado.
    $jobOneSucceeded = -not (Test-Path $jobOneError) -or [string]::IsNullOrWhiteSpace((Get-Content -LiteralPath $jobOneError -Raw))
    $jobTwoSucceeded = -not (Test-Path $jobTwoError) -or [string]::IsNullOrWhiteSpace((Get-Content -LiteralPath $jobTwoError -Raw))
    $successes = @($jobOneSucceeded, $jobTwoSucceeded) | Where-Object { $_ }
    $successes = @($successes).Count
    if ($successes -ne 1) { throw "A corrida $Name não teve exatamente um vencedor." }
    return [pscustomobject]@{ Name=$Name; JobOneSucceeded=$jobOneSucceeded; JobTwoSucceeded=$jobTwoSucceeded; BarrierObserved=$true; Logs=@($jobOneLog,$jobTwoLog) }
  } finally {
    if ($lock -and -not $lock.HasExited) { Stop-Process -Id $lock.Id -Force -ErrorAction SilentlyContinue }
  }
}

function Clear-Fixtures {
  $cleanup = Join-Path $tempRoot 'cleanup.sql'
  Write-Utf8File $cleanup @"
delete from public.eventos_destaques_produtos_editoriais
where destaque_id in (select id from public.destaques_produtos_editoriais where produto_id::text like 'd2300000-0000-4000-8000-%');
delete from public.destaques_produtos_editoriais where produto_id::text like 'd2300000-0000-4000-8000-%';
delete from public.produtos where id::text like 'd2300000-0000-4000-8000-%';
delete from public.vendedores where id::text like 'd2200000-0000-4000-8000-%';
delete from public.administradores where user_id in ('d2000000-0000-4000-8000-000000000001'::uuid,'d2000000-0000-4000-8000-000000000002'::uuid);
delete from public.clientes where id::text like 'd2100000-0000-4000-8000-%';
delete from auth.users where id in ('d2000000-0000-4000-8000-000000000001'::uuid,'d2000000-0000-4000-8000-000000000002'::uuid) or id::text like 'd2100000-0000-4000-8000-%';
select (select count(*) from public.destaques_produtos_editoriais where produto_id::text like 'd2300000-0000-4000-8000-%') +
       (select count(*) from public.eventos_destaques_produtos_editoriais e join public.destaques_produtos_editoriais d on d.id=e.destaque_id where d.produto_id::text like 'd2300000-0000-4000-8000-%') +
       (select count(*) from public.produtos where id::text like 'd2300000-0000-4000-8000-%') +
       (select count(*) from public.vendedores where id::text like 'd2200000-0000-4000-8000-%') as fixtures_restantes;
"@
  $exit = Invoke-LocalPsql $cleanup -AllowFailure
  $script:cleanupExit = $exit
  if ($exit -ne 0) { throw "A limpeza local falhou ($exit)." }
}

try {
  $setupOne = Join-Path $tempRoot 'setup-last-position.sql'
  Write-Utf8File $setupOne (New-FixturesSql $false)
  Invoke-LocalPsql $setupOne | Out-Null
  $raceOne = Invoke-Race 'ultima-posicao'
  $checkOne = & psql.exe -h $HostName -p $Port -U $UserName -d $Database -Atc "select count(*) || '|' || count(distinct posicao) || '|' || count(*) filter (where posicao=8) from public.destaques_produtos_editoriais where produto_id in ('d2300000-0000-4000-8000-000000000008'::uuid,'d2300000-0000-4000-8000-000000000009'::uuid);"
  if ($checkOne.Trim() -ne '1|1|1') { throw "Última posição inconsistente: $checkOne" }
  $historyOne = & psql.exe -h $HostName -p $Port -U $UserName -d $Database -Atc "select count(*) from public.eventos_destaques_produtos_editoriais e join public.destaques_produtos_editoriais d on d.id=e.destaque_id where d.produto_id in ('d2300000-0000-4000-8000-000000000008'::uuid,'d2300000-0000-4000-8000-000000000009'::uuid) and e.acao='criado';"
  if ($historyOne.Trim() -ne '1') { throw "Histórico da última posição inconsistente: $historyOne" }
  $assertions += 3

  $setupTwo = Join-Path $tempRoot 'setup-same-vendor.sql'
  Clear-Fixtures
  Write-Utf8File $setupTwo (New-FixturesSql $true)
  Invoke-LocalPsql $setupTwo | Out-Null
  $raceTwo = Invoke-Race 'mesmo-vendedor'
  $checkTwo = & psql.exe -h $HostName -p $Port -U $UserName -d $Database -Atc "select count(*) || '|' || count(distinct vendedor_id) from public.destaques_produtos_editoriais where produto_id in ('d2300000-0000-4000-8000-000000000008'::uuid,'d2300000-0000-4000-8000-000000000009'::uuid);"
  if ($checkTwo.Trim() -ne '1|1') { throw "Unicidade do vendedor inconsistente: $checkTwo" }
  $historyTwo = & psql.exe -h $HostName -p $Port -U $UserName -d $Database -Atc "select count(*) from public.eventos_destaques_produtos_editoriais e join public.destaques_produtos_editoriais d on d.id=e.destaque_id where d.produto_id in ('d2300000-0000-4000-8000-000000000008'::uuid,'d2300000-0000-4000-8000-000000000009'::uuid) and e.acao='criado';"
  if ($historyTwo.Trim() -ne '1') { throw "Histórico do vendedor inconsistente: $historyTwo" }
  $assertions += 3
  "DESTAQUES_EDITORIAIS_CONCURRENCY_ASSERTIONS=$assertions"
  "DESTAQUES_EDITORIAIS_CONCURRENCY_PASS"
  $succeeded = $true
} finally {
  try { Clear-Fixtures } catch { Write-Error $_ }
  "CLEANUP_EXIT=$cleanupExit"
  if ($null -eq $previousPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $previousPassword }
  if ($succeeded) { Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
