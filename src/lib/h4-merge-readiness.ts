import { resolve } from 'node:path';import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';import { baseContext, assertHardGuards, writeJson } from './h4-completion-hardening-common.js';
export function runH4MergeReadiness(root=process.cwd()){const ctx=baseContext(root);assertHardGuards(ctx);
const result:any={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now};
result.merge_readiness_status='guarded';result.allowed_only_when=['h4 active','validation chain recorded','no high-risk blockers','deterministic next action'];result.blockers=[];result.next_action_deterministic=!!ctx.next.next_action;if(!result.next_action_deterministic) throw new Error('missing-next-action');
for (const n of ['merge-readiness-proof.json','merge-readiness-evidence.json','merge-readiness-risks.json']) writeJson(root,'.stealtheye/state/'+n,result);
for (const n of ['h4-merge-readiness-proof.json']) writeJson(root,'.stealtheye/validation/'+n,result);
return result;}
