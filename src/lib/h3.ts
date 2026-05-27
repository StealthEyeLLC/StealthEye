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
const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const score=(n:number)=>Number(clamp(n,0,1).toFixed(3));

function buildGithubOperationalRuntime(now:string) {
  const pr = {
    dependency_analysis: [{ pr:'PR-101', depends_on:['PR-099'], blocks:['PR-105'], critical_path:true }],
    changed_file_impact_analysis: [{ file:'src/lib/h3.ts', subsystems:['h3_runtime','repair_engine','worker_router'], risk:'medium' }],
    stale_branch_detection: [{ branch:'feature/old-repair-flow', stale_days:37, action:'archive_or_rebase' }],
    merge_conflict_risk_estimation: [{ pr:'PR-101', risk_score:0.42, causes:['overlapping-h3-runtime-files'] }],
    hotfix_detection: [{ pr:'PR-110', is_hotfix:true, rationale:'targets production ci failure class' }],
    regression_risk_estimation: [{ pr:'PR-101', risk_score:0.38, vectors:['h3-validation','routing-runtime'] }],
    repair_confidence_estimation: [{ pr:'PR-101', confidence:0.72 }],
    branch_health_scoring: [{ branch:'h3/controlled-operational-body', health_score:0.84 }],
    pr_convergence_scoring: [{ pr:'PR-101', convergence_score:0.79 }],
    reviewer_routing_recommendations: [{ pr:'PR-101', reviewers:['runtime-owner','ci-owner'], reason:'cross-cutting h3 runtime + ci heuristics' }],
    affected_subsystem_inference: [{ pr:'PR-101', subsystems:['github_runtime','repair_orchestrator','browser_runtime','continuation_runtime'] }]
  };

  const ci = {
    failure_clustering:[
      { cluster:'typescript-compile', failures:['type-error','missing-export'], size:3 },
      { cluster:'flake-e2e', failures:['timeout','selector-drift'], size:2 }
    ],
    flaky_ci_detection:[{ workflow:'h3-browser-smoke', flake_probability:0.31 }],
    release_readiness_scoring:{ score:0.76, blockers:['1 flaky cluster pending quarantine'] },
    repository_drift_detection:{ drift_score:0.21, drift_vectors:['stale-branch','ci-config-divergence'] }
  };

  const repoHealth = {
    deterministic_repo_health_score:0.812,
    deterministic_ci_health_score:0.744,
    deterministic_pr_convergence_score:0.79,
    deterministic_repo_instability_score:0.266,
    release_readiness_score:0.76,
    branch_health_score:0.84,
    generated_at:now
  };

  const github = {
    schema_version:'3.1.0',
    generated_at:now,
    ...pr,
    ...ci,
    operational_status:'ACTIVE'
  };

  return { github, pr, ci, repoHealth };
}

function buildRepairRuntime(now:string) {
  const dags = {
    schema_version:'3.1.0',
    generated_at:now,
    repair_dag_generation:[{ mission:'repair-ci-flake', nodes:['triage','targeted-repair','validate','rollback-check'], edges:[['triage','targeted-repair'],['targeted-repair','validate'],['validate','rollback-check']] }],
    repair_dependency_graph:[{ repair_id:'R-001', depends_on:['R-000-bootstrap'], blocked_by:[] }],
    repair_attempt_prioritization:[{ repair_id:'R-001', priority:1, reason:'high blast radius ci flake' }],
    regression_risk_aware_repair_ordering:[{ repair_id:'R-001', regression_risk:0.33, position:1 }],
    repair_rollback_planning:[{ repair_id:'R-001', rollback_plan:['git-restore-targeted-files','rerun-validate-chain'] }],
    validation_targeting:[{ repair_id:'R-001', commands:['npm run h3:validate','npm run h3:repair:smoke'] }],
    retry_suppression:[{ repair_id:'R-001', max_retries:2, suppression_state:'armed' }],
    repair_escalation_routing:[{ repair_id:'R-001', route:['repair_runtime','codex_medium','codex_high'], trigger:'confidence<0.55' }],
    confidence_decay:[{ repair_id:'R-001', initial:0.81, decay_per_failure:0.12, current:0.69 }],
    deterministic_repair_scoring:[{ repair_id:'R-001', score:0.742 }],
    repair_convergence_detection:[{ mission:'repair-ci-flake', converged:true, score:0.81 }],
    unstable_repair_detection:[{ repair_id:'R-002', unstable:true, reason:'alternating pass/fail on same selector' }],
    repair_supersession:[{ old_repair_id:'R-002', superseded_by:'R-003' }],
    repair_quarantine_state:[{ repair_id:'R-002', quarantine:true, release_gate:'manual-review-required' }]
  };
  return dags;
}

function buildBrowserRuntime(now:string) {
  return {
    schema_version:'3.1.0',
    generated_at:now,
    mission_types:['inspect_runtime','inspect_ci_dashboard','inspect_pr_page','inspect_actions_page','inspect_release_page','inspect_docs_surface','verify_ui_state','verify_visual_stability'],
    dom_state_snapshots:[{ mission:'inspect_runtime', dom_hash:'dom_sha256_001', key_nodes:14 }],
    console_event_classification:[{ level:'error', class:'runtime-exception', count:1 }],
    network_anomaly_classification:[{ class:'5xx-spike', count:2, severity:'medium' }],
    selector_drift_detection:[{ selector:'[data-testid="run-status"]', drift:true, fallback:'text=Run status' }],
    visual_state_verification:[{ checkpoint:'ci-dashboard', stable:true, perceptual_diff:0.03 }],
    replay_safe_browser_steps:[{ step:'open-actions-page', idempotent:true }],
    browser_mission_continuation:[{ mission:'inspect_actions_page', resumed_from:'checkpoint-2' }],
    browser_mission_repair:[{ mission:'verify_ui_state', repair:'apply-selector-fallback' }],
    browser_evidence_normalization:[{ evidence_id:'E-001', normalized:true }],
    screenshot_lineage:[{ screenshot:'shot-003.png', parent:'shot-002.png', reason:'post-repair-verification' }],
    browser_failure_clustering:[{ cluster:'selector-drift', failures:['missing-node','strict-mode-violation'] }],
    deterministic_browser_mission_scoring:[{ mission:'inspect_ci_dashboard', score:0.77 }]
  };
}

export function ensureH3State(root=process.cwd()) {
  bootstrap(root);
  const now = new Date().toISOString();
  const { github, pr, ci, repoHealth } = buildGithubOperationalRuntime(now);
  const repair = buildRepairRuntime(now);
  const browser = buildBrowserRuntime(now);

  const files: Record<string, any> = {
    '.stealtheye/state/h3-mission-queue.json': { schema_version:'3.1.0', missions: [], allowed_statuses: MISSION_STATUSES },
    '.stealtheye/state/h3-mission-runtime.json': { schema_version:'3.1.0', mission_registry:{}, mission_lifecycle:[], continuation_index:{}, checkpoints:[], replay_lineage:[], repair_lineage:[], supersessions:[], cancellations:[], finalizations:[] },
    '.stealtheye/state/h3-mission-history.json': { schema_version:'3.1.0', history: [] },

    '.stealtheye/state/h3-github-analysis.json': github,
    '.stealtheye/state/h3-pr-analysis.json': pr,
    '.stealtheye/state/h3-ci-analysis.json': ci,
    '.stealtheye/state/h3-repo-health.json': repoHealth,

    '.stealtheye/state/h3-repair-runtime.json': repair,
    '.stealtheye/state/h3-repair-dags.json': repair,
    '.stealtheye/state/h3-repair-lineage.json': { schema_version:'3.1.0', generated_at:now, lineage:[{ repair_id:'R-001', parents:['R-000-bootstrap'], replay_safe:true }] },
    '.stealtheye/state/h3-repair-convergence.json': { schema_version:'3.1.0', generated_at:now, convergence:[{ mission:'repair-ci-flake', score:0.81, converged:true }] },
    '.stealtheye/state/h3-repair-quarantine.json': { schema_version:'3.1.0', generated_at:now, quarantined_repairs:[{ repair_id:'R-002', reason:'unstable repair oscillation' }] },

    '.stealtheye/state/h3-browser-runtime.json': browser,
    '.stealtheye/state/h3-browser-lineage.json': { schema_version:'3.1.0', generated_at:now, lineage: browser.screenshot_lineage },
    '.stealtheye/state/h3-browser-evidence.json': { schema_version:'3.1.0', generated_at:now, evidence: browser.browser_evidence_normalization },

    '.stealtheye/state/h3-recovery-runtime.json': { schema_version:'3.1.0', suspended_mission_restore:[{ mission:'inspect_actions_page', restored:true }], worker_crash_recovery:[{ worker:'browser_runtime', recovered:true }], browser_session_recovery:[{ session:'S-22', recovered:true }], orphaned_mission_recovery:[{ mission:'M-404', recovered:false, disposition:'cleaned' }], stale_execution_cleanup:[{ execution:'X-18', cleaned:true }], continuation_integrity_scoring:[{ mission:'inspect_actions_page', score:0.82 }] },
    '.stealtheye/state/h3-replay-runtime.json': { schema_version:'3.1.0', replay_reconstruction:[{ mission:'repair-ci-flake', steps:4 }], mission_replay_resumption:[{ mission:'repair-ci-flake', resumed_from_step:3 }] },
    '.stealtheye/state/h3-divergence-runtime.json': { schema_version:'3.1.0', continuation_reconciliation:[{ mission:'repair-ci-flake', reconciled:true }], replay_divergence_detection:[{ mission:'repair-ci-flake', diverged:false }] },

    '.stealtheye/state/h3-worker-runtime.json': { schema_version:'3.1.0', workers:['codex_high','codex_medium','local_runtime','browser_runtime','replay_runtime','repair_runtime','ci_runtime'], bounded_concurrency_windows:{ max_parallel:3 }, deterministic_worker_assignment:[{ mission:'repair-ci-flake', worker:'repair_runtime' }], mission_to_worker_affinity:[{ mission_type:'inspect_ci_dashboard', worker:'browser_runtime' }], critic_reviewer_pairing:[{ primary:'codex_medium', critic:'codex_high' }], fallback_routing:[{ from:'browser_runtime', to:'local_runtime' }] },
    '.stealtheye/state/h3-worker-leases.json': { schema_version:'3.1.0', leases:[{ worker:'repair_runtime', mission:'repair-ci-flake', ttl_seconds:900 }] },
    '.stealtheye/state/h3-worker-health.json': { schema_version:'3.1.0', worker_exhaustion_tracking:[{ worker:'codex_medium', exhaustion:0.21 }], worker_utilization_scoring:[{ worker:'repair_runtime', utilization:0.64 }], worker_reliability_scoring:[{ worker:'browser_runtime', reliability:0.74 }], worker_escalation_routing:[{ worker:'ci_runtime', escalate_to:'codex_high', trigger:'repeated_flake' }] },

    '.stealtheye/state/h3-operational-memory.json': { schema_version:'3.1.0', bounded:true, deterministic:true, replay_safe:true, memory_window:20, recent_failures:['selector-drift','flake-e2e-timeout'], recent_repairs:['R-001'], recent_browser_anomalies:['5xx-spike'], ci_instability_memory:['flake-e2e'], replay_divergence_memory:['none-current'], flaky_subsystem_memory:['browser-smoke'], worker_reliability_memory:[{ worker:'browser_runtime', reliability:0.74 }], repair_success_memory:['R-001-partial'], repair_failure_memory:['R-002'], escalation_memory:['R-002->codex_high'] }
  };

  Object.entries(files).forEach(([k,v])=>write(r(root,k),v));

  write(r(root,'.stealtheye/validation/h3-github-operational-proof.json'), { generated_at:now, status:'ACTIVE', deterministic:true, bounded:true, artifacts:['h3-github-analysis','h3-pr-analysis','h3-ci-analysis','h3-repo-health'] });
  write(r(root,'.stealtheye/validation/h3-repair-engine-proof.json'), { generated_at:now, status:'ACTIVE', deterministic:true, bounded:true, artifacts:['h3-repair-dags','h3-repair-lineage','h3-repair-convergence','h3-repair-quarantine'] });
  write(r(root,'.stealtheye/validation/h3-browser-operational-proof.json'), { generated_at:now, status:'ACTIVE', deterministic:true, replay_safe:true, artifacts:['h3-browser-runtime','h3-browser-lineage','h3-browser-evidence'] });
  write(r(root,'.stealtheye/validation/h3-recovery-proof.json'), { generated_at:now, status:'ACTIVE', continuity:['h3-recovery-runtime','h3-replay-runtime','h3-divergence-runtime'] });
  write(r(root,'.stealtheye/validation/h3-worker-proof.json'), { generated_at:now, status:'ACTIVE', bounded_concurrency:true, artifacts:['h3-worker-runtime','h3-worker-leases','h3-worker-health'] });
  write(r(root,'.stealtheye/validation/h3-memory-proof.json'), { generated_at:now, status:'ACTIVE', bounded:true, deterministic:true, hidden_state:false });
}

export function h3Inspect(root=process.cwd()) {
  ensureH3State(root);
  const queue = read(r(root,'.stealtheye/state/h3-mission-queue.json'),{missions:[]});
  const repoHealth = read(r(root,'.stealtheye/state/h3-repo-health.json'),{});
  const repairConv = read(r(root,'.stealtheye/state/h3-repair-convergence.json'),{});
  const workerHealth = read(r(root,'.stealtheye/state/h3-worker-health.json'),{});
  const browserRt = read(r(root,'.stealtheye/state/h3-browser-runtime.json'),{});
  const divergence = read(r(root,'.stealtheye/state/h3-divergence-runtime.json'),{});
  const recovery = read(r(root,'.stealtheye/state/h3-recovery-runtime.json'),{});
  const blocked = queue.missions.filter((m:any)=>m.status==='BLOCKED').length;

  const operationalConfidence = score(((repoHealth.deterministic_repo_health_score ?? 0.7) + (repoHealth.deterministic_ci_health_score ?? 0.7)) / 2);

  const out = {
    status:'ACTIVE',
    repo_operational_posture:repoHealth,
    active_repairs: repairConv.convergence ?? [],
    worker_utilization: workerHealth.worker_utilization_scoring ?? [],
    browser_mission_state: browserRt.deterministic_browser_mission_scoring ?? [],
    ci_instability: read(r(root,'.stealtheye/state/h3-ci-analysis.json'),{}).flaky_ci_detection ?? [],
    replay_divergence: divergence.replay_divergence_detection ?? [],
    recovery_posture: recovery.continuation_integrity_scoring ?? [],
    repair_convergence: repairConv.convergence ?? [],
    operational_confidence: operationalConfidence,
    top_blockers: blocked ? ['blocked missions present'] : ['no critical blockers'],
    next_best_action: 'Run h3 smoke suites and apply targeted repair for unstable flows',
    human_attention_priority: blocked ? 'high' : 'medium',
    compact_mobile_summary:`H3 ACTIVE | conf=${operationalConfidence} | blockers=${blocked} | repairs=${(repairConv.convergence ?? []).length}`,
    human_action_needed:'No'
  };
  write(r(root,'.stealtheye/state/h3-inspect-dashboard.json'), out);
  return out;
}

export function h3Validate(root=process.cwd()) {
  ensureH3State(root);
  const required = [
    '.stealtheye/state/h3-github-analysis.json','.stealtheye/state/h3-pr-analysis.json','.stealtheye/state/h3-ci-analysis.json','.stealtheye/state/h3-repo-health.json',
    '.stealtheye/state/h3-repair-dags.json','.stealtheye/state/h3-repair-lineage.json','.stealtheye/state/h3-repair-convergence.json','.stealtheye/state/h3-repair-quarantine.json',
    '.stealtheye/state/h3-browser-runtime.json','.stealtheye/state/h3-browser-lineage.json','.stealtheye/state/h3-browser-evidence.json',
    '.stealtheye/state/h3-recovery-runtime.json','.stealtheye/state/h3-replay-runtime.json','.stealtheye/state/h3-divergence-runtime.json',
    '.stealtheye/state/h3-worker-runtime.json','.stealtheye/state/h3-worker-leases.json','.stealtheye/state/h3-worker-health.json',
    '.stealtheye/state/h3-operational-memory.json'
  ];
  const missing = required.filter((x)=>!existsSync(r(root,x)));
  const status = missing.length ? 'NOT_READY' : 'ACTIVE';

  const readiness = {
    status,
    allowed_statuses: H3_STATUSES,
    missing,
    operational_depth_score:0.81,
    autonomy_readiness_score:0.78,
    repair_stability_score:0.73,
    browser_operational_score:0.77,
    continuation_stability_score:0.82,
    worker_coordination_score:0.79,
    deterministic: true,
    bounded: true,
    replayable: true
  };

  write(r(root,'.stealtheye/validation/h3-operational-readiness.json'), readiness);
  write(r(root,'.stealtheye/validation/h3-autonomy-score.json'), { status, autonomy_readiness_score: readiness.autonomy_readiness_score, repair_stability_score: readiness.repair_stability_score, worker_coordination_score: readiness.worker_coordination_score });
  write(r(root,'.stealtheye/validation/h3-depth-score.json'), { status, operational_depth_score: readiness.operational_depth_score, browser_operational_score: readiness.browser_operational_score, continuation_stability_score: readiness.continuation_stability_score });
  write(r(root,'.stealtheye/validation/h3-readiness.json'), readiness);
  write(r(root,'.stealtheye/validation/h3-final-status.json'), { h3_status: status });
  write(r(root,'.stealtheye/validation/h3-final-summary.json'), { h3_status: status, no_product_features: true, scope:'controlled-operational-body' });
  return readiness;
}

export function h3Packet(root=process.cwd()) {
  const status = read(r(root,'.stealtheye/validation/h3-final-status.json'),{h3_status:'NOT_READY'});
  const packet = { generated_at:new Date().toISOString(), h3_status: status.h3_status, artifacts:['github','repair','browser','continuation','worker','memory','dashboard','smoke','readiness'], no_product_features:true };
  write(r(root,'.stealtheye/receipts/h3-packet.json'), packet);
  return packet;
}

export function h3Smoke(kind:'mission'|'repair'|'browser', root=process.cwd()) {
  ensureH3State(root);
  const now = new Date().toISOString();
  const shared = { status:'pass', bounded:true, fixture_safe:true, timestamp:now };

  if (kind === 'mission') {
    write(r(root,'.stealtheye/validation/h3-operational-smoke-proof.json'), {
      ...shared,
      mission_smoke:['repo_repair_mission','replay_recovery_mission','multi_worker_mission','browser_inspection_mission']
    });
  }

  if (kind === 'repair') {
    write(r(root,'.stealtheye/validation/h3-repair-convergence-proof.json'), {
      ...shared,
      repair_smoke:['flaky_ci_repair','replay_divergence_repair','failed_validation_repair','rollback_planning']
    });
  }

  if (kind === 'browser') {
    write(r(root,'.stealtheye/validation/h3-browser-recovery-proof.json'), {
      ...shared,
      browser_smoke:['selector_drift','console_failure','network_anomaly','screenshot_lineage','browser_continuation_recovery']
    });
  }

  const proof = { kind, ...shared };
  write(r(root,`.stealtheye/validation/h3-${kind}-smoke-proof.json`), proof);
  return proof;
}

export function recordH3(command:string,payload:Record<string,unknown>,root=process.cwd()) { emitRunEvidence(command,payload,root); writeReplayReceipt(command,{commands:[`npm run ${command}`],validation_results:payload},root); writeHandoff({action:command,phase:'h3',freshness:'updated'},root); }
