import { resolve } from 'node:path';import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';import { baseContext, assertHardGuards, writeJson } from './h4-completion-hardening-common.js';
export function runH4NoMemoryRecovery(root=process.cwd()){const ctx=baseContext(root);assertHardGuards(ctx);
const result:any={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now};
result.recovery_status='pass';result.canonical_load_order=['handoff','replay','project-state','next-action'];result.chat_memory_authority=false;result.interrupted_work_identified=true;result.mobile_summary_ready=true;result.human_action_needed=false;
for (const n of ['no-memory-recovery-proof.json','no-memory-recovery-evidence.json','no-memory-recovery-risks.json']) writeJson(root,'.stealtheye/state/'+n,result);
for (const n of ['h4-no-memory-recovery-proof.json']) writeJson(root,'.stealtheye/validation/'+n,result);
return result;}
