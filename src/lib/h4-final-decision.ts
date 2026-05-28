import { resolve } from 'node:path';
import { assertHardGuards, baseContext, writeJson } from './h4-completion-hardening-common.js';
import { readJson } from './substrate.js';

export function runH4FinalDecision(root = process.cwd()) {
  const ctx = baseContext(root); assertHardGuards(ctx);
  const law = readJson(resolve(root, '.stealtheye/validation/h4-completion-law-decision.json'), {}) as any;
  const decision = law.decision === 'AUTHORIZE_H4_COMPLETE' ? 'COMPLETE' : 'KEEP_H4_ACTIVE';
  const blockers = law.failed_requirements ?? [];
  writeJson(root, '.stealtheye/state/h4-final-decision.json', { decision, timestamp: ctx.now });
  writeJson(root, '.stealtheye/state/h4-final-decision-rationale.json', { rationale: decision === 'SAFE_TO_COMPLETE_H4' ? 'all hard blockers resolved' : 'unsafe blocker(s) remain' });
  writeJson(root, '.stealtheye/state/h4-final-decision-blockers.json', { blockers });
  writeJson(root, '.stealtheye/state/h4-final-decision-next-actions.json', { next_actions: decision === 'COMPLETE' ? ['prepare-h4-complete-updates'] : ['resolve-blockers', 'rerun-final-proof-chain'] });
  return { decision, blockers };
}
