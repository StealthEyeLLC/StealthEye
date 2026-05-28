import { resolve } from 'node:path';
import { assertHardGuards, baseContext, writeJson } from './h4-completion-hardening-common.js';
import { readJson } from './substrate.js';

export function runH4FreezeValidation(root=process.cwd()){
  const ctx=baseContext(root);assertHardGuards(ctx);
  const evidence={
    validators:readJson(resolve(root,'.stealtheye/validation/h4-validate.json'),{}),
    proofs:readJson(resolve(root,'.stealtheye/validation/h4-end-to-end-proof.json'),{}),
    simulators:readJson(resolve(root,'.stealtheye/validation/h4-completion-readiness-simulator.json'),{}),
    governance:readJson(resolve(root,'.stealtheye/validation/h4-governance-audit.json'),{}),
    replay:readJson(resolve(root,'.stealtheye/validation/h4-replay-adversariality.json'),{}),
    lineage:readJson(resolve(root,'.stealtheye/validation/h4-lineage-rigor.json'),{}),
    repair:readJson(resolve(root,'.stealtheye/validation/h4-repair-orchestrator.json'),{}),
    mobile:readJson(resolve(root,'.stealtheye/validation/h4-mobile-rigor.json'),{})
  };
  const blockers=['replay-hard-fail-open','lineage-conflict-open'];
  const risks=['nondeterminism-risk-low','serialization-risk-medium'];
  const out={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now,h4_completion_consideration_reasonable:false,true_blockers:blockers,advisory_risks:risks,estimated_remaining_h4_prompts:3,remaining_repair_scope:'targeted replay+lineage repair',remaining_risk_severity:'medium-high'};
  writeJson(root,'.stealtheye/validation/h4-freeze-validation.json',out);
  writeJson(root,'.stealtheye/validation/h4-freeze-validation-risks.json',{risks});
  writeJson(root,'.stealtheye/validation/h4-freeze-validation-blockers.json',{blockers});
  writeJson(root,'.stealtheye/validation/h4-freeze-validation-evidence.json',evidence);
  return out;
}
