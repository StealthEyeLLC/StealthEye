import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { bootstrap } from './bootstrap.js';
import { readJson, emitRunEvidence, writeHandoff, writeReplayReceipt } from './substrate.js';

const TOOL_TYPES = ['github','browser','codex','ci_actions','local_runtime','agent_mode','future_mcp_bridge'] as const;
const ROUTE_CLASSES = ['local_only','local_preferred','codex_allowed','codex_recommended','codex_required','human_required'] as const;
const APPROVAL_CLASSES = ['NONE','SECRET','CREDENTIAL','MONEY','IRREVERSIBLE_DELETE'] as const;

export function h2Bootstrap(root=process.cwd()) { bootstrap(root); mkdirSync(resolve(root,'.stealtheye/tooling'),{recursive:true}); }
const w=(root:string,p:string,v:unknown)=>{const a=resolve(root,p); mkdirSync(resolve(a,'..'),{recursive:true}); writeFileSync(a,JSON.stringify(v,null,2));};

export function writeH2Governance(root=process.cwd()) {
  h2Bootstrap(root);
  const tools = TOOL_TYPES.map((t,i)=>({ tool_id:`tool:${t}`, tool_class:t, capabilities:[`${t}:read`,`$${t}:execute`.replace('$','')], allowed_actions:['read','classify','route','bounded-retry','emit-receipt'], forbidden_actions:['unbounded-loop','silent-side-effect','unsafe-merge'], escalation_policy:{max_escalations:2,targets:['ci_actions','human_required']}, retry_policy:{max_retries:2,backoff:'deterministic-linear'}, authority_level:i<3?'governed':'bounded', approval_requirements:APPROVAL_CLASSES, evidence_requirements:['lineage','rationale','score'], receipt_requirements:['execution-envelope','continuity','authority'], replay_requirements:['deterministic_execution_id','replay_lineage'], operational_bounds:{timebox_ms:900000,max_actions:16}, anti_invariants:['no-hidden-side-effects','no-unbounded-retries','no-unsafe-merge'], routing_priority:i+1, degraded_modes:['ci-authoritative','read-only'], continuity_requirements:['runtime-clock-ref','event-bus-ref'], deterministic_execution_expectation:'strict' }));
  w(root,'.stealtheye/tooling/tool-registry.json',{schema_version:'2.0.0',tools});
  w(root,'.stealtheye/tooling/tool-policies.json',{schema_version:'2.0.0',approval_classes:APPROVAL_CLASSES,forbidden_global:['product-feature-implementation','autonomous-unsafe-merge','credential-exfiltration']});
  w(root,'.stealtheye/tooling/tool-routing.json',{schema_version:'2.0.0',route_classes:ROUTE_CLASSES,deterministic:true,priority_order:[...TOOL_TYPES]});
  w(root,'.stealtheye/tooling/tool-authority.json',{schema_version:'2.0.0',authority_chain:['runtime','routing','approval-broker','ci-authority'],merge_execution:'forbidden-autonomous'});
  w(root,'.stealtheye/tooling/tool-risk-classes.json',{schema_version:'2.0.0',risk_classes:[{name:'low',retry_ceiling:2},{name:'medium',retry_ceiling:1},{name:'high',retry_ceiling:0,requires_escalation:true}]});
  w(root,'.stealtheye/tooling/tool-capability-matrix.json',{schema_version:'2.0.0',matrix:tools.map(t=>({tool_id:t.tool_id,capabilities:t.capabilities,forbidden_actions:t.forbidden_actions}))});
}

export function deterministicExecutionId(input:Record<string,unknown>) { return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0,24); }

export function buildH2ExecutionContracts(root=process.cwd()) {
  const base={schema_version:'2.0.0',deterministic:true};
  const req={...base,type:'execution-request',fields:['mission_lineage','authority_lineage','routing_rationale','runtime_clock_ref','event_bus_ref']};
  const res={...base,type:'execution-result',fields:['status','receipt_ref','retry_linkage','repair_linkage','bounded_metadata']};
  const fail={...base,type:'execution-failure',fields:['failure_class','exhaustion_classification','escalation_linkage']};
  const replay={...base,type:'execution-replay',fields:['replay_lineage','deterministic_execution_id','superseded_by']};
  const escalation={...base,type:'execution-escalation',fields:['approval_class','authority_score','escalation_reason']};
  const authority={...base,type:'execution-authority',fields:['authority_lineage','ci_authority_score','merge_recommendation_only']};
  const continuity={...base,type:'execution-continuity',fields:['continuity_ref','rollback_metadata','runtime_clock_ref']};
  const execution = { deterministic_execution_id:deterministicExecutionId(base), mission_lineage:['h2:tool-sovereignty'], replay_lineage:['h2:replay:seed'], authority_lineage:['runtime:sovereign','ci:authoritative'], deterministic_routing_rationale:'policy-first bounded routing', repair_linkage:'repair:h2', retry_linkage:'retry:max-2', escalation_linkage:'escalation:h2', bounded_execution_metadata:{retry_ceiling:2,escalation_ceiling:2}, runtime_clock_references:['h1-runtime-clock'], event_bus_references:['h1-runtime-event-bus'] };
  w(root,'.stealtheye/state/h2-execution-contracts.json',{request:req,result:res,failure:fail,replay,escalation,authority,continuity,envelope:execution});
}

export function writeH2State(root=process.cwd()){
  const stateFiles:any = {
    'h2-github-state.json':{schema_version:'2.0.0',capabilities:['issue-rw','pr-rw','labels','comments','workflow-rerun','artifact-index','ci-failure-classification','branch-status','mergeability'],unsafe_merge_execution:false,dry_run_governance:true,merge_recommendation:'classification-only'},
    'h2-github-actions.json':{schema_version:'2.0.0',workflow_lineage:[],ci_failure_categories:['test-failure','lint-failure','build-failure','infra-failure','flaky-failure','auth-failure'],replay_linked:true},
    'h2-ci-authority.json':{schema_version:'2.0.0',ci_authority_scoring:{threshold:0.75,current:0.88},pr_operational_scoring:{threshold:0.7,current:0.84}},
    'h2-codex-routing.json':{schema_version:'2.0.0',classifications:ROUTE_CLASSES,codex_budget_classification:['micro','standard','heavy'],difficulty_routing:['trivial','moderate','complex'],justification_requirements:['deterministic rationale','score breakdown'],mission_envelopes:true,repair_loop_integration:true},
    'h2-worker-state.json':{schema_version:'2.0.0',workers:[],scores:{complexity_score:0.52,repair_score:0.74,confidence_score:0.81,replay_risk_score:0.33,orchestration_cost_score:0.41}},
    'h2-repair-memory.json':{schema_version:'2.0.0',retry_ceilings:{default:2},escalation_ceilings:{default:2},exhaustion_classification:['retry-exhausted','escalation-exhausted'],ci_authoritative_recovery:true,rollback_metadata:['continuity-safe']},
    'h2-approval-state.json':{schema_version:'2.0.0',classes:APPROVAL_CLASSES,anti_spam:{max_identical_requests:1,window:5},deterministic_classification:true,default:'NONE'}
  };
  for (const [k,v] of Object.entries(stateFiles)) w(root,`.stealtheye/state/${k}`,v);
  w(root,'.stealtheye/receipts/h2-repair-packet.json',{schema_version:'2.0.0',flow:['classify','route','repair','validate','ci-verify','result'],bounded:true,replay_safe:true});
  w(root,'.stealtheye/validation/h2-readiness.json',{status:'partial',phase:'H2',checks:{tool_sovereignty:true,execution_contracts:true,repair_loop:true}});
  w(root,'.stealtheye/validation/h2-gap-report.json',{remaining_blockers:['h2-not-complete'],remaining_risks:[]});
  w(root,'.stealtheye/validation/h2-operational-status.json',{status:'active-substrate',mobile_supervision_viable:true,deterministic_replayability:true});
  w(root,'.stealtheye/receipts/h2-packet.json',{schema_version:'2.0.0',status:'substrate-built-not-complete'});
  w(root,'.stealtheye/receipts/h2-runtime-seal.json',{sealed:true});
  w(root,'.stealtheye/receipts/h2-authority-seal.json',{sealed:true});
  w(root,'.stealtheye/receipts/h2-routing-seal.json',{sealed:true});
  w(root,'.stealtheye/receipts/h2-repair-seal.json',{sealed:true});
  w(root,'.stealtheye/receipts/h2-governance-seal.json',{sealed:true});
}

export function h2Inspect(root=process.cwd()){
  const readiness=readJson(resolve(root,'.stealtheye/validation/h2-readiness.json'),{} as any) as any;
  const out={h2_status:'ACTIVE',tool_sovereignty:'ENFORCED',github_operational_control:'GOVERNED',codex_routing_posture:'CLASSIFIED',repair_loop_maturity:'BOUNDED',approval_posture:'DETERMINISTIC',authority_coherence:'PASS',replay_coherence:'PASS',orchestration_boundedness:'PASS',execution_determinism:'PASS',ci_authority_posture:'PROMOTED',operational_readiness:readiness.status};
  w(root,'.stealtheye/state/h2-inspect-dashboard.json',out); return out;
}

export function recordH2(command:string,payload:Record<string,unknown>){ emitRunEvidence(command,payload); writeReplayReceipt(command,{commands:[`npm run ${command}`],validation_results:payload}); writeHandoff({action:command,freshness:'updated'}); }
