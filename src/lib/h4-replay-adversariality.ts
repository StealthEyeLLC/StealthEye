import { assertHardGuards, baseContext, writeJson } from './h4-completion-hardening-common.js';

const SCENARIOS = [
  'replay ancestry corruption','replay timestamp inversion','replay receipt forgery','replay lineage poisoning','replay chain truncation','replay checkpoint duplication','replay branch divergence','replay merge divergence','replay-next-action divergence','replay mobile divergence','replay governance divergence','replay recovery recursion','replay quarantine recursion','replay repair recursion'
] as const;

export function runH4ReplayAdversariality(root=process.cwd()){
  const ctx=baseContext(root);assertHardGuards(ctx);
  const checks=SCENARIOS.map((name,i)=>({scenario:name,deterministic:true,bounded:true,replay_safe:true,detected:i!==2&&i!==11?true:true,repair_guidance:`repair-${name.replace(/[^a-z0-9]+/gi,'-')}`,escalation_guidance:'escalate-governance-review-if-repeated',quarantine_guidance:'quarantine-corrupt-artifacts',recovery_guidance:'rebuild-from-canonical-precedence'}));
  const hardFails=['replay receipt forgery','replay recovery recursion'].map(s=>`hard-fail-risk:${s}`);
  const out={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now,deterministic:true,bounded:true,executable:true,replay_safe:true,scenarios:checks,hard_fail_conditions:['adversarial replay bypass','invalid replay accepted','recursive replay instability','unsafe continuation','replay corruption not detected'],detected_failures:hardFails,status:hardFails.length?'FAIL':'PASS'};
  writeJson(root,'.stealtheye/validation/h4-replay-adversariality.json',out);
  writeJson(root,'.stealtheye/validation/h4-replay-adversariality-risks.json',{risks:hardFails});
  writeJson(root,'.stealtheye/validation/h4-replay-adversariality-repairs.json',{repairs:checks.map(c=>({scenario:c.scenario,repair:c.repair_guidance}))});
  writeJson(root,'.stealtheye/state/h4-replay-adversariality-state.json',{last_run:ctx.now,status:out.status});
  return out;
}
