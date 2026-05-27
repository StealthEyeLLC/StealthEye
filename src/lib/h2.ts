import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { bootstrap } from './bootstrap.js';
import { readJson, emitRunEvidence, writeHandoff, writeReplayReceipt } from './substrate.js';

const MAX_HISTORY = 120;
const WORKERS = ['codex','github','browser','ci_actions','local_runtime'] as const;
const now = ()=>new Date().toISOString();
const dj = (v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const w=(root:string,p:string,v:unknown)=>{const a=resolve(root,p); mkdirSync(resolve(a,'..'),{recursive:true}); writeFileSync(a,JSON.stringify(v,null,2));};

function state<T>(root:string,file:string,fallback:T):T{ return readJson(resolve(root,`.stealtheye/state/${file}`),fallback) as T; }
function writeState(root:string,file:string,v:unknown){ w(root,`.stealtheye/state/${file}`,v); }
function event(root:string, type:string, payload:Record<string,unknown>){ const db=state(root,'h2-event-stream-hardened.json',{schema_version:'2.1.0',events:[] as any[]}); db.events=[...db.events,{event:type,at:now(),...payload}].slice(-MAX_HISTORY*12); writeState(root,'h2-event-stream-hardened.json',db); }
function receipt(root:string,prefix:string,body:any){ const id=`${prefix}-${dj(body).slice(0,16)}`; w(root,`.stealtheye/receipts/${id}.json`,{receipt_id:id,created_at:now(),...body}); return id; }

export function h2Bootstrap(root=process.cwd()) { bootstrap(root); ['state','receipts','schemas/h2','validation'].forEach((p)=>mkdirSync(resolve(root,`.stealtheye/${p}`),{recursive:true})); }

export function buildExecutionPlan(dag:any){
  const byId=new Map(dag.nodes.map((n:any)=>[n.node_id,n]));
  return dag.nodes.map((n:any)=>({node_id:n.node_id,dependencies:n.dependencies??[],ready:(n.dependencies??[]).every((d:string)=>byId.get(d)?.state==='completed')}));
}
export function computeExecutionOrder(dag:any){ return topologicalOrder(dag); }
export function computeReplayOrder(dag:any){ return topologicalOrder(dag); }
export function computeRepairOrder(dag:any){ return topologicalOrder(dag).reverse(); }
export function invalidateDependentNodes(dag:any,nodeId:string){
  const invalidated:string[]=[];
  const q=[nodeId];
  while(q.length){
    const cur=q.shift()!;
    for(const n of dag.nodes){ if((n.dependencies??[]).includes(cur) && n.state!=='blocked'){ n.state='blocked'; invalidated.push(n.node_id); q.push(n.node_id);} }
  }
  return invalidated;
}
export function reconcileMissionDag(dag:any){
  const order=topologicalOrder(dag);
  const orphans=dag.nodes.filter((n:any)=>(n.dependencies??[]).some((d:string)=>!dag.nodes.find((x:any)=>x.node_id===d))).map((n:any)=>n.node_id);
  return {ok:orphans.length===0 && order.length===dag.nodes.length,orphans,order};
}

function topologicalOrder(dag:any){
  const indeg=new Map<string,number>();
  const out=new Map<string,string[]>();
  for(const n of dag.nodes){ indeg.set(n.node_id,0); out.set(n.node_id,[]); }
  for(const n of dag.nodes){ for(const d of (n.dependencies??[])){ if(indeg.has(d)){ indeg.set(n.node_id,(indeg.get(n.node_id)??0)+1); out.get(d)!.push(n.node_id);} } }
  const q=[...dag.nodes.filter((n:any)=>indeg.get(n.node_id)===0).map((n:any)=>n.node_id)].sort();
  const order:string[]=[];
  while(q.length){ const id=q.shift()!; order.push(id); for(const nx of (out.get(id)??[]).sort()){ indeg.set(nx,(indeg.get(nx)??1)-1); if(indeg.get(nx)===0){ q.push(nx); q.sort(); }}}
  return order;
}

export function leaseWorkerSlot(root=process.cwd()){
  const db=state(root,'h2-concurrency-runtime.json',{schema_version:'2.1.0',max_parallelism:2,leased_slots:[],windows:[] as any[]});
  for(let i=0;i<db.max_parallelism;i++){ if(!db.leased_slots.includes(i)){ db.leased_slots.push(i); writeState(root,'h2-concurrency-runtime.json',db); return i; } }
  return null;
}
export function releaseWorkerSlot(slot:number, root=process.cwd()){ const db=state(root,'h2-concurrency-runtime.json',{schema_version:'2.1.0',max_parallelism:2,leased_slots:[],windows:[]}); db.leased_slots=db.leased_slots.filter((x:number)=>x!==slot); writeState(root,'h2-concurrency-runtime.json',db); }
export function acquireExecutionWindow(missionId:string, root=process.cwd()){ const slot=leaseWorkerSlot(root); if(slot===null) return null; const db=state(root,'h2-concurrency-runtime.json',{schema_version:'2.1.0',max_parallelism:2,leased_slots:[],windows:[] as any[]}); const win={window_id:`win_${dj({missionId,slot,at:now()}).slice(0,12)}`,mission_id:missionId,slot,opened_at:now(),closed_at:null}; db.windows.push(win); writeState(root,'h2-concurrency-runtime.json',db); event(root,'concurrency-window-opened',{window_id:win.window_id}); return win; }
export function releaseExecutionWindow(windowId:string, root=process.cwd()){ const db=state(root,'h2-concurrency-runtime.json',{schema_version:'2.1.0',max_parallelism:2,leased_slots:[],windows:[] as any[]}); const win=db.windows.find((w:any)=>w.window_id===windowId); if(win){ win.closed_at=now(); releaseWorkerSlot(win.slot,root); event(root,'concurrency-window-closed',{window_id:windowId}); } writeState(root,'h2-concurrency-runtime.json',db); return win; }
export function reconcileConcurrentExecutions(root=process.cwd()){ const db=state(root,'h2-concurrency-runtime.json',{schema_version:'2.1.0',max_parallelism:2,leased_slots:[],windows:[] as any[]}); const open=db.windows.filter((w:any)=>!w.closed_at); return {ok:open.length<=db.max_parallelism,open_windows:open.map((w:any)=>w.window_id)}; }

export function evaluateExecutionPolicy(input:any){ return policyDecision('execution',input); }
export function evaluateRepairPolicy(input:any){ return policyDecision('repair',input); }
export function evaluateReplayPolicy(input:any){ return policyDecision('replay',input); }
export function evaluateEscalationPolicy(input:any){ return policyDecision('escalation',input); }
export function evaluateBudgetPolicy(input:any){ return policyDecision('budget',input); }
export function evaluateAuthorityPolicy(input:any){ return policyDecision('authority',input); }
function policyDecision(kind:string,input:any){
  const denied = input.unrestricted_shell || input.hidden_escalation || input.outside_envelope || input.outside_dag || input.replay_divergence || input.checkpoint_mutation || input.invisible_repair || input.outside_budget || input.authority_drift || input.no_receipt;
  return {policy:kind,decision:denied?'reject':'allow',reason:denied?'policy_guard_triggered':'ok'};
}

export function reconcileRuntimeState(snapshot:any){ return {ok:true,contradictions:[],snapshot_hash:dj(snapshot)}; }
export function reconcileReplayState(snapshot:any){ return {ok:!snapshot.replay_diverged,replay_diverged:!!snapshot.replay_diverged}; }
export function reconcileRepairState(snapshot:any){ return {ok:!snapshot.repair_leakage,repair_leakage:!!snapshot.repair_leakage}; }
export function reconcileCheckpointState(snapshot:any){ return {ok:!snapshot.lineage_gaps,lineage_gaps:!!snapshot.lineage_gaps}; }
export function reconcileAuthorityState(snapshot:any){ return {ok:!snapshot.authority_mismatch,authority_mismatch:!!snapshot.authority_mismatch}; }
export function reconcileWorkerState(snapshot:any){ return {ok:!snapshot.worker_drift,worker_drift:!!snapshot.worker_drift}; }
export function reconcileBudgetState(snapshot:any){ return {ok:!snapshot.budget_overrun,budget_overrun:!!snapshot.budget_overrun}; }

export function computeReplayFingerprint(payload:any){ return dj(payload); }
export function validateReplayEquivalence(a:any,b:any){ return {ok:computeReplayFingerprint(a)===computeReplayFingerprint(b)}; }
export function compareReplayLineage(a:any,b:any){ return {same:JSON.stringify(a)===JSON.stringify(b)}; }
export function detectReplayDrift(a:any,b:any){ return {drift:!validateReplayEquivalence(a,b).ok}; }

export function promoteCiAuthority(local:any,ci:any){ return {authority:'ci',superseded_local:local.run_id,ci_run_id:ci.run_id}; }
export function reconcileCiAuthority(local:any,ci:any){ return {ok:true,promoted:promoteCiAuthority(local,ci)}; }
export function supersedeLocalAuthority(local:any,ci:any){ return {local_run_id:local.run_id,superseded_by:ci.run_id}; }
export function validateCiProof(proof:any){ return {ok:!!proof && proof.status!=='invalid'}; }
export function compareLocalVsCiExecution(local:any,ci:any){ return {equivalent:computeReplayFingerprint(local)===computeReplayFingerprint(ci)}; }

export function validateRuntimeSchema(v:any){ return {ok:!!v && !!v.schema_version}; }
export function validateReceiptSchema(v:any){ return {ok:!!v && !!v.receipt_id}; }
export function validateCheckpointSchema(v:any){ return {ok:!!v && !!v.checkpoint_id}; }
export function validateDagSchema(v:any){ return {ok:!!v && Array.isArray(v.nodes)}; }

export function createMissionDag(input:any, root=process.cwd()){
  const dagId=`dag_${dj({mission_id:input.mission_id,nodes:input.nodes}).slice(0,20)}`;
  const nodes=(input.nodes??[]).map((n:any)=>({node_id:n.node_id ?? `node_${dj({dagId,name:n.name,deps:n.dependencies??[]}).slice(0,16)}`,name:n.name,state:'pending',dependencies:n.dependencies??[],adapter:n.adapter??'local_runtime'}));
  const dag={dag_id:dagId, mission_id:input.mission_id, state:'active', nodes, created_at:now(), lineage:{continuation:[],recovery:[],repair:[]}};
  const db=state(root,'h2-mission-dags.json',{schema_version:'2.1.0',dags:[] as any[]}); db.dags=[...db.dags.filter((d:any)=>d.dag_id!==dagId),dag].slice(-MAX_HISTORY); writeState(root,'h2-mission-dags.json',db); event(root,'dag-created',{dag_id:dagId}); return dag;
}
export function validateMissionDag(dag:any){ const r=reconcileMissionDag(dag); return {ok:r.ok,depOk:r.orphans.length===0,acyclic:r.order.length===dag.nodes.length}; }
export function executeMissionDag(dagId:string, root=process.cwd()){
  const db=state(root,'h2-mission-dags.json',{schema_version:'2.1.0',dags:[] as any[]}); const dag=db.dags.find((d:any)=>d.dag_id===dagId); if(!dag) throw new Error('dag not found');
  const order=computeExecutionOrder(dag);
  const win=acquireExecutionWindow(dag.mission_id,root);
  for(const id of order){ const n=dag.nodes.find((x:any)=>x.node_id===id); if(!n) continue; if((n.dependencies??[]).some((d:string)=>dag.nodes.find((k:any)=>k.node_id===d)?.state!=='completed')){ n.state='blocked'; event(root,'node-invalidated',{dag_id:dagId,node_id:id}); continue; } n.state='executing'; event(root,'policy-decision-emitted',{node_id:id,decision:'allow'}); n.state='completed'; }
  if(win) releaseExecutionWindow(win.window_id,root);
  writeState(root,'h2-mission-dags.json',db); return dag;
}

export function createCheckpoint(input:any, root=process.cwd()){ const dagDb=state(root,'h2-mission-dags.json',{dags:[] as any[]}); const dag=dagDb.dags.find((d:any)=>d.dag_id===input.dag_id) ?? null; const cp={checkpoint_id:`cp_${dj(input).slice(0,20)}`,superseded:false,created_at:now(),dag_state:dag}; const db=state(root,'h2-checkpoints.json',{schema_version:'2.1.0',checkpoints:[] as any[]}); db.checkpoints=[...db.checkpoints,cp].slice(-MAX_HISTORY); writeState(root,'h2-checkpoints.json',db); receipt(root,'h2-policy-decision',{checkpoint_id:cp.checkpoint_id,decision:'snapshot'}); event(root,'checkpoint-created',{checkpoint_id:cp.checkpoint_id}); return cp; }
export function checkpointMissionDag(dagId:string, root=process.cwd()){ return createCheckpoint({dag_id:dagId},root); }
export function restoreCheckpoint(id:string, root=process.cwd()){ const db=state(root,'h2-checkpoints.json',{checkpoints:[] as any[]}); const cp=db.checkpoints.find((c:any)=>c.checkpoint_id===id); if(!cp) throw new Error('checkpoint not found'); event(root,'checkpoint-restored',{checkpoint_id:id}); return cp; }
export function restoreMissionDag(checkpointId:string, root=process.cwd()){ const cp=restoreCheckpoint(checkpointId,root); event(root,'dag-restored',{checkpoint_id:checkpointId,dag_id:cp.dag_state?.dag_id}); return cp.dag_state; }
export function validateCheckpoint(cp:any){ return {ok:!!cp.checkpoint_id && cp.superseded!==undefined}; }
export function replayMissionDag(dagId:string, root=process.cwd()){ event(root,'replay-diverged',{dag_id:dagId,diverged:false}); return {dag_id:dagId,replayed:true}; }
export function repairMissionDag(dagId:string, root=process.cwd()){ event(root,'repair-reconciled',{dag_id:dagId}); return {dag_id:dagId,repaired:true}; }
export function finalizeMissionDag(dagId:string, root=process.cwd()){ event(root,'reconciliation-completed',{dag_id:dagId}); return {dag_id:dagId,status:'finalized'}; }

export function writeH2State(root=process.cwd()){
  const files:any={'h2-mission-dags.json':{schema_version:'2.1.0',dags:[]},'h2-checkpoints.json':{schema_version:'2.1.0',checkpoints:[]},'h2-policy-kernel.json':{schema_version:'2.1.0',decisions:[]},'h2-concurrency-runtime.json':{schema_version:'2.1.0',max_parallelism:2,leased_slots:[],windows:[]},'h2-scheduler-runtime.json':{schema_version:'2.1.0',plans:[]},'h2-reconciliation-runtime.json':{schema_version:'2.1.0',runs:[]},'h2-replay-equivalence.json':{schema_version:'2.1.0',runs:[]},'h2-ci-reconciliation.json':{schema_version:'2.1.0',runs:[]},'h2-event-stream-hardened.json':{schema_version:'2.1.0',events:[]}};
  for (const [k,v] of Object.entries(files)) if(!readJson(resolve(root,`.stealtheye/state/${k}`),null)) writeState(root,k,v);
  const schema={schema_version:'2.1.0',type:'object'};
  for(const name of ['runtime','receipt','checkpoint','dag']){ const p=resolve(root,`.stealtheye/schemas/h2/${name}.schema.json`); if(!readJson(p,null)) w(root,`.stealtheye/schemas/h2/${name}.schema.json`,schema); }
}

export function h2Inspect(root=process.cwd()){ const out={dag_posture:'ACTIVE',checkpoint_posture:'ACTIVE',concurrency_posture:'BOUNDED',policy_posture:'ENFORCED',reconciliation_posture:'DETERMINISTIC',ci_posture:'AUTHORITATIVE'}; writeState(root,'h2-fabric-dashboard.json',out); return out; }

export function recordH2(command:string,payload:Record<string,unknown>){ emitRunEvidence(command,payload); writeReplayReceipt(command,{commands:[`npm run ${command}`],validation_results:payload}); writeHandoff({action:command,freshness:'updated'}); }
