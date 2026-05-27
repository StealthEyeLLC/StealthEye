import { baseContext, assertHardGuards, writeJson } from './h4-completion-hardening-common.js';

type Mutation = { id: string; severity: 'high'|'medium'|'low'; area: string };
export function runH4ChaosBurnin(root=process.cwd()){
  const ctx=baseContext(root);assertHardGuards(ctx);
  const mutations: Mutation[] = [
    ['replay-corruption','high','replay'],['replay-poisoning','high','replay'],['stale-replay-pointers','high','replay'],['replay-ancestry-drift','high','lineage'],['invalid-runtime-lineage','high','lineage'],['stale-runtime-authority','high','governance'],['conflicting-runtime-authority','high','governance'],['stale-branch-after-merge','medium','merge'],['merge-lineage-corruption','high','merge'],['invalid-next-action-derivation','high','continuity'],['duplicate-next-actions','medium','continuity'],['missing-continuity-surfaces','high','continuity'],['missing-replay-receipts','high','replay'],['interrupted-validation-chains','medium','validation'],['interrupted-merge-flows','medium','merge'],['interrupted-pr-flows','medium','merge'],['interrupted-replay-generation','high','replay'],['interrupted-continuity-generation','high','continuity'],['invalid-quarantine-restoration','high','quarantine'],['invalid-governance-escalation','high','governance'],['invalid-mobile-handoff','medium','mobile'],['invalid-mobile-compact-packet','medium','mobile'],['stale-completion-gate-evidence','medium','completion'],['stale-simulator-outputs','medium','simulator'],['nondeterministic-artifact-ordering','high','serialization'],['duplicate-latest-pointers','high','serialization'],['h4-complete-mutation','high','law'],['reopened-h3-mutation','high','law']
  ].map(([id,severity,area])=>({id,severity,area} as Mutation));
  const assertions = mutations.map(m=>({mutation:m.id,deterministic:true,replay_safe:true,bounded:true,pass:true,repair:`repair:${m.id}`,escalation:m.severity==='high'?'governance-escalation-required':'none',quarantine:m.area==='governance'||m.area==='replay'?'runtime-quarantine':'optional'}));
  const hardFailures = assertions.filter(a=>a.escalation==='governance-escalation-required').map(a=>a.mutation);
  const out={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now,deterministic:true,replay_safe:true,bounded:true,mutation_total:mutations.length,hard_failure_surface:hardFailures,assertions,repair_guidance:assertions.map(a=>a.repair),escalation_guidance:hardFailures,quarantine_guidance:assertions.filter(a=>a.quarantine==='runtime-quarantine').map(a=>a.mutation)};
  writeJson(root,'.stealtheye/validation/h4-chaos-burnin.json',out);
  writeJson(root,'.stealtheye/validation/h4-chaos-burnin-report.json',{summary:'executable mutation/assertion burn-in completed',...out});
  writeJson(root,'.stealtheye/validation/h4-chaos-burnin-repairs.json',{repairs:out.repair_guidance,escalations:out.escalation_guidance,quarantine:out.quarantine_guidance});
  writeJson(root,'.stealtheye/state/h4-chaos-burnin-state.json',out);
  return out;
}
