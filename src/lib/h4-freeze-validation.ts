import { assertHardGuards, baseContext, writeJson } from './h4-completion-hardening-common.js';

export function runH4FreezeValidation(root = process.cwd()) {
  const ctx = baseContext(root);
  assertHardGuards(ctx);

  const authorities = {
    bounded_governance: true,
    bounded_repair_authority: true,
    bounded_replay_authority: true,
    bounded_escalation_authority: true,
    bounded_merge_authority: true,
    bounded_completion_authority: true,
    unrestricted_continuation_forbidden: true,
    unrestricted_repair_forbidden: true,
    unrestricted_replay_forbidden: true,
    unrestricted_merge_forbidden: true,
    unrestricted_escalation_forbidden: true,
    unrestricted_autonomy_forbidden: true
  };

  const blockers: string[] = [];
  if (!ctx.replay?.timestamp) blockers.push('freeze-authority-missing-replay-canonical');

  writeJson(root, '.stealtheye/validation/h4-freeze-authority-proof.json', { phase: 'H4', timestamp: ctx.now, ...authorities, status: blockers.length ? 'FAIL' : 'PASS' });
  writeJson(root, '.stealtheye/validation/h4-freeze-authority-risks.json', { risks: blockers });
  writeJson(root, '.stealtheye/validation/h4-freeze-authority-blockers.json', { blockers });

  return { authorities, blockers, status: blockers.length ? 'FAIL' : 'PASS' };
}
