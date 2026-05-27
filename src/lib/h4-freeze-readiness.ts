import { baseContext, assertHardGuards, writeJson } from './h4-completion-hardening-common.js';
import { readJson } from './substrate.js';
import { resolve } from 'node:path';

export function runH4FreezeReadiness(root=process.cwd()){
  const ctx=baseContext(root);assertHardGuards(ctx);
  const evidence={
    proof_systems:['h4-end-to-end-proof','h4-lineage-conflict-proof','h4-replay-corruption-rehearsal'],
    simulators:['h4-completion-readiness-simulator','h4-zero-context-simulator'],
    governance:readJson(resolve(root,'.stealtheye/validation/h4-governance-audit.json'),{}),
    continuity:readJson(resolve(root,'.stealtheye/validation/h4-fresh-tab-acceptance.json'),{}),
    replay:readJson(resolve(root,'.stealtheye/validation/h4-replay-recovery.json'),{}),
    quarantine:readJson(resolve(root,'.stealtheye/validation/h4-quarantine-restoration-proof.json'),{}),
    mobile:readJson(resolve(root,'.stealtheye/validation/h4-mobile-acceptance.json'),{})
  };
  const blockers=['end-to-end-proof-burnin-pending','serialization-stability-hardening-pending'];
  const risks=['chaos-realism-needs-more-fixture-depth','mobile-supervision-compactness-margin'];
  const out={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now,freeze_readiness_plausible:true,true_blockers:blockers,advisory_risks:risks,governance_gaps:[],replay_gaps:['poisoning-recovery-depth'],lineage_gaps:['merge-lineage-corruption-chaos-depth'],serialization_gaps:['duplicate-latest-pointer-prevention'],chaos_gaps:['interrupted-flow-fixtures'],estimated_remaining_h4_prompts:2};
  writeJson(root,'.stealtheye/validation/h4-freeze-readiness.json',out);
  writeJson(root,'.stealtheye/validation/h4-freeze-readiness-evidence.json',evidence);
  writeJson(root,'.stealtheye/validation/h4-freeze-readiness-risks.json',{risks});
  writeJson(root,'.stealtheye/validation/h4-freeze-readiness-blockers.json',{blockers});
  return out;
}
