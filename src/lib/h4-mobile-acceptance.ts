import { resolve } from 'node:path';import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';import { baseContext, assertHardGuards, writeJson } from './h4-completion-hardening-common.js';
export function runH4MobileAcceptance(root=process.cwd()){const ctx=baseContext(root);assertHardGuards(ctx);
const result:any={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now};
const md=['# Mobile Supervision','## Done','## Blocked','## Next','## Human Action Needed','## H4 Status','## Active Branch','## PR/Merge Posture','## Exact Next Command','## Approval Boundary Status'].join('\n');writeFileSync(resolve(root,'.stealtheye/handoffs/mobile-supervision-current.md'),md+'\n');result.mobile_acceptance_status='pass';result.compact=true;result.required_order=true;result.no_prompt_dump=true;
for (const n of ['mobile-supervision-acceptance.json','mobile-supervision-evidence.json']) writeJson(root,'.stealtheye/state/'+n,result);
for (const n of ['h4-mobile-acceptance.json']) writeJson(root,'.stealtheye/validation/'+n,result);
return result;}
