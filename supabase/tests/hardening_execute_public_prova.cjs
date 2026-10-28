'use strict';
// Apenas Docker exec/psql local. Nunca aceita URL, password ou projeto remoto.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync,spawn}=require('node:child_process');
const repo=path.resolve(__dirname,'../..');
const docker='C:/Users/willi/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const container='supabase_db_angrolink-chat-precompra-local';
const baseline='angrolink_email_contacto_contract_20261021_v7';
const db='angrolink_parceiros_email_acl_versionada_20261028_a',role='angrolink_acl_probe_versionada_20261028';
const migration='supabase/migrations/20261028010000_hardening_execute_public_funcoes_comerciais.sql';
const rollbackOnly=process.argv.length===3&&process.argv[2]==='--rollback-only';
if(process.argv.length>2&&!rollbackOnly)throw Error('ONLY_LOCAL_ROLLBACK_OPTION_SUPPORTED');
const ownedClones=[];
const resultDir=fs.mkdtempSync(path.join(os.tmpdir(),'angrolink-acl-versionada-'));
const result={baseline,db,role,stages:[],assertions:[],cleanup:{},limitations:[]};
result.limitations.push('Primeiro destaque de servico falha antes do hardening com P0001 em proteger_campos_vendedor. Testar reproducao igual nao valida esse percurso funcional.');
let created=false,roleCreated=false,stage='preflight';
function command(args,input=''){
 const p=spawnSync(docker,args,{input,encoding:'utf8',windowsHide:true,timeout:45000,maxBuffer:8*1024*1024});
 if(p.error||p.status!==0){const e=Error('LOCAL_COMMAND_FAILED');e.exit=p.status;e.sqlstate=(p.stderr?.match(/ERROR:\s+([A-Z0-9]{5})/)||[])[1];e.constraint=(p.stderr?.match(/CONSTRAINT NAME:\s+(\w+)/)||[])[1];e.detail=p.stderr?.split(/\r?\n/).find(x=>/ERROR:/.test(x))?.replace(/(DETAIL:|CONTEXT:).*/,'');e.checkpoint=(p.stdout.match(/CHECKPOINT:[a-z_]+/g)||[]).at(-1);e.context=(p.stderr?.match(/PL\/pgSQL function [a-zA-Z0-9_()., ]+line [0-9]+/g)||[]);throw e;}
 return {out:p.stdout.trim(),err:p.stderr};
}
function sql(s,d=db){return command(['exec','-i',container,'psql','-U','postgres','-d',d,'-X','-At','-v','ON_ERROR_STOP=1','-v',`prova_db=${d}`], '\\set VERBOSITY verbose\n'+s);}
function file(p){return fs.readFileSync(path.join(repo,p),'utf8');}
function step(name,f){stage=name;const r=f();result.stages.push({name,exit:0});console.log(name+' EXIT=0');return r;}
function proof(name,p){const r=step(name,()=>sql(fs.readFileSync(path.join(__dirname,p),'utf8')));const pass=[...r.err.matchAll(/ASSERT PASS: (.*)/g)].map(x=>x[1]);result.assertions.push({name,pass});console.log('ASSERTIONS_PASS='+pass.length);}

function snapshot(d){
 return sql("select jsonb_agg(jsonb_build_array(p.oid,p.proacl::text) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';",d).out;
}
function clone(suffix){
 const c=db+'_'+suffix;
 if(sql("select count(*) from pg_database where datname='"+c+"';",'postgres').out!=='0')throw Error('CLONE_EXISTS');
 sql('create database '+c+' template '+db+';','postgres');ownedClones.push(c);return c;
}
async function faultTests(){
 const cases=[
 ['missing',"alter function public.expirar_destaques_antigos() rename to acl_fixture_missing;"],
 ['owner',"grant create on schema public to "+role+"; alter function public.expirar_destaques_antigos() owner to "+role+";"],
 ['acl',"revoke execute on function public.expirar_destaques_antigos() from authenticated;"],
 ['body',"create or replace function public.expirar_destaques_antigos() returns void language plpgsql security definer set search_path=public as $$ begin null; end $$;"],
 ['attributes',"alter function public.expirar_destaques_antigos() security invoker;"]
 ];
 result.faults=[];
 for(const [name,mutation] of cases){
  stage='fault_'+name;const c=clone(name);sql(mutation,c);const before=snapshot(c);
  let rejected=false,state;
  try{sql(file(migration),c);}catch(e){state=e.sqlstate;rejected=e.exit===3&&state==='55000';}
  if(!rejected||snapshot(c)!==before)throw Error('FAULT_GUARD_OR_ATOMICITY_'+name);
  result.faults.push({name,expectedSqlstate:state,exit:0,aclUnchanged:true});
  console.log('FAULT_'+name+' EXIT=0 SQLSTATE='+state);
 }
 stage='compatibility';const c=clone('compatible');
 sql('revoke execute on function public.expirar_destaques_antigos() from public; grant execute on function public.is_admin_atual() to '+role+';',c);
 const applied=sql(file(migration),c);
 if(!/revogadas=21, ja_protegidas=1/.test(applied.err))throw Error('COMPATIBILITY_COUNT');
 if(sql("select has_function_privilege('"+role+"','public.is_admin_atual()','EXECUTE');",c).out!=='t')throw Error('EXTRA_GRANT_LOST');
 const after=snapshot(c);const repeated=sql(file(migration),c);
 if(snapshot(c)!==after||!/revogadas=0, ja_protegidas=22/.test(repeated.err))throw Error('REAPPLICATION');
 result.compatibility={exit:0,protected:1,revoked:21,extraGrantPreserved:true,reapplicationUnchanged:true};
 await midSequenceRollback();
}


function session(d,app){
 const p=spawn(docker,['exec','-i',container,'psql','-U','postgres','-d',d,'-X','-At','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe'],windowsHide:true,timeout:35000});
 const s={p,out:'',err:'',closed:false};
 s.done=new Promise(resolve=>{
  p.stdout.on('data',b=>s.out+=b.toString('utf8'));
  p.stderr.on('data',b=>s.err+=b.toString('utf8'));
  p.on('error',()=>{s.error=true;});
  p.on('close',code=>{s.code=code;s.closed=true;resolve(s);});
 });
 p.stdin.on('error',()=>{s.inputError=true;});
 p.stdin.write("\\set VERBOSITY verbose\nset application_name='"+app+"';\n");
 return s;
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function midSequenceRollback(){
 stage='mid_sequence_rollback';const locked=clone('sequence');
 const source=file(migration);
 const hash=require('node:crypto').createHash('sha256').update(source).digest('hex').toUpperCase();
 if(hash!=='0E539BFE13C9B1FD41BACDE0BF7E1ECF6C647E612B88D3DAE38C08ECC717459B')throw Error('MIGRATION_HASH_CHANGED');
 const contracts=JSON.parse(source.match(/\$contratos\$([\s\S]*?)\$contratos\$/)[1]);
 const last='public.validar_veiculo_do_documento_parceiro()';
 if(contracts.length!==22||new Set(contracts.map(c=>c.signature)).size!==22||contracts[21].signature!==last)throw Error('SEQUENCE_CHANGED');
 // Immutable linear loop: all states captured first; each exposed target gets
 // one REVOKE in array order, without per-REVOKE exception handlers.
 if(!source.includes("for estado in select value from jsonb_array_elements(estados) loop")||
    !source.includes("execute format('revoke execute on function %s from public',assinatura);")||
    /\bexception\s+when\b/i.test(source))throw Error('SEQUENTIAL_EXECUTION_CONTRACT_CHANGED');
 const initial=JSON.parse(sql(`select jsonb_agg(jsonb_build_object('signature',l.signature,'public',
 exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE')) order by l.signature)
 from acl_probe.allowed l join pg_proc p on p.oid=to_regprocedure(l.signature);`,locked).out);
 if(initial.length!==22||initial.some(c=>!c.public))throw Error('ALL_22_MUST_START_EXPOSED');
 const before=snapshot(locked),tag='acl_rb_'+process.pid+'_'+Date.now();
 const lockerApp=tag+'_locker',migratorApp=tag+'_migration';
 let locker,migrator,observed;
 try{
  locker=session(locked,lockerApp);
  locker.p.stdin.write("set idle_in_transaction_session_timeout='25s'; begin; alter function "+last+" cost 100;\nselect 'LOCK_READY';\n");
  const deadline=Date.now()+18000;
  let blocker;
  while(Date.now()<deadline){
   await delay(100);
   const rows=JSON.parse(sql("select coalesce(jsonb_agg(jsonb_build_object('pid',pid,'xid',backend_xid::text)),'[]') from pg_stat_activity where datname=current_database() and application_name='"+lockerApp+"' and state='idle in transaction' and backend_xid is not null;",locked).out);
   if(rows.length===1&&locker.out.includes('LOCK_READY')){blocker=rows[0];break;}
   if(locker.closed)throw Error('LOCKER_EXITED_BEFORE_READY');
  }
  if(!blocker)throw Error('LOCKER_NOT_IDENTIFIED');
  migrator=session(locked,migratorApp);
  migrator.p.stdin.end("set statement_timeout='10s';\n"+source);
  while(Date.now()<deadline&&!migrator.closed){
   await delay(100);
   const rows=JSON.parse(sql(`select coalesce(jsonb_agg(jsonb_build_object(
    'migratorPid',m.pid,'migratorXid',m.backend_xid::text,'blockerPid',b.pid,
    'blockerXid',b.backend_xid::text,'waitType',m.wait_event_type,'waitEvent',m.wait_event,
    'waitLock',w.locktype,'waitMode',w.mode,'heldMode',h.mode,
    'lastTupleLock',exists(select 1 from pg_locks t join pg_proc p on p.oid=to_regprocedure('${last}')
      where t.pid=m.pid and t.locktype='tuple' and t.relation='pg_proc'::regclass
      and t.page=split_part(trim(both '()' from p.ctid::text),',',1)::integer
      and t.tuple=split_part(trim(both '()' from p.ctid::text),',',2)::integer),
    'migrationDoObserved',position('do $hardening$' in m.query)>0)),'[]')
    from pg_stat_activity m join pg_stat_activity b on b.pid=${blocker.pid}
    join pg_locks w on w.pid=m.pid and not w.granted and w.locktype='transactionid'
    join pg_locks h on h.pid=b.pid and h.granted and h.locktype='transactionid' and h.transactionid=w.transactionid
    where m.datname=current_database() and b.datname=current_database()
    and m.application_name='${migratorApp}' and b.application_name='${lockerApp}'
    and m.wait_event_type='Lock' and b.pid=any(pg_blocking_pids(m.pid))
    and w.transactionid::text='${blocker.xid}' and m.backend_xid is not null;`,locked).out);
   if(rows.length===1){observed=rows[0];break;}
  }
  if(!observed||!observed.lastTupleLock||!observed.migrationDoObserved)throw Error('EXPECTED_LAST_OBJECT_LOCK_NOT_OBSERVED');
  await migrator.done;
  const state=(migrator.err.match(/ERROR:\s+([A-Z0-9]{5})/)||[])[1];
  const expectedStatement='SQL statement "revoke execute on function '+last+' from public"';
  if(migrator.error||migrator.code!==3||state!=='57014'||
     !migrator.err.includes('canceling statement due to statement timeout')||
     !migrator.err.includes(expectedStatement)||
     !/PL\/pgSQL function inline_code_block line \d+ at EXECUTE/.test(migrator.err)||
     migrator.out.includes('COMMIT'))throw Error('TIMEOUT_NOT_PROVEN_AT_LAST_REVOKE');
  // Exact server error context + verified immutable linear loop + all initial
  // PUBLIC grants => 21 earlier REVOKEs completed in THIS transaction.
  // This is a control-flow proof, not an external read of uncommitted ACLs.
  locker.p.stdin.end('rollback;\n');await locker.done;
  if(locker.error||locker.code!==0||!locker.out.includes('ROLLBACK'))throw Error('LOCKER_ROLLBACK_FAILED');
  if(snapshot(locked)!==before)throw Error('ACL_OR_EXPLICIT_GRANTS_PERSISTED');
  if(sql(`select count(*) from pg_stat_activity where datname=current_database()
   and (pid in (${blocker.pid},${observed.migratorPid}) or application_name in ('${lockerApp}','${migratorApp}'));`,locked).out!=='0')throw Error('OWN_SESSION_REMAINS');
  if(sql(`select count(*) from pg_locks where pid in (${blocker.pid},${observed.migratorPid});`,locked).out!=='0')throw Error('OWN_LOCK_REMAINS');
  result.midSequence={exit:0,sqlstate:state,migratorExit:migrator.code,lockerExit:locker.code,
   ...observed,migrationSha256:hash,interruptedStatement:expectedStatement,earlierRevokes:21,
   earlierEvidence:'immutable sequential loop reached last EXECUTE, all 22 initially PUBLIC, backend_xid assigned',
   aclUnchanged:true,explicitGrantsUnchanged:true,remainingSessions:0,remainingLocks:0};
  console.log('MID_SEQUENCE_ROLLBACK='+JSON.stringify(result.midSequence));
 }finally{
  // Only own streams/sessions. Bounded PostgreSQL timeouts; no terminate_backend.
  if(locker&&!locker.closed){locker.p.stdin.end('rollback;\n');await locker.done;}
  if(migrator&&!migrator.closed)await migrator.done;
 }
}

(async()=>{try{
 if(sql(`select count(*) from pg_database where datname='${db}';`,'postgres').out!=='0')throw Error('DB_EXISTS');
 if(sql(`select count(*) from pg_roles where rolname='${role}';`,'postgres').out!=='0')throw Error('ROLE_EXISTS');
 if(sql('select count(*) from auth.users;',baseline).out!=='0')throw Error('BASELINE_NOT_EMPTY');
 result.oldInventory=sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE');",baseline).out;
 result.migrationsReviewed=fs.readdirSync(path.join(repo,'supabase/migrations')).filter(n=>n.endsWith('.sql')&&/security\s+(definer|invoker)|grant\s+execute|revoke.*function|alter.*owner|create\s+role|grant.*\sto\s/i.test(file('supabase/migrations/'+n)));
 step('create_copy',()=>sql(`create database ${db} template ${baseline};`,'postgres'));created=true;
 const migrations=[
 '20260901020000_corrigir_policies_catalogo_publico.sql',
 '20260901030000_corrigir_policies_operacionais_catalogo.sql',
 '20260901040000_aprovar_parceiro_entrega_atomicamente.sql',
 '20260904030000_corrigir_ownership_documentos_vendedor.sql',
 '20260909040000_aplicar_gates_operacionais_catalogo_huambo.sql',
 '20260909050000_proteger_metricas_comerciais_produtos.sql',
 '20260910010000_proteger_candidatura_vendedor_huambo_documentos.sql',
 '20260928010000_reabrir_analise_parceiro_documentos.sql',
 '20261001010000_alertar_admin_operacoes_entrega.sql'];
 for(const m of migrations)step(m,()=>sql(file('supabase/migrations/'+m)));
 step('fixtures_historicas',()=>sql(file('supabase/tests/parceiros_email_obrigatorio_preparacao.sql')));
 for(const m of ['20261026010000_email_obrigatorio_novos_parceiros.sql','20261027010000_contratos_privados_verificacao_email_parceiros.sql'])step(m,()=>sql(file('supabase/migrations/'+m)));
 step('create_experimental_role',()=>sql(`create role ${role} nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit noreplication;`));roleCreated=true;
 step('controller_set_role',()=>sql(`grant ${role} to postgres with inherit false, set true;`));
 step('harness',()=>sql(fs.readFileSync(path.join(__dirname,'hardening_execute_public_contexto.sql'),'utf8')));
 result.before=JSON.parse(sql('select acl_probe.inventory();').out);
 if(rollbackOnly){await midSequenceRollback();}
 else{
 proof('regression_before','hardening_execute_public_regressao.sql');
 proof('capabilities_before','hardening_execute_public_antes.sql');
 await faultTests();
 step('migration_versionada',()=>sql(file(migration)));
 result.after=JSON.parse(sql('select acl_probe.inventory();').out);
 result.aclChanges=result.before.filter(b=>result.after.find(a=>a.signature===b.signature)?.aclEffective!==b.aclEffective)
  .map(b=>({signature:b.signature,before:b.aclEffective,after:result.after.find(a=>a.signature===b.signature).aclEffective}));
 proof('capabilities_after','hardening_execute_public_depois.sql');
 proof('regression_after','hardening_execute_public_regressao.sql');
 proof('integrity_after','hardening_execute_public_integridade.sql');
 }
 result.pass=true;
}catch(e){result.pass=false;result.failure={stage,exit:e.exit,sqlstate:e.sqlstate,constraint:e.constraint,kind:e.message,detail:e.detail,checkpoint:e.checkpoint,context:e.context};console.log('PROOF_FAILED_STAGE='+stage);console.log('FAIL_SQLSTATE='+(e.sqlstate||'unknown'));console.log('FAIL_DETAIL='+(e.detail||e.message));console.log('FAIL_CHECKPOINT='+e.checkpoint);console.log('FAIL_CONTEXT='+JSON.stringify(e.context));}
finally{
 for(const c of ownedClones.reverse()){try{sql('drop database '+c+';','postgres');result.cleanup[c]=0;}catch(e){result.cleanup[c]=e.exit??1;}}
 if(created){try{sql(`drop database ${db};`,'postgres');result.cleanup.databaseExit=0;created=false;}catch(e){result.cleanup.databaseExit=e.exit??1;}}
 if(roleCreated&&!created){try{sql(`drop role ${role};`,'postgres');result.cleanup.roleExit=0;roleCreated=false;}catch(e){result.cleanup.roleExit=e.exit??1;}}
 try{result.cleanup.remaining=sql(`select (select count(*) from pg_database where datname='${db}')+(select count(*) from pg_roles where rolname='${role}');`,'postgres').out;}catch{}
 fs.writeFileSync(path.join(resultDir,'resultado-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json'),JSON.stringify(result,null,2));
 console.log('RESULT_DIRECTORY='+resultDir);
 console.log('CLEANUP='+JSON.stringify(result.cleanup));
 console.log('PROOF_EXIT='+(result.pass&&result.cleanup.remaining==='0'&&Object.values(result.cleanup).every(x=>x===0||x==='0')?0:1));
 process.exitCode=result.pass&&result.cleanup.remaining==='0'&&Object.values(result.cleanup).every(x=>x===0||x==='0')?0:1;
}})().catch(e=>{console.error('CONTROLLER_FAILED='+e.message);process.exitCode=1;});
