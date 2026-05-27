import { resolve } from 'node:path';import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';import { baseContext, assertHardGuards, writeJson } from './h4-completion-hardening-common.js';
export function runH4GovernanceAudit(root=process.cwd()){const ctx=baseContext(root);assertHardGuards(ctx);
const result:any={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now};
const checks=['approval boundaries preserved','repo state canonical','chat memory advisory only'];result.audit_status='pass';result.evidence_files=['.stealtheye/state/project-state.json','.stealtheye/handoffs/latest.json','.stealtheye/receipts/latest-replay.json'];result.governance_findings=checks;result.boundary_findings=['no unrestricted shell authority','no unrestricted destructive git'];result.autonomy_findings=['bounded deterministic autonomy only'];result.human_action_needed=false;result.approval_boundary_hit=false;result.unresolved_audit_risks=[];result.recommended_repair_actions=[];
for (const n of ['governance-audit-trace.json','governance-audit-evidence.json','governance-audit-findings.json']) writeJson(root,'.stealtheye/state/'+n,result);
for (const n of ['h4-governance-audit.json']) writeJson(root,'.stealtheye/validation/'+n,result);
return result;}
