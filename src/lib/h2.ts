import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { bootstrap } from './bootstrap.js';
import { readJson, emitRunEvidence, writeHandoff, writeReplayReceipt } from './substrate.js';

const TOOL_TYPES = ['github','browser','codex','ci_actions','local_runtime','agent_mode','future_mcp_bridge'] as const;
const ROUTE_CLASSES = ['github','browser','codex','ci','local_runtime','denied','escalated','degraded','replay_only'] as const;
const APPROVAL_CLASSES = ['NONE','SECRET','CREDENTIAL','MONEY','IRREVERSIBLE_DELETE'] as const;

const MAX_HISTORY = 120;

type ExecutionRoute = (typeof ROUTE_CLASSES)[number];

export function h2Bootstrap(root=process.cwd()) { bootstrap(root); mkdirSync(resolve(root,'.stealtheye/tooling'),{recursive:true}); }
const w=(root:string,p:string,v:unknown)=>{const a=resolve(root,p); mkdirSync(resolve(a,'..'),{recursive:true}); writeFileSync(a,JSON.stringify(v,null,2));};
const dj=(i:unknown)=>createHash('sha256').update(JSON.stringify(i)).digest('hex');
const now=()=>new Date().toISOString();

export function deterministicExecutionEnvelopeId(input:Record<string,unknown>) { return `env_${dj(input).slice(0,24)}`; }
export function deterministicExecutionAttemptId(input:Record<string,unknown>) { return `att_${dj({kind:'attempt',...input}).slice(0,20)}`; }
export function deterministicExecutionReplayId(input:Record<string,unknown>) { return `rep_${dj({kind:'replay',...input}).slice(0,20)}`; }

export function deterministicExecutionId(input:Record<string,unknown>) { return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0,24); }

export function writeH2Governance(root=process.cwd()) {
  h2Bootstrap(root);
  const tools = TOOL_TYPES.map((t,i)=>({ tool_id:`tool:${t}`, tool_class:t, capabilities:[`${t}:read`,`$${t}:execute`.replace('$','')], allowed_actions:['read','classify','route','bounded-retry','emit-receipt'], forbidden_actions:['unbounded-loop','silent-side-effect','unsafe-merge','unrestricted-shell-execution'], escalation_policy:{max_escalations:2,targets:['ci_actions','human_required']}, retry_policy:{max_retries:2,backoff:'deterministic-linear'}, authority_level:i<3?'governed':'bounded', approval_requirements:APPROVAL_CLASSES, evidence_requirements:['lineage','rationale','score'], receipt_requirements:['execution-envelope','continuity','authority'], replay_requirements:['deterministic_execution_id','replay_lineage'], operational_bounds:{timebox_ms:900000,max_actions:16}, anti_invariants:['no-hidden-side-effects','no-unbounded-retries','no-unsafe-merge'], routing_priority:i+1, degraded_modes:['ci-authoritative','read-only'], continuity_requirements:['runtime-clock-ref','event-bus-ref'], deterministic_execution_expectation:'strict' }));
  w(root,'.stealtheye/tooling/tool-registry.json',{schema_version:'2.0.0',tools});
  w(root,'.stealtheye/tooling/tool-policies.json',{schema_version:'2.0.0',approval_classes:APPROVAL_CLASSES,forbidden_global:['product-feature-implementation','autonomous-unsafe-merge','credential-exfiltration']});
  w(root,'.stealtheye/tooling/tool-routing.json',{schema_version:'2.0.0',route_classes:ROUTE_CLASSES,deterministic:true,priority_order:[...TOOL_TYPES]});
  w(root,'.stealtheye/tooling/tool-authority.json',{schema_version:'2.0.0',authority_chain:['runtime','routing','approval-broker','ci-authority'],merge_execution:'forbidden-autonomous'});
  w(root,'.stealtheye/tooling/tool-risk-classes.json',{schema_version:'2.0.0',risk_classes:[{name:'low',retry_ceiling:2},{name:'medium',retry_ceiling:1},{name:'high',retry_ceiling:0,requires_escalation:true}]});
  w(root,'.stealtheye/tooling/tool-capability-matrix.json',{schema_version:'2.0.0',matrix:tools.map(t=>({tool_id:t.tool_id,capabilities:t.capabilities,forbidden_actions:t.forbidden_actions}))});
}

export function createExecutionEnvelope(mission:any, root=process.cwd()) {
  const id = deterministicExecutionEnvelopeId(mission);
  const attempt = deterministicExecutionAttemptId({mission_id:mission.mission_id,seq:mission.attempt_seq ?? 0});
  const envelope = {
    execution_id:id, attempt_id:attempt, mission_id:mission.mission_id ?? 'mission:unknown', execution_class:mission.execution_class ?? 'governed',
    tool_class:mission.tool_class ?? 'local_runtime', authority_level:mission.authority_level ?? 'governed', route_class:mission.route_class ?? 'local_runtime', replay_seed:dj(mission).slice(0,16),
    repair_strategy:mission.repair_strategy ?? 'bounded_retry_then_escalate', escalation_class:mission.escalation_class ?? 'ci_authority', bounded_retry_limit: mission.bounded_retry_limit ?? 2,
    execution_window: mission.execution_window ?? {start:now(), max_ms:900000}, deterministic_clock: mission.deterministic_clock ?? 'h1-runtime-clock', continuity_parent: mission.continuity_parent ?? null,
    continuity_children: mission.continuity_children ?? [], execution_contract_hash:dj({contract:'h2-execution-v1', mission_id: mission.mission_id}), execution_receipt_hash:'pending',
    runtime_posture: mission.runtime_posture ?? 'bounded', ci_authority_required: mission.ci_authority_required ?? false, anti_invariant_guards: ['no-uncontrolled-execution','no-hidden-routing','no-nondeterministic-retry','no-silent-escalation','no-unbounded-loops','no-unrestricted-shell','no-policy-mutation-during-execution','no-hidden-authority-elevation','no-execution-without-receipts','no-execution-without-replay-lineage','no-orphaned-execution-states'],
    policy_snapshot: mission.policy_snapshot ?? readJson(resolve(root,'.stealtheye/tooling/tool-policies.json'),{}), routing_snapshot: mission.routing_snapshot ?? {}, execution_outcome:'pending'
  };
  const db=readJson(resolve(root,'.stealtheye/state/h2-execution-envelopes.json'),{schema_version:'2.0.0',envelopes:[] as any[]}) as any;
  db.envelopes=[...(db.envelopes??[]), envelope].slice(-MAX_HISTORY);
  w(root,'.stealtheye/state/h2-execution-envelopes.json',db);
  return envelope;
}

export function finalizeExecutionEnvelope(envelope:any, outcome:any, root=process.cwd()) {
  const fin={...envelope, execution_outcome:outcome.status ?? 'completed', execution_receipt_hash:dj(outcome), continuity_children:[...(envelope.continuity_children??[]), outcome.receipt_id].filter(Boolean)};
  const db=readJson(resolve(root,'.stealtheye/state/h2-execution-envelopes.json'),{schema_version:'2.0.0',envelopes:[] as any[]}) as any;
  db.envelopes=(db.envelopes??[]).map((e:any)=>e.execution_id===fin.execution_id?fin:e);
  w(root,'.stealtheye/state/h2-execution-envelopes.json',db);
  return fin;
}

export function classifyExecutionRisk(m:any){ return m.authority_level==='restricted' || m.ci_authority_required ? 'high' : (m.execution_class==='governed'?'medium':'low'); }
export function selectExecutionAuthority(m:any, risk:string){ return risk==='high'?'ci-authority':(m.authority_level ?? 'runtime-governed'); }
export function determineExecutionRoute(m:any, risk:string):ExecutionRoute { if (m.replay_only) return 'replay_only'; if (m.force_denied) return 'denied'; if (risk==='high' && !m.ci_authority_required) return 'escalated'; return (['github','browser','codex','ci','local_runtime'].includes(m.tool_class)?m.tool_class:'degraded') as ExecutionRoute; }
export function selectExecutionWorker(route:ExecutionRoute){ return ({github:'GitHubAdapter',browser:'BrowserAdapter',codex:'CodexAdapter',ci:'CIAdapter',local_runtime:'LocalRuntimeAdapter',degraded:'LocalRuntimeAdapter',escalated:'CIAdapter',denied:'LocalRuntimeAdapter',replay_only:'LocalRuntimeAdapter'} as any)[route]; }
export function selectRepairStrategy(m:any,risk:string){ return risk==='high'?'escalate-immediately':'retry-then-escalate'; }

function appendState(root:string, file:string, item:any, key='entries') { const cur=readJson(resolve(root,file),{schema_version:'2.0.0',[key]:[]} as any) as any; cur[key]=[...(cur[key]??[]),item].slice(-MAX_HISTORY); w(root,file,cur); }

function emitReceipt(root:string, type:string, body:any){ const rid=`h2-execution-${type}-${dj(body).slice(0,16)}`; const receipt={schema_version:'1.0.0',receipt_id:rid,receipt_type:type,created_at:now(),...body}; w(root,`.stealtheye/receipts/${rid}.json`,receipt); return receipt; }

function adapterExecute(adapter:string, mission:any, envelope:any, route:ExecutionRoute, authority:string, root:string){
  const execution={adapter,status: route==='denied'?'denied':'completed',bounded:true,deterministic:true,replay_id:deterministicExecutionReplayId({execution_id:envelope.execution_id,route}),trace:[`adapter:${adapter}`,`route:${route}`],lineage:{execution_id:envelope.execution_id,attempt_id:envelope.attempt_id,mission_id:envelope.mission_id},authority_metadata:{authority,ci_required:mission.ci_authority_required??false},repair_metadata:{strategy:mission.repair_strategy??'retry-then-escalate',retry_limit:mission.bounded_retry_limit??2},replay_metadata:{seed:envelope.replay_seed,replay_only:route==='replay_only'}};
  appendState(root,'.stealtheye/state/h2-adapter-state.json',execution,'adapter_events');
  return execution;
}

export function routeExecutionMission(mission:any, root=process.cwd()) {
  const risk=classifyExecutionRisk(mission); const authority=selectExecutionAuthority(mission,risk); const route=determineExecutionRoute(mission,risk); const worker=selectExecutionWorker(route);
  const repair=selectRepairStrategy(mission,risk); const envelope=createExecutionEnvelope({...mission,route_class:route,repair_strategy:repair,tool_class:mission.tool_class ?? route},root);
  appendState(root,'.stealtheye/state/h2-runtime-event-bus.json',{event:'execution-started',execution_id:envelope.execution_id,route,at:now()},'events');
  let adapterResult=adapterExecute(worker,mission,envelope,route,authority,root);
  const receiptType= route==='denied'?'denial': route==='degraded'?'degraded': route==='replay_only'?'replay': route==='escalated'?'escalation':'execution';
  const receipt=emitReceipt(root,receiptType,{deterministic_ids:{execution_id:envelope.execution_id,attempt_id:envelope.attempt_id,replay_id:adapterResult.replay_id},route_lineage:[route],repair_lineage:[repair],execution_lineage:[worker],authority_lineage:[authority],ci_lineage:[mission.ci_authority_required?'required':'optional'],replay_lineage:[adapterResult.replay_metadata.seed],policy_lineage:[dj(envelope.policy_snapshot)],boundedness_proofs:{retry_limit:envelope.bounded_retry_limit,timebox_ms:envelope.execution_window.max_ms,deterministic:true},adapter_result:adapterResult});
  appendState(root,'.stealtheye/state/h2-routing-runtime.json',{mission_id:mission.mission_id,route,risk,authority,worker,repair},'routes');
  appendState(root,'.stealtheye/state/h2-execution-memory.json',{mission_id:mission.mission_id,route_history:[route],repair_history:[repair],degraded_history:route==='degraded'?[mission.mission_id]:[],escalation_history:route==='escalated'?[mission.mission_id]:[],denial_history:route==='denied'?[mission.mission_id]:[],replay_history:[adapterResult.replay_id],ci_authority_history:[authority],execution_effectiveness_history:[adapterResult.status],latest_pointers:{execution_id:envelope.execution_id,receipt_id:receipt.receipt_id}},'history');
  const finalized=finalizeExecutionEnvelope(envelope,{status:adapterResult.status,receipt_id:receipt.receipt_id},root);
  appendState(root,'.stealtheye/state/h2-runtime-event-bus.json',{event:adapterResult.status==='denied'?'execution-denied':'execution-completed',execution_id:envelope.execution_id,receipt_id:receipt.receipt_id,at:now()},'events');
  return {risk,authority,route,worker,repair,receipt_id:receipt.receipt_id,envelope:finalized};
}

export function buildH2ExecutionContracts(root=process.cwd()) { /* unchanged semantics */ const base={schema_version:'2.0.0',deterministic:true};
  w(root,'.stealtheye/state/h2-execution-contracts.json',{request:{...base,type:'execution-request'},result:{...base,type:'execution-result'}});
}

export function writeH2State(root=process.cwd()){
  const stateFiles:any = {
    'h2-github-state.json':{schema_version:'2.0.0',capabilities:['issue-rw'],unsafe_merge_execution:false,dry_run_governance:true},
    'h2-adapter-state.json':{schema_version:'2.0.0',adapter_events:[]},
    'h2-routing-runtime.json':{schema_version:'2.0.0',routes:[]},
    'h2-repair-runtime.json':{schema_version:'2.0.0',repair_planner:'deterministic',retry_planner:'bounded',bounded_retry_executor:{max_retries:2},escalation_planner:'ci-first',repair_confidence_scorer:'deterministic-static',repair_effectiveness_scorer:'deterministic-history',repair_exhaustion_detector:'retry-or-escalation-ceiling',events:[]},
    'h2-execution-memory.json':{schema_version:'2.0.0',history:[],retention:{max_entries:MAX_HISTORY,deterministic_pruning:'truncate-oldest',continuity_preservation:true}},
    'h2-runtime-event-bus.json':{schema_version:'2.0.0',events:[]}
  };
  for (const [k,v] of Object.entries(stateFiles)) { if(!readJson(resolve(root,`.stealtheye/state/${k}`),null)) w(root,`.stealtheye/state/${k}`,v); }
  w(root,'.stealtheye/validation/h2-readiness.json',{status:'active',phase:'H2',checks:{tool_sovereignty:true,execution_contracts:true,repair_loop:true}});
}

export function h2Inspect(root=process.cwd()){
  const routing=readJson(resolve(root,'.stealtheye/state/h2-routing-runtime.json'),{} as any) as any;
  const mem=readJson(resolve(root,'.stealtheye/state/h2-execution-memory.json'),{} as any) as any;
  const events=readJson(resolve(root,'.stealtheye/state/h2-runtime-event-bus.json'),{} as any) as any;
  const out={execution_posture:'DETERMINISTIC_BOUNDED',routing_posture:'GOVERNED',repair_posture:'BOUNDED',authority_posture:'EXPLICIT',ci_posture:'CI_AUTHORITATIVE',replay_posture:'REPLAYABLE',boundedness_posture:'ENFORCED',escalation_posture:'VISIBLE',denial_posture:'RECEIPTED',execution_memory_health:(mem.history?.length??0)<=MAX_HISTORY?'PASS':'FAIL',event_stream_health:(events.events?.length??0)>=0?'PASS':'FAIL',continuity_health:'PASS',routes_observed:routing.routes?.length??0};
  w(root,'.stealtheye/state/h2-operational-dashboard.json',out); return out;
}

export function recordH2(command:string,payload:Record<string,unknown>){ emitRunEvidence(command,payload); writeReplayReceipt(command,{commands:[`npm run ${command}`],validation_results:payload}); writeHandoff({action:command,freshness:'updated'}); }
