import { resolve } from 'node:path';
import { runH4FinalEndToEndProof } from '../lib/h4-final-end-to-end-proof.js';
import { readJson } from '../lib/substrate.js';
import { writeJson } from '../lib/h4-completion-hardening-common.js';

const proof = runH4FinalEndToEndProof();
const root = process.cwd();
const approvalBoundaries = readJson(resolve(root, '.stealtheye/validation/h4-completion-law-authority.json'), {}) as any;
const out = {
  phase: 'H4',
  timestamp: new Date().toISOString(),
  can_h4_complete_safely: proof.can_h4_safely_complete,
  blockers: proof.blockers,
  risks: proof.risks,
  approval_boundaries: approvalBoundaries,
  next_prompt_if_active: proof.can_h4_safely_complete ? null : 'resolve-listed-blockers-and-rerun-h4-final-chain',
  status: proof.status
};
writeJson(root, '.stealtheye/validation/h4-final-completion-readiness.json', out);
writeJson(root, '.stealtheye/validation/h4-final-completion-readiness-risks.json', { risks: out.risks });
writeJson(root, '.stealtheye/validation/h4-final-completion-readiness-blockers.json', { blockers: out.blockers });
writeJson(root, '.stealtheye/validation/h4-final-completion-readiness-evidence.json', { evidence: ['h4-final-end-to-end-proof', 'h4-completion-law-authority'] });
console.log(JSON.stringify(out, null, 2));
