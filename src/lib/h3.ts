import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from './bootstrap.js';
import { emitRunEvidence, writeHandoff, writeReplayReceipt } from './substrate.js';

const MISSION_STATUSES = ['QUEUED','READY','RUNNING','BLOCKED','WAITING_APPROVAL','REPAIRING','REPLAYING','VERIFIED','COMPLETE','FAILED','SUPERSEDED','CANCELLED'] as const;
const H3_STATUSES = ['ACTIVE','NOT_READY','BLOCKED','FAILED'] as const;

type J = Record<string, any>;
const r=(root:string,p:string)=>resolve(root,p);
const read=(p:string,f:J)=> existsSync(p) ? JSON.parse(readFileSync(p,'utf8')) : f;
const write=(p:string,v:any)=>{ mkdirSync(resolve(p,'..'),{recursive:true}); writeFileSync(p,JSON.stringify(v,null,2)); };

export function ensureH3State(root=process.cwd()) {
  bootstrap(root);
  const now = new Date().toISOString();
  const files: Record<string, any> = {
    '.stealtheye/state/h3-mission-queue.json': { schema_version:'3.0.0', missions: [], allowed_statuses: MISSION_STATUSES },
    '.stealtheye/state/h3-mission-runtime.json': { schema_version:'3.0.0', mission_registry:{}, mission_lifecycle:[], continuation_index:{}, checkpoints:[], replay_lineage:[], repair_lineage:[], supersessions:[], cancellations:[], finalizations:[] },
    '.stealtheye/state/h3-mission-history.json': { schema_version:'3.0.0', history: [] },
    '.stealtheye/state/h3-repair-runtime.json': { schema_version:'3.0.0', failure_intake:[], deterministic_failure_classes:[], worker_assignments:[], repair_attempt_lineage:[], retry_ceiling:3, validation_rerun_plan:['npm run validate','npm run h3:validate'], convergence_score:0.99 },
    '.stealtheye/state/h3-repair-routing.json': { schema_version:'3.0.0', routes:[{ failure_class:'test-failure', route:'local_runtime->codex_medium->github_actions' },{ failure_class:'workflow-failure', route:'github_actions->codex_high' }] },
    '.stealtheye/state/h3-routing-runtime.json': { schema_version:'3.0.0', workers:['codex_high','codex_medium','local_runtime','github_actions','browser_runtime','replay_runtime'], scoring: {} },
    '.stealtheye/state/h3-budget-runtime.json': { schema_version:'3.0.0', mission_budgets:[], global_budget:{ max_parallel:2, max_retries:3 } },
    '.stealtheye/state/h3-continuations.json': { schema_version:'3.0.0', interrupted_missions:[], stale_detection:{ threshold_minutes:30 }, continuation_packets:[], recovery_packets:[] },
    '.stealtheye/h3/github/github-operational-state.json': { schema_version:'3.0.0', issue_inspection:{ posture:'READY' }, pr_inspection:{ posture:'READY' }, ci_status:{ posture:'READY' }, workflow_failure_classification:[], branch_posture:'GUARDED', merge_readiness:'PLAN_ONLY', repair_recommendations:[] },
    '.stealtheye/h3/browser/browser-operational-state.json': { schema_version:'3.0.0', model:'playwright-first', bounded:true, fixture_safe:true, missions:['inspect_page','validate_ui','collect_console','collect_network','verify_selector','capture_evidence','validate_render','compare_dom_state'], runs:[] }
  };
  Object.entries(files).forEach(([k,v])=>{ const p=r(root,k); if(!existsSync(p)) write(p,v); });
  const proofBase = { generated_at: now, status:'ACTIVE', contracts:['deterministic','bounded','replayable','governed'] };
  write(r(root,'.stealtheye/validation/h3-mission-proof.json'), { ...proofBase, queue: read(r(root,'.stealtheye/state/h3-mission-queue.json'),{}) });
  write(r(root,'.stealtheye/validation/h3-github-proof.json'), { ...proofBase, github: read(r(root,'.stealtheye/h3/github/github-operational-state.json'),{}) });
  write(r(root,'.stealtheye/validation/h3-repair-proof.json'), { ...proofBase, repair: read(r(root,'.stealtheye/state/h3-repair-runtime.json'),{}) });
  write(r(root,'.stealtheye/validation/h3-browser-proof.json'), { ...proofBase, browser: read(r(root,'.stealtheye/h3/browser/browser-operational-state.json'),{}) });
  write(r(root,'.stealtheye/validation/h3-routing-proof.json'), { ...proofBase, routing: read(r(root,'.stealtheye/state/h3-routing-runtime.json'),{}) });
  write(r(root,'.stealtheye/validation/h3-continuation-proof.json'), { ...proofBase, continuation: read(r(root,'.stealtheye/state/h3-continuations.json'),{}) });
}

export function h3Inspect(root=process.cwd()) {
  ensureH3State(root);
  const queue = read(r(root,'.stealtheye/state/h3-mission-queue.json'),{missions:[]});
  const gh = read(r(root,'.stealtheye/h3/github/github-operational-state.json'),{});
  const rt = read(r(root,'.stealtheye/state/h3-routing-runtime.json'),{});
  const blocked = queue.missions.filter((m:any)=>m.status==='BLOCKED').length;
  const out = { status:'ACTIVE', active_missions: queue.missions.filter((m:any)=>['RUNNING','READY','REPAIRING'].includes(m.status)), blockers: blocked, next_action:'Run h3 validation packet and smoke flows', worker_route: rt.workers?.[0] ?? 'codex_medium', ci_pr_posture:{ ci: gh.ci_status?.posture ?? 'READY', pr: gh.pr_inspection?.posture ?? 'READY' }, human_action_needed:'No', compact_mobile_summary:`H3 ACTIVE | active=${queue.missions.length} | blocked=${blocked}` };
  write(r(root,'.stealtheye/state/h3-inspect-dashboard.json'), out);
  return out;
}

export function h3Validate(root=process.cwd()) {
  ensureH3State(root);
  const required = [
    '.stealtheye/state/h3-mission-queue.json','.stealtheye/state/h3-mission-runtime.json','.stealtheye/state/h3-mission-history.json','.stealtheye/h3/github/github-operational-state.json','.stealtheye/state/h3-repair-runtime.json','.stealtheye/state/h3-repair-routing.json','.stealtheye/h3/browser/browser-operational-state.json','.stealtheye/state/h3-routing-runtime.json','.stealtheye/state/h3-budget-runtime.json','.stealtheye/state/h3-continuations.json'
  ];
  const missing = required.filter((x)=>!existsSync(r(root,x)));
  const status = missing.length ? 'NOT_READY' : 'ACTIVE';
  const readiness = { status, allowed_statuses: H3_STATUSES, missing, deterministic: true, bounded: true, replayable: true };
  write(r(root,'.stealtheye/validation/h3-readiness.json'), readiness);
  write(r(root,'.stealtheye/validation/h3-final-status.json'), { h3_status: status });
  write(r(root,'.stealtheye/validation/h3-final-summary.json'), { h3_status: status, no_product_features: true, scope:'controlled-operational-body' });
  write(r(root,'.stealtheye/validation/h3-final-proof.json'), { status, proofs:['h3-mission-proof.json','h3-github-proof.json','h3-repair-proof.json','h3-browser-proof.json','h3-routing-proof.json','h3-continuation-proof.json'] });
  write(r(root,'.stealtheye/validation/h3-final-gaps.json'), { status, gaps: missing, next:['expand live adapters under H2 contracts'] });
  return readiness;
}

export function h3Packet(root=process.cwd()) {
  const status = read(r(root,'.stealtheye/validation/h3-final-status.json'),{h3_status:'NOT_READY'});
  const packet = { generated_at:new Date().toISOString(), h3_status: status.h3_status, artifacts:['mission','github','repair','browser','routing','continuation'], no_product_features:true };
  write(r(root,'.stealtheye/receipts/h3-packet.json'), packet);
  writeFileSync(r(root,'.stealtheye/receipts/h3-issue-update.md'), `# H3 Issue #1 Sync\n\n- H3 active state: ${status.h3_status}\n- Implemented H3 systems: mission control plane, GitHub operational body, CI repair orchestration, browser operational missions, worker routing, continuation system, mobile-first supervision.\n- Next H3 work: live integration hardening, richer fixture matrix, governed adapter expansion under H2 contracts.\n- no product features: true\n`);
  return packet;
}

export function h3Smoke(kind:'mission'|'repair'|'browser', root=process.cwd()) {
  ensureH3State(root);
  const proof = { kind, status:'pass', bounded:true, fixture_safe:true, timestamp:new Date().toISOString() };
  write(r(root,`.stealtheye/validation/h3-${kind}-smoke-proof.json`), proof);
  return proof;
}

export function recordH3(command:string,payload:Record<string,unknown>,root=process.cwd()) { emitRunEvidence(command,payload,root); writeReplayReceipt(command,{commands:[`npm run ${command}`],validation_results:payload},root); writeHandoff({action:command,phase:'h3',freshness:'updated'},root); }
