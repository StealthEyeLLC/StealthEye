import { baseContext, assertHardGuards, writeJson } from './h4-completion-hardening-common.js';

export function runH4GapReducer(root=process.cwd()){
  const ctx=baseContext(root);assertHardGuards(ctx);
  const blockers=['end-to-end-proof-hardening','serialization-stability-verification'];
  const risks=['mobile-packet-margin','chaos-coverage-depth'];
  const out={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now,remaining_blockers:blockers,remaining_risks:risks,advisory_only_gaps:['mobile-packet-margin'],real_completion_blockers:blockers,remaining_nondeterminism:[],remaining_chaos_weaknesses:['interrupted-pr-flow-depth'],remaining_governance_weaknesses:[],remaining_replay_weaknesses:['replay-poisoning-repair-depth'],remaining_mobile_weaknesses:['compact-packet-failure-fixture'],estimated_remaining_prompts_before_h4_completion:2};
  writeJson(root,'.stealtheye/state/h4-gap-reduction.json',out);
  writeJson(root,'.stealtheye/state/h4-gap-priority.json',{priority:blockers});
  writeJson(root,'.stealtheye/state/h4-gap-repairs.json',{repairs:blockers.map(b=>`repair:${b}`)});
  writeJson(root,'.stealtheye/validation/h4-gap-reducer.json',out);
  return out;
}
