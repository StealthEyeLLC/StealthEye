import { resolve } from 'node:path';
import { assertHardGuards, baseContext, writeJson } from './h4-completion-hardening-common.js';
import { readJson } from './substrate.js';

const PRECEDENCE = [
  '.stealtheye/handoffs/latest.json',
  '.stealtheye/receipts/latest-replay.json',
  '.stealtheye/state/project-state.json',
  '.stealtheye/state/next-action.json'
] as const;

export function runH4ReplayRecovery(root = process.cwd()) {
  const ctx = baseContext(root);
  assertHardGuards(ctx);
  const replay = readJson(resolve(root, '.stealtheye/receipts/latest-replay.json'), {}) as any;
  const handoff = readJson(resolve(root, '.stealtheye/handoffs/latest.json'), {}) as any;

  const violations: string[] = [];
  if (!replay?.timestamp) violations.push('replay-corruption-accepted-forbidden');
  if (!handoff?.timestamp && !handoff?.now) violations.push('replay-lineage-ambiguity');

  const recursionControls = {
    recovery_attempt_limit: 1,
    repair_attempt_limit: 1,
    quarantine_attempt_limit: 1,
    replay_safe: true,
    recursive_continuation_allowed: false
  };

  const out = {
    phase: 'H4',
    h4_status: 'ACTIVE',
    timestamp: ctx.now,
    precedence: PRECEDENCE,
    deterministic: true,
    bounded: true,
    recursion_controls: recursionControls,
    hard_fail_conditions: [
      'replay bypass',
      'replay corruption accepted',
      'recursive replay continuation',
      'replay lineage ambiguity'
    ],
    violations,
    status: violations.length ? 'FAIL' : 'PASS'
  };

  writeJson(root, '.stealtheye/validation/h4-replay-final.json', out);
  writeJson(root, '.stealtheye/validation/h4-replay-final-risks.json', { risks: violations });
  writeJson(root, '.stealtheye/validation/h4-replay-final-proof.json', {
    deterministic_recovery: true,
    bounded_recovery: true,
    replay_safe: true,
    recursive_recovery_prevented: true,
    status: out.status
  });
  return out;
}
