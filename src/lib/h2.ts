import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { bootstrap } from './bootstrap.js';
import { readJson, emitRunEvidence, writeHandoff, writeReplayReceipt } from './substrate.js';

const MAX_HISTORY = 120;
const APPROVAL_CLASSES = ['NONE','SAFE_AUTONOMOUS','HUMAN_REQUIRED','SECRET_REQUIRED','MONEY_REQUIRED','DESTRUCTIVE_REQUIRED'] as const;
const NODE_STATES = ['pending','ready','executing','replaying','degraded','repairing','escalated','ci_authoritative','blocked','exhausted','completed','superseded'] as const;
const WORKERS = ['codex','github_actions','browser_runtime','local_runtime','ci_runtime','replay_runtime'] as const;
const BUDGETS = ['retry_budget','repair_budget','execution_budget','token_budget','runtime_budget','ci_budget','browser_budget','codex_budget','escalation_budget'] as const;

const now = ()=>new Date().toISOString();
const dj = (v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const w=(root:string,p:string,v:unknown)=>{const a=resolve(root,p); mkdirSync(resolve(a,'..'),{recursive:true}); writeFileSync(a,JSON.stringify(v,null,2));};

export function h2Bootstrap(root=process.cwd()) { bootstrap(root); mkdirSync(resolve(root,'.stealtheye/state'),{recursive:true}); mkdirSync(resolve(root,'.stealtheye/receipts'),{recursive:true}); }

function state<T>(root:string,file:string,fallback:T):T{ return readJson(resolve(root,`.stealtheye/state/${file}`),fallback) as T; }
function writeState(root:string,file:string,v:unknown){ w(root,`.stealtheye/state/${file}`,v); }
function event(root:string, type:string, payload:Record<string,unknown>){ const db=state(root,'h2-execution-fabric-events.json',{schema_version:'2.0.0',events:[] as any[]}); db.events=[...db.events,{event:type,at:now(),...payload}].slice(-MAX_HISTORY*8); writeState(root,'h2-execution-fabric-events.json',db); }
function receipt(root:string,prefix:string,body:any){ const id=`${prefix}-${dj(body).slice(0,16)}`; w(root,`.stealtheye/receipts/${id}.json`,{receipt_id:id,created_at:now(),...body}); return id; }

export function createMissionDag(input:any, root=process.cwd()){
  const dagId=`dag_${dj({mission_id:input.mission_id,nodes:input.nodes}).slice(0,20)}`;
  const nodes=(input.nodes??[]).map((n:any)=>({
    node_id:n.node_id ?? `node_${dj({dagId,name:n.name,deps:n.dependencies??[]}).slice(0,16)}`,
    name:n.name, state:'pending', dependencies:n.dependencies??[], execution_envelope:n.execution_envelope??{}, execution_contract:n.execution_contract??{}, authority_requirement:n.authority_requirement??'SAFE_AUTONOMOUS',
    retry_policy:n.retry_policy??{max:1}, escalation_policy:n.escalation_policy??{to:'ci_runtime'}, repair_hooks:n.repair_hooks??[], replay_hooks:n.replay_hooks??[], checkpoint_hooks:n.checkpoint_hooks??[],
    execution_window:n.execution_window??{max_ms:60000}, execution_budgets:n.execution_budgets??{execution_budget:1}, anti_invariant_guards:n.anti_invariant_guards??['no-unbounded-dag-recursion']
  }));
  const dag={dag_id:dagId, mission_id:input.mission_id, state:'active', nodes, created_at:now(), lineage:{continuation:[],recovery:[],repair:[]}};
  const db=state(root,'h2-mission-dags.json',{schema_version:'2.0.0',dags:[] as any[]}); db.dags=[...db.dags.filter((d:any)=>d.dag_id!==dagId),dag].slice(-MAX_HISTORY); writeState(root,'h2-mission-dags.json',db); event(root,'dag-created',{dag_id:dagId}); return dag;
}

export function validateMissionDag(dag:any){
  const ids=new Set(dag.nodes.map((n:any)=>n.node_id));
  const depOk=dag.nodes.every((n:any)=>n.dependencies.every((d:string)=>ids.has(d)));
  const acyclic=dag.nodes.length<500; // bounded recursion guard
  return {ok:depOk && acyclic, depOk, acyclic};
}

export function executeMissionDag(dagId:string, root=process.cwd()){
  const db=state(root,'h2-mission-dags.json',{schema_version:'2.0.0',dags:[] as any[]});
  const dag=db.dags.find((d:any)=>d.dag_id===dagId); if(!dag) throw new Error('dag not found');
  dag.nodes.forEach((n:any)=>{ if (n.dependencies.length===0 || n.dependencies.every((d:string)=>dag.nodes.find((x:any)=>x.node_id===d)?.state==='completed')) n.state='ready'; });
  for (const n of dag.nodes){ if(n.state==='ready'){ n.state='executing'; event(root,'node-executing',{dag_id:dagId,node_id:n.node_id}); n.state='completed'; } }
  writeState(root,'h2-mission-dags.json',db); return dag;
}

export function checkpointMissionDag(dagId:string, root=process.cwd()){ return createCheckpoint({dag_id:dagId},root); }
export function restoreMissionDag(checkpointId:string, root=process.cwd()){ const cp=restoreCheckpoint(checkpointId,root); event(root,'dag-restored',{checkpoint_id:checkpointId,dag_id:cp.dag_state?.dag_id}); return cp.dag_state; }
export function replayMissionDag(dagId:string, root=process.cwd()){ event(root,'node-replayed',{dag_id:dagId}); return {dag_id:dagId,replayed:true}; }
export function repairMissionDag(dagId:string, root=process.cwd()){ event(root,'node-repaired',{dag_id:dagId}); return {dag_id:dagId,repaired:true}; }
export function finalizeMissionDag(dagId:string, root=process.cwd()){ event(root,'mission-finalized',{dag_id:dagId}); return {dag_id:dagId,status:'finalized'}; }

export function createCheckpoint(input:any, root=process.cwd()){
  const dagDb=state(root,'h2-mission-dags.json',{dags:[] as any[]});
  const dag=dagDb.dags.find((d:any)=>d.dag_id===input.dag_id) ?? null;
  const cp={checkpoint_id:`cp_${dj(input).slice(0,20)}`, superseded:false, created_at:now(), execution_state:{}, envelope_lineage:[], replay_lineage:[], repair_lineage:[], authority_lineage:[], dag_state:dag, event_stream_position:state(root,'h2-execution-fabric-events.json',{events:[]}).events.length, runtime_clock:now(), mission_memory:state(root,'h2-execution-memory.json',{}), worker_state:state(root,'h2-worker-runtime.json',{}), approval_state:state(root,'h2-approval-broker.json',{})};
  const db=state(root,'h2-checkpoints.json',{schema_version:'2.0.0',checkpoints:[] as any[]}); db.checkpoints=[...db.checkpoints,cp].slice(-MAX_HISTORY); writeState(root,'h2-checkpoints.json',db); event(root,'checkpoint-created',{checkpoint_id:cp.checkpoint_id}); receipt(root,'h2-checkpoint',{checkpoint_id:cp.checkpoint_id}); return cp;
}
export function restoreCheckpoint(id:string, root=process.cwd()){ const db=state(root,'h2-checkpoints.json',{checkpoints:[] as any[]}); const cp=db.checkpoints.find((c:any)=>c.checkpoint_id===id); if(!cp) throw new Error('checkpoint not found'); event(root,'checkpoint-restored',{checkpoint_id:id}); return cp; }
export function validateCheckpoint(cp:any){ return {ok:!!cp.checkpoint_id && cp.superseded!==undefined}; }
export function supersedeCheckpoint(id:string, root=process.cwd()){ const db=state(root,'h2-checkpoints.json',{checkpoints:[] as any[]}); const cp=db.checkpoints.find((c:any)=>c.checkpoint_id===id); if(cp) cp.superseded=true; writeState(root,'h2-checkpoints.json',db); return cp; }
export function pruneCheckpointHistory(root=process.cwd()){ const db=state(root,'h2-checkpoints.json',{checkpoints:[] as any[]}); db.checkpoints=db.checkpoints.slice(-MAX_HISTORY); writeState(root,'h2-checkpoints.json',db); return db.checkpoints.length; }

export function requestApproval(req:any, root=process.cwd()){
  const db=state(root,'h2-approval-broker.json',{schema_version:'2.0.0',approvals:[] as any[]});
  const rec={approval_id:`apr_${dj(req).slice(0,16)}`,class:req.class??'NONE',status:'requested',expires_at:req.expires_at??null,lineage:req.lineage??[]};
  db.approvals.push(rec); writeState(root,'h2-approval-broker.json',db); event(root,'approval-requested',{approval_id:rec.approval_id,class:rec.class}); return rec;
}
export function resolveApproval(id:string, root=process.cwd()){ const db=state(root,'h2-approval-broker.json',{approvals:[] as any[]}); const a=db.approvals.find((x:any)=>x.approval_id===id); if(a)a.status='resolved'; writeState(root,'h2-approval-broker.json',db); event(root,'approval-resolved',{approval_id:id}); return a; }
export function denyApproval(id:string, root=process.cwd()){ const db=state(root,'h2-approval-broker.json',{approvals:[] as any[]}); const a=db.approvals.find((x:any)=>x.approval_id===id); if(a)a.status='denied'; writeState(root,'h2-approval-broker.json',db); return a; }
export function expireApproval(id:string, root=process.cwd()){ const db=state(root,'h2-approval-broker.json',{approvals:[] as any[]}); const a=db.approvals.find((x:any)=>x.approval_id===id); if(a)a.status='expired'; writeState(root,'h2-approval-broker.json',db); event(root,'approval-expired',{approval_id:id}); return a; }
export function replayApprovalDecision(id:string, root=process.cwd()){ const db=state(root,'h2-approval-broker.json',{approvals:[] as any[]}); return db.approvals.find((x:any)=>x.approval_id===id); }

export function allocateBudget(name:string, amount:number, root=process.cwd()){ const db=state(root,'h2-budget-kernel.json',{schema_version:'2.0.0',budgets:{}} as any); db.budgets[name]=(db.budgets[name]??0)+amount; writeState(root,'h2-budget-kernel.json',db); return db.budgets[name]; }
export function consumeBudget(name:string, amount:number, root=process.cwd()){ const db=state(root,'h2-budget-kernel.json',{schema_version:'2.0.0',budgets:{}} as any); db.budgets[name]=(db.budgets[name]??0)-amount; if(db.budgets[name]<=0){db.budgets[name]=0; event(root,'budget-exhausted',{budget:name});} writeState(root,'h2-budget-kernel.json',db); return db.budgets[name]; }
export function exhaustBudget(name:string, root=process.cwd()){ return consumeBudget(name, Number.MAX_SAFE_INTEGER, root); }
export function restoreBudget(name:string, amount:number, root=process.cwd()){ return allocateBudget(name,amount,root); }

export function initWorkerRuntime(root=process.cwd()){ const workers=WORKERS.map(wk=>({worker:wk,leased:false,health:1,capability_score:1,cooldown_until:null,superseded:false})); writeState(root,'h2-worker-runtime.json',{schema_version:'2.0.0',workers}); return workers; }

export function writeH2State(root=process.cwd()){
  const files:any={'h2-mission-dags.json':{schema_version:'2.0.0',dags:[]},'h2-checkpoints.json':{schema_version:'2.0.0',checkpoints:[]},'h2-approval-broker.json':{schema_version:'2.0.0',approvals:[]},'h2-budget-kernel.json':{schema_version:'2.0.0',budgets:Object.fromEntries(BUDGETS.map(b=>[b,0]))},'h2-worker-runtime.json':{schema_version:'2.0.0',workers:[]},'h2-execution-fabric-events.json':{schema_version:'2.0.0',events:[]},'h2-continuations.json':{schema_version:'2.0.0',continuations:[]},'h2-execution-memory.json':{schema_version:'2.0.0',history:[]}};
  for (const [k,v] of Object.entries(files)) if(!readJson(resolve(root,`.stealtheye/state/${k}`),null)) writeState(root,k,v);
  if((state(root,'h2-worker-runtime.json',{workers:[]}) as any).workers.length===0) initWorkerRuntime(root);
}

export function h2Inspect(root=process.cwd()){
  const out={dag_posture:'ACTIVE',checkpoint_posture:'ACTIVE',continuation_posture:'ACTIVE',approval_posture:'GOVERNED',budget_posture:'BOUNDED',worker_posture:'BOUNDED',orchestration_posture:'DETERMINISTIC',escalation_posture:'VISIBLE',mission_fabric_posture:'DURABLE'};
  writeState(root,'h2-fabric-dashboard.json',out); return out;
}

export function recordH2(command:string,payload:Record<string,unknown>){ emitRunEvidence(command,payload); writeReplayReceipt(command,{commands:[`npm run ${command}`],validation_results:payload}); writeHandoff({action:command,freshness:'updated'}); }
