import { resolve } from 'node:path';
import { assertHardGuards, baseContext, writeJson } from './h4-completion-hardening-common.js';
import { readJson } from './substrate.js';

export function runH4FinalLaw(root = process.cwd()) {
  const ctx = baseContext(root);
  assertHardGuards(ctx);

  const canonical = readJson(resolve(root, '.stealtheye/validation/h4-completion-gates.json'), {}) as any;
  const failed = canonical?.gates_failed ?? [];

  const decision = failed.length === 0 && canonical?.gate_status === 'PASS'
    ? 'AUTHORIZE_H4_COMPLETE'
    : 'FORBID_H4_COMPLETE_KEEP_ACTIVE';
  const status = failed.length === 0 && canonical?.gate_status === 'PASS' ? 'PASS' : 'FAIL';

  writeJson(root, '.stealtheye/validation/h4-completion-law.json', { phase: 'H4', timestamp: ctx.now, decision, status, canonical_gate: 'h4-completion-gates' });
  writeJson(root, '.stealtheye/validation/h4-completion-law-risks.json', { risks: failed.map((x: string) => `completion-law-failed-${x}`) });
  writeJson(root, '.stealtheye/validation/h4-completion-law-authority.json', { bounded_authority: true, unrestricted_authority_completion_forbidden: true });
  writeJson(root, '.stealtheye/validation/h4-completion-law-decision.json', { decision, failed_requirements: failed });

  return { decision, failed, status };
}
