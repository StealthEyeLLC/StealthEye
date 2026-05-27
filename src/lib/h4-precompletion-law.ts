import { baseContext, assertHardGuards, writeJson } from './h4-completion-hardening-common.js';

export function runH4PrecompletionLaw(root=process.cwd()){
  const ctx=baseContext(root);assertHardGuards(ctx);
  const authority={premature_completion_forbidden:true,h4_complete_allowed:false,required_conditions:['freeze-readiness-pass','governance-pass','replay-pass','continuity-pass','mobile-supervision-pass','artifact-stability-pass']};
  const blockers=['freeze-readiness-has-blockers','end-to-end-proof-not-finalized'];
  const risks=['chaos-fixture-depth-advisory'];
  const out={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now,law:'strict-precompletion',authority,completion_conditions:authority.required_conditions,freeze_readiness_conditions:['no true blockers'],governance_conditions:['no unsafe escalation'],replay_conditions:['replay recovery verified'],continuity_conditions:['fresh-tab proof verified'],mobile_conditions:['compact + explicit approvals'],artifact_stability_conditions:['deterministic ordering + bounded retention'],remaining_blocker_classes:['hard-blocker','advisory-risk']};
  writeJson(root,'.stealtheye/validation/h4-precompletion-law.json',out);
  writeJson(root,'.stealtheye/validation/h4-precompletion-blockers.json',{blockers});
  writeJson(root,'.stealtheye/validation/h4-precompletion-risks.json',{risks});
  writeJson(root,'.stealtheye/validation/h4-precompletion-authority.json',authority);
  return out;
}
