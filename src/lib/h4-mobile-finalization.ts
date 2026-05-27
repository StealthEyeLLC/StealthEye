import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { baseContext, assertHardGuards, writeJson } from './h4-completion-hardening-common.js';

export function runH4MobileFinalization(root = process.cwd()) {
  const ctx = baseContext(root);
  assertHardGuards(ctx);

  const runtime = 'H4 ACTIVE | branch=h4/autonomy-continuity-fresh-tab-runtime | pr=OPEN | next=run h4:end-to-end-proof then h4:gap-reducer | blockers=end-to-end-burnin,serialization-stability | approval=NO secrets/billing/prod-delete | completion=not-ready';
  const emergency = 'EMERGENCY: quarantine runtime, run h4:runtime-quarantine -> h4:quarantine-restoration-proof -> h4:replay-recovery, keep H4 ACTIVE, do not mark COMPLETE.';

  if (runtime.length > 500 || emergency.length > 500) throw new Error('oversized-mobile-output');

  const out = {
    phase: 'H4',
    h4_status: 'ACTIVE',
    timestamp: ctx.now,
    ultra_compact: true,
    next_action: 'run h4:end-to-end-proof then h4:gap-reducer',
    branch: 'h4/autonomy-continuity-fresh-tab-runtime',
    pr_posture: 'open',
    approval_boundary: 'explicit',
    blockers: ['end-to-end-burnin', 'serialization-stability'],
    completion_readiness_posture: 'not-ready'
  };

  mkdirSync(resolve(root, '.stealtheye/handoffs'), { recursive: true });

  writeFileSync(resolve(root, '.stealtheye/handoffs/mobile-final-runtime.md'), runtime + '\n');
  writeFileSync(resolve(root, '.stealtheye/handoffs/mobile-final-emergency.md'), emergency + '\n');

  writeJson(root, '.stealtheye/state/mobile-finalization.json', out);
  writeJson(root, '.stealtheye/validation/h4-mobile-finalization.json', out);

  return out;
}
