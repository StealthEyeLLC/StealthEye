import { resolve } from 'node:path';
import { assertHardGuards, baseContext, writeJson } from './h4-completion-hardening-common.js';
import { readJson } from './substrate.js';

export function runH4CompletionAuthority(root = process.cwd()) {
  const ctx = baseContext(root); assertHardGuards(ctx);
  const law = readJson(resolve(root, '.stealtheye/validation/h4-completion-law-authority.json'), {}) as any;
  const replay = readJson(resolve(root, '.stealtheye/validation/h4-replay-final.json'), {}) as any;
  const lineage = readJson(resolve(root, '.stealtheye/validation/h4-lineage-final.json'), {}) as any;
  const serialization = readJson(resolve(root, '.stealtheye/validation/h4-serialization-final.json'), {}) as any;
  const mobile = readJson(resolve(root, '.stealtheye/validation/h4-mobile-rigor.json'), {}) as any;
  const blockers: string[] = [];
  if (!law?.bounded_authority) blockers.push('ambiguous-completion-authority');
  if (!law?.unrestricted_authority_completion_forbidden) blockers.push('unrestricted-completion-authority');
  if (replay?.status !== 'PASS') blockers.push('replay-invalid-completion');
  if (lineage?.status !== 'PASS') blockers.push('lineage-invalid-completion');
  if (serialization?.status !== 'PASS') blockers.push('serialization-invalid-completion');
  if (mobile?.status && mobile.status !== 'PASS') blockers.push('mobile-supervision-invalid');
  const out = { phase: 'H4', timestamp: ctx.now, deterministic: true, bounded: true, blockers, risks: blockers.map((b)=>`${b}-risk`), completion_authority_valid: blockers.length === 0, status: blockers.length ? 'FAIL' : 'PASS' };
  writeJson(root, '.stealtheye/validation/h4-completion-authority.json', out);
  writeJson(root, '.stealtheye/validation/h4-completion-authority-risks.json', { risks: out.risks });
  writeJson(root, '.stealtheye/validation/h4-completion-authority-blockers.json', { blockers });
  writeJson(root, '.stealtheye/state/h4-completion-authority-state.json', { valid: out.completion_authority_valid, timestamp: ctx.now });
  return out;
}
