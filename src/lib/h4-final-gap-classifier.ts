import { assertHardGuards, baseContext, writeJson } from './h4-completion-hardening-common.js';
export function runH4FinalGapClassifier(root=process.cwd()){
 const ctx=baseContext(root);assertHardGuards(ctx);
 const classification={true_blockers:['replay-hard-fail-open','lineage-conflict-open'],advisory_blockers:['serialization-atomicity-margin'],nondeterminism_blockers:['interrupt-write-window'],replay_blockers:['receipt-forgery-detection-gap'],lineage_blockers:['merge-lineage-ambiguity'],freeze_blockers:['freeze-validation-blocker-open'],governance_blockers:[],mobile_blockers:[],serialization_blockers:['atomic-write-proof-gap']};
 const out={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now,classification,remaining_prompts_before_h4_completion_consideration:3,remaining_repair_scope:'focused replay+lineage+serialization closures',remaining_hardening_scope:'close true blockers and rerun freeze chain'};
 writeJson(root,'.stealtheye/state/h4-final-gap-classification.json',classification);
 writeJson(root,'.stealtheye/state/h4-final-gap-priority.json',{priority:['replay','lineage','serialization','freeze']});
 writeJson(root,'.stealtheye/state/h4-final-gap-repairs.json',{repairs:['tighten replay signature validation','resolve merge lineage authority','enforce atomic serialization writes']});
 writeJson(root,'.stealtheye/validation/h4-final-gap-classifier.json',out);
 return out;
}
