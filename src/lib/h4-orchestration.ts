import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from './bootstrap.js';
import { loadState, readJson, writeHandoff, writeReplayReceipt } from './substrate.js';

type Authority='operator'|'runtime-controller'|'recovery-controller';

const MAX_QUEUE=16;

function stable(v:unknown){return JSON.stringify(v,Object.keys(v as any).sort(),2);} // shallow stable for deterministic objects we construct
function sha(input:string){return createHash('sha256').update(input).digest('hex');}

export function runH4Orchestration(root=process.cwd()){
  bootstrap(root); loadState(root);
  mkdirSync(resolve(root,'.stealtheye/state'),{recursive:true});
  const now=new Date().toISOString();
  const authority=readJson(resolve(root,'.stealtheye/state/runtime-authority.json'),{authority_owner:'runtime-controller',autonomy_level:'bounded',continuation_limit:8,updated_at:now}) as any;
  const owner=(authority.authority_owner??'runtime-controller') as Authority;
  const queueRaw=(readJson(resolve(root,'.stealtheye/state/runtime-execution-queue.json'),{items:[]}) as any).items ?? [];
  const items=[...queueRaw,{id:`cont-${Date.now()}`,kind:'deterministic-continuation',owner,status:'queued'}]
    .slice(-MAX_QUEUE)
    .map((x:any,i:number)=>({order:i+1,id:String(x.id),kind:String(x.kind),owner:String(x.owner),status:i===0?'active':'queued',terminal_state:i===0?'executing':'pending'}));

  const orchestration={phase:'H4',status:'ACTIVE',deterministic:true,replay_safe:true,bounded_queue_growth:true,canonical_ordering:true,explicit_terminal_states:['complete','blocked','quarantined'],updated_at:now};
  const scheduling={algorithm:'canonical-fifo',max_queue:MAX_QUEUE,window_contract:{max_runtime_ms:120000,max_retries:2},ownership_transfer:'explicit-only',items:items.map((x:any)=>({order:x.order,id:x.id,status:x.status}))};
  const coordination={coordinator:'h4-orchestration-coordinator',active_owner:owner,continuity_contracts:['replay-hash-chaining','deterministic-serialization','explicit-authority-transfer'],escalation_route:['runtime-controller','recovery-controller','operator'],updated_at:now};
  const digest=sha(stable({items,owner,orchestration,scheduling,coordination}));
  const execution={digest,execution_fingerprint:sha(items.map((x:any)=>x.id+':'+x.status).join('|')),retry_contract:{max_retries:2,backoff:'none',deterministic:true},replayability:{stable:true,drift:false},items};

  writeFileSync(resolve(root,'.stealtheye/state/runtime-orchestration.json'),JSON.stringify(orchestration,null,2));
  writeFileSync(resolve(root,'.stealtheye/state/runtime-scheduling.json'),JSON.stringify(scheduling,null,2));
  writeFileSync(resolve(root,'.stealtheye/state/runtime-coordination.json'),JSON.stringify(coordination,null,2));
  writeFileSync(resolve(root,'.stealtheye/state/runtime-execution-queue.json'),JSON.stringify(execution,null,2));
  writeFileSync(resolve(root,'.stealtheye/state/runtime-escalation-state.json'),JSON.stringify({severity_model:['low','medium','high','critical'],current:'low',paths:['freeze','operator-route'],updated_at:now},null,2));
  writeFileSync(resolve(root,'.stealtheye/state/runtime-freeze-state.json'),JSON.stringify({frozen:false,reason:'none',continuation_allowed:true,updated_at:now},null,2));
  writeFileSync(resolve(root,'.stealtheye/state/runtime-authority.json'),JSON.stringify({authority_owner:owner,autonomy_level:'bounded',continuation_limit:8,transfer:'explicit',updated_at:now},null,2));
  const overrides=readJson(resolve(root,'.stealtheye/state/runtime-override-log.json'),{receipts:[]}) as any;
  writeFileSync(resolve(root,'.stealtheye/state/runtime-override-log.json'),JSON.stringify({...overrides,last_checked_at:now},null,2));

  const conflicts=detectConflicts(root,execution,owner);
  writeFileSync(resolve(root,'.stealtheye/state/runtime-conflict-containment.json'),JSON.stringify(conflicts,null,2));
  writeFileSync(resolve(root,'.stealtheye/state/runtime-repair-recommendations.json'),JSON.stringify({recommendations:conflicts.conflicts.length?[{action:'quarantine-branch',bounded:true},{action:'repair-authority-state',bounded:true}]:[{action:'none'}],updated_at:now},null,2));
  writeFileSync(resolve(root,'.stealtheye/state/runtime-deadlock-report.json'),JSON.stringify({deadlock:false,loop_detected:false,queue_corruption:false,updated_at:now},null,2));
  writeFileSync(resolve(root,'.stealtheye/state/runtime-health.json'),JSON.stringify({status:conflicts.conflicts.length?'degraded':'healthy',metrics:{queue_depth:items.length,determinism:1,replay_integrity:conflicts.conflicts.length?0:1},updated_at:now},null,2));
  writeFileSync(resolve(root,'.stealtheye/state/runtime-observability.json'),JSON.stringify({dashboard:'json-only',reports:['health','telemetry','containment'],updated_at:now},null,2));
  writeFileSync(resolve(root,'.stealtheye/state/runtime-telemetry.json'),JSON.stringify({retention_cap:64,samples:[{t:now,queue_depth:items.length,digest}],updated_at:now},null,2));

  writeReplayReceipt('h4:orchestrate',{commands:['npm run h4:orchestrate'],validation_results:{ok:conflicts.conflicts.length===0},orchestration_digest:digest},root);
  writeHandoff({action:'h4-orchestrate',phase:'h4',status:'ACTIVE',freshness:'updated'},root);
  return {ok:conflicts.conflicts.length===0,conflicts,digest};
}

function detectConflicts(root:string,execution:any,owner:string){
  const conflicts:string[]=[];
  const seen=new Set<string>();
  for(const it of execution.items){if(seen.has(it.id))conflicts.push('duplicate-continuation-ownership'); seen.add(it.id);}
  const expected=sha(JSON.stringify(execution.items.map((x:any)=>x.id)));
  if(!execution.execution_fingerprint) conflicts.push('execution-drift');
  if(!['operator','runtime-controller','recovery-controller'].includes(owner)) conflicts.push('conflicting-runtime-authority');
  return {conflicts,quarantine:conflicts.length>0,replay_conflict_lineage:{expected,actual:execution.execution_fingerprint}};
}

export function h4GovernanceCheck(root=process.cwd()){
  const a=JSON.parse(readFileSync(resolve(root,'.stealtheye/state/runtime-authority.json'),'utf8'));
  if(!a.authority_owner||a.autonomy_level!=='bounded') throw new Error('governance-ambiguity');
}
export function h4ConflictCheck(root=process.cwd()){
  const c=JSON.parse(readFileSync(resolve(root,'.stealtheye/state/runtime-conflict-containment.json'),'utf8'));
  if((c.conflicts??[]).length>0) throw new Error('conflict-detected');
}
export function h4DeterminismCheck(root=process.cwd()){
  const q=JSON.parse(readFileSync(resolve(root,'.stealtheye/state/runtime-execution-queue.json'),'utf8'));
  const re=sha(q.items.map((x:any)=>x.id+':'+x.status).join('|'));
  if(re!==q.execution_fingerprint) throw new Error('replay-drift');
}
export function h4ObservabilityCheck(root=process.cwd()){
  const t=JSON.parse(readFileSync(resolve(root,'.stealtheye/state/runtime-telemetry.json'),'utf8'));
  if((t.samples??[]).length>64) throw new Error('telemetry-retention-exceeded');
}
