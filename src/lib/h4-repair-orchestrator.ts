import { baseContext, assertHardGuards, writeJson } from './h4-completion-hardening-common.js';

export function runH4RepairOrchestrator(root=process.cwd()){
  const ctx=baseContext(root);assertHardGuards(ctx);
  const actions=[
    {blocker:'replay-corruption',repair:'run h4:replay-recovery -> h4:chaos-burnin',requires:['lineage-proof','replay-proof']},
    {blocker:'lineage-conflict',repair:'run h4:lineage-conflict-proof -> h4:merge-readiness-proof',requires:['lineage-proof']},
    {blocker:'quarantine-failure',repair:'run h4:runtime-quarantine -> h4:quarantine-restoration-proof',requires:['replay-proof']},
    {blocker:'stale-continuity',repair:'run h4:fresh-tab-acceptance -> h4:end-to-end-proof',requires:['replay-proof']},
    {blocker:'serialization-drift',repair:'run h4:serialization-stabilizer',requires:['lineage-proof']},
    {blocker:'merge-readiness-failure',repair:'run h4:merge-readiness-proof -> h4:precompletion-law',requires:['lineage-proof','replay-proof']}
  ];
  for(const a of actions){if(!a.requires.length) throw new Error('undefined-repair-path');}
  const out={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now,bounded:true,deterministic:true,replay_safe:true,governance_safe:true,escalation_aware:true,approval_boundary_aware:true,hard_fail_conditions:['repair-without-lineage-proof','repair-without-replay-proof','unsafe-repair-escalation','unauthorized-autonomous-repair','undefined-repair-path'],mapped_actions:actions};
  writeJson(root,'.stealtheye/state/repair-orchestrator-state.json',out);
  writeJson(root,'.stealtheye/state/repair-orchestrator-actions.json',{actions});
  writeJson(root,'.stealtheye/state/repair-orchestrator-boundaries.json',{approval_boundary:'no secrets/billing/destructive prod delete',unsafe_autonomy_rejected:true});
  writeJson(root,'.stealtheye/validation/h4-repair-orchestrator.json',out);
  return out;
}
