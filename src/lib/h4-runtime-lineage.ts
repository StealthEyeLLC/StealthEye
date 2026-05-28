import { assertHardGuards, baseContext, writeJson } from './h4-completion-hardening-common.js';

export function runH4RuntimeLineage(root = process.cwd()) {
  const ctx = baseContext(root);
  assertHardGuards(ctx);
  const lineage = {
    phase: 'H4',
    timestamp: ctx.now,
    canonical_owner: 'handoff.latest',
    canonical_replay_timestamp: ctx.replay?.timestamp ?? null,
    canonical_next_action: ctx.next?.next_action ?? null,
    deterministic: true,
    bounded: true,
    status: ctx.replay?.timestamp ? 'PASS' : 'FAIL'
  };
  writeJson(root, '.stealtheye/state/runtime-lineage.json', lineage);
  return lineage;
}
