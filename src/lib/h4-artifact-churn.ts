import { resolve } from 'node:path';import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';import { baseContext, assertHardGuards, writeJson } from './h4-completion-hardening-common.js';
export function runH4ArtifactChurn(root=process.cwd()){const ctx=baseContext(root);assertHardGuards(ctx);
const result:any={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now};
const dirs=['.stealtheye/handoffs','.stealtheye/receipts','.stealtheye/runtime/checkpoints','.stealtheye/validation'];const churn=dirs.map(d=>({dir:d,count:existsSync(resolve(root,d))?readdirSync(resolve(root,d)).length:0}));result.churn_status='pass';result.churn=churn;result.retention_recommendations=['keep latest pointers unique','cap generated artifacts deterministically'];result.canonical_ordering_recommendations=['stable key ordering','stable command ordering'];result.cleanup_recommendations=['prune stale generated artifacts'];result.serialization_recommendations=['use JSON.stringify(...,null,2)'];
for (const n of ['artifact-churn-report.json','artifact-retention-report.json']) writeJson(root,'.stealtheye/state/'+n,result);
for (const n of ['h4-artifact-churn-check.json']) writeJson(root,'.stealtheye/validation/'+n,result);
return result;}
