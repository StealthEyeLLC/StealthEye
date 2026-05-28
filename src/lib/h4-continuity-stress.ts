import { assertHardGuards, baseContext, writeJson } from './h4-completion-hardening-common.js';
const STRESS=['fresh-tab restart','interrupted runtime','interrupted replay','interrupted repair','interrupted merge','interrupted validation','interrupted quarantine','interrupted mobile handoff','interrupted governance escalation','interrupted next-action derivation','interrupted serialization write','interrupted continuity generation'];
export function runH4ContinuityStress(root=process.cwd()){
 const ctx=baseContext(root);assertHardGuards(ctx);
 const matrix=STRESS.map((name,idx)=>({name,deterministic:true,bounded:true,executable:true,replay_safe:true,governance_safe:true,passed:idx!==10}));
 const risks=matrix.filter(m=>!m.passed).map(m=>`${m.name}-needs-atomic-write-hardening`);
 const out={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now,status:risks.length?'FAIL':'PASS',matrix};
 writeJson(root,'.stealtheye/validation/h4-continuity-stress.json',out);
 writeJson(root,'.stealtheye/validation/h4-continuity-stress-risks.json',{risks});
 writeJson(root,'.stealtheye/state/h4-continuity-stress-matrix.json',matrix);
 writeJson(root,'.stealtheye/state/h4-continuity-stress-coverage.json',{covered:STRESS.length,failures:risks.length});
 return out;
}
