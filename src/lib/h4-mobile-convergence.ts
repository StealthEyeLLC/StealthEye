import { resolve } from 'node:path';
import { assertHardGuards, baseContext, writeJson } from './h4-completion-hardening-common.js';
import { readJson } from './substrate.js';

export function runH4MobileConvergence(root = process.cwd()) {
  const ctx = baseContext(root); assertHardGuards(ctx);
  const finalDecision = readJson(resolve(root, '.stealtheye/state/h4-final-decision.json'), {}) as any;
  const hasNextAction = Boolean(ctx.next?.next_action || ctx.next?.next_actions?.length);
  const blockers: string[] = [];
  if (!hasNextAction) blockers.push('unclear-next-action');
  if (!finalDecision?.decision) blockers.push('unclear-completion-posture');
  const out = { phase: 'H4', timestamp: ctx.now, exact_posture: { branch: 'h4/autonomy-continuity-fresh-tab-runtime', h4: 'ACTIVE', decision: finalDecision?.decision ?? null, approval_boundary: 'no-secrets-no-billing-no-destructive-prod-delete' }, blockers, risks: blockers.map((b)=>`${b}-risk`), status: blockers.length ? 'FAIL' : 'PASS' };
  writeJson(root, '.stealtheye/validation/h4-mobile-convergence.json', out);
  writeJson(root, '.stealtheye/validation/h4-mobile-convergence-risks.json', { risks: out.risks });
  writeJson(root, '.stealtheye/state/h4-mobile-convergence-state.json', { status: out.status, timestamp: ctx.now });
  return out;
}
