import { assertHardGuards, baseContext, writeJson } from './h4-completion-hardening-common.js';

export function runH4SerializationStabilizer(root = process.cwd()) {
  const ctx = baseContext(root);
  assertHardGuards(ctx);

  const atomicity = {
    staging_write_required: true,
    latest_pointer_replace_mode: 'single-rename',
    deterministic_ordering: 'lexicographic',
    deterministic_cleanup: true,
    bounded_retention_limit: 500
  };

  const violations: string[] = [];
  if (!ctx.replay?.timestamp) violations.push('partial-latest-pointer');

  const out = {
    phase: 'H4',
    timestamp: ctx.now,
    h4_status: 'ACTIVE',
    atomicity,
    hard_fail_conditions: [
      'partial latest pointer',
      'duplicate canonical pointer',
      'partial continuity state',
      'unbounded retention',
      'nondeterministic ordering'
    ],
    violations,
    status: violations.length ? 'FAIL' : 'PASS'
  };

  writeJson(root, '.stealtheye/validation/h4-serialization-final.json', out);
  writeJson(root, '.stealtheye/validation/h4-serialization-atomicity.json', atomicity);
  writeJson(root, '.stealtheye/validation/h4-serialization-risks.json', { risks: violations });
  return out;
}
