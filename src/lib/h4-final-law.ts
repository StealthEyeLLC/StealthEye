import { resolve } from 'node:path';
import { assertHardGuards, baseContext, writeJson } from './h4-completion-hardening-common.js';
import { readJson } from './substrate.js';

export function runH4FinalLaw(root = process.cwd()) {
  const ctx = baseContext(root);
  assertHardGuards(ctx);

  const replay = readJson(resolve(root, '.stealtheye/validation/h4-replay-final.json'), {}) as any;
  const lineage = readJson(resolve(root, '.stealtheye/validation/h4-lineage-final.json'), {}) as any;
  const serialization = readJson(resolve(root, '.stealtheye/validation/h4-serialization-final.json'), {}) as any;
  const freeze = readJson(resolve(root, '.stealtheye/validation/h4-freeze-authority-proof.json'), {}) as any;
  const e2e = readJson(resolve(root, '.stealtheye/validation/h4-final-end-to-end-proof.json'), {}) as any;

  const failed = [
    ['replay', replay?.status !== 'PASS'],
    ['lineage', lineage?.status !== 'PASS'],
    ['serialization', serialization?.status !== 'PASS'],
    ['freeze', freeze?.status !== 'PASS'],
    ['final-end-to-end-proof', e2e?.status !== 'PASS']
  ].filter(([, v]) => v).map(([k]) => k);

  const decision = failed.length === 0 ? 'AUTHORIZE_H4_COMPLETE' : 'FORBID_H4_COMPLETE_KEEP_ACTIVE';
  const status = failed.length === 0 ? 'PASS' : 'FAIL';

  writeJson(root, '.stealtheye/validation/h4-completion-law.json', { phase: 'H4', timestamp: ctx.now, decision, status });
  writeJson(root, '.stealtheye/validation/h4-completion-law-risks.json', { risks: failed.map((x) => `completion-law-failed-${x}`) });
  writeJson(root, '.stealtheye/validation/h4-completion-law-authority.json', { bounded_authority: true, unrestricted_authority_completion_forbidden: true });
  writeJson(root, '.stealtheye/validation/h4-completion-law-decision.json', { decision, failed_requirements: failed });

  return { decision, failed, status };
}
