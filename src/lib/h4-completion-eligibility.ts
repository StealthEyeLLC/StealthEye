import { resolve } from 'node:path';
import { assertHardGuards, baseContext, writeJson } from './h4-completion-hardening-common.js';
import { readJson } from './substrate.js';

const SIGNALS = [
  ['replay', '.stealtheye/validation/h4-replay-final.json'],
  ['lineage', '.stealtheye/validation/h4-lineage-final.json'],
  ['serialization', '.stealtheye/validation/h4-serialization-final.json'],
  ['governance', '.stealtheye/validation/h4-governance-audit.json'],
  ['mobile', '.stealtheye/validation/h4-mobile-rigor.json'],
  ['continuity', '.stealtheye/validation/h4-continuity-stress.json'],
  ['freeze', '.stealtheye/validation/h4-freeze-authority-proof.json'],
  ['approval_boundary', '.stealtheye/validation/h4-completion-law-authority.json']
] as const;

export function runH4CompletionEligibility(root = process.cwd()) {
  const ctx = baseContext(root); assertHardGuards(ctx);
  const evidence = SIGNALS.map(([k, p]) => ({ key: k, payload: readJson(resolve(root, p), {}) as any }));
  const blockers = evidence.filter((x) => x.payload?.status && x.payload.status !== 'PASS').map((x) => `${x.key}-not-pass`);
  const risks = evidence.filter((x) => Object.keys(x.payload ?? {}).length === 0).map((x) => `${x.key}-evidence-missing`);
  const completion_consideration_safe = blockers.length === 0 && risks.length === 0;
  const decision = completion_consideration_safe ? 'ELIGIBLE_FOR_COMPLETION_REVIEW' : 'KEEP_ACTIVE_UNTIL_RIGOR_COMPLETE';
  const out = { phase: 'H4', timestamp: ctx.now, decision, completion_consideration_safe, active_continuation_safer: !completion_consideration_safe, blockers, risks, status: completion_consideration_safe ? 'PASS' : 'FAIL' };
  writeJson(root, '.stealtheye/validation/h4-completion-eligibility.json', out);
  writeJson(root, '.stealtheye/validation/h4-completion-eligibility-risks.json', { risks });
  writeJson(root, '.stealtheye/validation/h4-completion-eligibility-blockers.json', { blockers });
  writeJson(root, '.stealtheye/state/h4-completion-eligibility-state.json', { decision: out.decision, safe: out.completion_consideration_safe, timestamp: ctx.now });
  return out;
}
