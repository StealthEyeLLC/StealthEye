import { assertHardGuards, baseContext, writeJson } from './h4-completion-hardening-common.js';

export function runH4ContinuityArbitration(root = process.cwd()) {
  const ctx = baseContext(root);
  assertHardGuards(ctx);

  const conflicts: string[] = [];
  if (!ctx.replay?.timestamp) conflicts.push('replay-lineage-missing');
  if (!ctx.handoff?.timestamp && !ctx.handoff?.now) conflicts.push('handoff-lineage-missing');

  const out = {
    phase: 'H4',
    timestamp: ctx.now,
    h4_status: 'ACTIVE',
    canonical_precedence: [
      '.stealtheye/handoffs/latest.json',
      '.stealtheye/receipts/latest-replay.json',
      '.stealtheye/state/project-state.json',
      '.stealtheye/state/next-action.json'
    ],
    deterministic: true,
    bounded: true,
    unresolved_conflicts: conflicts,
    status: conflicts.length ? 'FAIL' : 'PASS'
  };

  writeJson(root, '.stealtheye/state/continuity-arbitration.json', out);
  return out;
}
