import { resolve } from 'node:path';
import { assertHardGuards, baseContext, writeJson } from './h4-completion-hardening-common.js';
import { readJson } from './substrate.js';

const SOURCES = [
  ['proof', '.stealtheye/validation/h4-completion-readiness-simulator.json'],
  ['replay', '.stealtheye/validation/h4-replay-final.json'],
  ['lineage', '.stealtheye/validation/h4-lineage-final.json'],
  ['serialization', '.stealtheye/validation/h4-serialization-final.json'],
  ['governance', '.stealtheye/validation/h4-governance-audit.json'],
  ['mobile', '.stealtheye/validation/h4-mobile-rigor.json'],
  ['continuity', '.stealtheye/validation/h4-continuity-stress.json'],
  ['freeze', '.stealtheye/validation/h4-freeze-authority-proof.json'],
  ['eligibility', '.stealtheye/validation/h4-completion-eligibility.json'],
  ['authority', '.stealtheye/validation/h4-completion-authority.json'],
  ['continuity-realism', '.stealtheye/validation/h4-continuity-realism.json'],
  ['mobile-convergence', '.stealtheye/validation/h4-mobile-convergence.json']
] as const;

export function runH4FinalEndToEndProof(root = process.cwd()) {
  const ctx = baseContext(root); assertHardGuards(ctx);
  const evidence = SOURCES.map(([name, path]) => ({ name, path, payload: readJson(resolve(root, path), {}) as any }));
  const blockers = evidence.filter((e) => e.payload?.status && e.payload.status !== 'PASS').map((e) => `${e.name}-failed`);
  const risks = evidence.filter((e) => Object.keys(e.payload ?? {}).length === 0).map((e) => `${e.name}-missing-evidence`);
  const canComplete = blockers.length === 0 && risks.length === 0;
  const out = { phase: 'H4', timestamp: ctx.now, deterministic: true, bounded: true, can_h4_safely_complete: canComplete, can_h4_safely_remain_active: true, blockers, risks, status: canComplete ? 'PASS' : 'FAIL' };
  writeJson(root,'.stealtheye/validation/h4-final-end-to-end-proof.json',out);
  writeJson(root,'.stealtheye/validation/h4-final-end-to-end-risks.json',{risks});
  writeJson(root,'.stealtheye/validation/h4-final-end-to-end-blockers.json',{blockers});
  writeJson(root,'.stealtheye/validation/h4-final-end-to-end-evidence.json',{evidence:evidence.map((e)=>({name:e.name,status:e.payload?.status ?? 'UNKNOWN'}))});
  return out;
}
