import { resolve } from 'node:path';
import { baseContext, assertHardGuards, writeJson } from './h4-completion-hardening-common.js';
import { readJson } from './substrate.js';

export function runH4CompletionGates(root = process.cwd()) {
  const ctx = baseContext(root);
  assertHardGuards(ctx);

  const statuses = {
    fresh_tab_recovery: readJson(resolve(root, '.stealtheye/validation/h4-fresh-tab-acceptance.json'), {}) as any,
    zero_memory_recovery: readJson(resolve(root, '.stealtheye/validation/h4-no-memory-recovery-proof.json'), {}) as any,
    replay_recovery: readJson(resolve(root, '.stealtheye/validation/h4-replay-final.json'), {}) as any,
    lineage_rigor: readJson(resolve(root, '.stealtheye/validation/h4-lineage-final.json'), {}) as any,
    serialization: readJson(resolve(root, '.stealtheye/validation/h4-serialization-final.json'), {}) as any,
    governance_bounded: readJson(resolve(root, '.stealtheye/validation/h4-governance-audit.json'), {}) as any,
    mobile_handoff: readJson(resolve(root, '.stealtheye/validation/h4-mobile-acceptance.json'), {}) as any,
    no_product_feature_drift: readJson(resolve(root, '.stealtheye/validation/h4-autonomy-containment.json'), {}) as any,
    h0_h3_closed: readJson(resolve(root, '.stealtheye/state/fresh-tab-bootstrap.json'), {}) as any
  };

  const gates = [
    { key: 'fresh-tab recovery PASS', pass: statuses.fresh_tab_recovery?.can_fresh_runtime_continue_safely === true },
    { key: 'zero-memory recovery PASS', pass: statuses.zero_memory_recovery?.recovery_status === 'pass' },
    { key: 'replay recovery PASS', pass: statuses.replay_recovery?.status === 'PASS' },
    { key: 'lineage rigor PASS', pass: statuses.lineage_rigor?.status === 'PASS' },
    { key: 'serialization PASS', pass: statuses.serialization?.status === 'PASS' },
    { key: 'governance bounded PASS', pass: statuses.governance_bounded?.audit_status === 'pass' },
    { key: 'mobile handoff PASS', pass: statuses.mobile_handoff?.mobile_acceptance_status === 'pass' },
    { key: 'no product-feature drift PASS', pass: statuses.no_product_feature_drift?.status === 'PASS' },
    { key: 'H0-H3 closed PASS', pass: statuses.h0_h3_closed?.current_phase === 'H3_COMPLETE__H4_NOT_STARTED' }
  ];

  const failed = gates.filter((g) => !g.pass).map((g) => g.key);
  const gate_status = failed.length === 0 ? 'PASS' : 'FAIL';
  const result: any = {
    phase: 'H4',
    h4_status: gate_status === 'PASS' ? 'COMPLETE' : 'ACTIVE',
    timestamp: ctx.now,
    gate_status,
    canonical_gate: 'h4-autonomy-continuity-fresh-tab-runtime',
    gates_passed: gates.filter((g) => g.pass).map((g) => g.key),
    gates_failed: failed,
    remaining_blockers: failed,
    safe_to_consider_completion: gate_status === 'PASS'
  };

  for (const n of ['h4-completion-gates.json', 'h4-completion-gate-evidence.json', 'h4-completion-gate-blockers.json', 'h4-completion-gate-confidence.json']) {
    writeJson(root, `.stealtheye/validation/${n}`, result);
  }
  return result;
}
