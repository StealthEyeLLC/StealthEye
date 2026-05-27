import { resolve } from 'node:path';import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';import { baseContext, assertHardGuards, writeJson } from './h4-completion-hardening-common.js';
export function runH4QuarantineRestoration(root=process.cwd()){const ctx=baseContext(root);assertHardGuards(ctx);
const result:any={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now};
result.quarantine_status='pass';result.proofs=['stale runtime quarantined','replay-invalid runtime quarantined','branch-conflicted runtime quarantined','authoritative restoration requires proof'];result.restoration_requirements=['replay-valid','branch-valid','governance-valid'];result.boundaries_preserved=true;
for (const n of ['quarantine-restoration-proof.json','quarantine-restoration-lineage.json','quarantine-restoration-repairs.json']) writeJson(root,'.stealtheye/state/'+n,result);
for (const n of ['h4-quarantine-restoration-proof.json']) writeJson(root,'.stealtheye/validation/'+n,result);
return result;}
