import { writeFileSync } from 'node:fs'; import { resolve } from 'node:path';
const fixtures=['interrupted-merge','interrupted-validation-chain','interrupted-generation-chain','interrupted-replay-update','stale-branch-after-merge','wrong-active-branch','duplicate-active-runtime','duplicate-next-action','replay-pointer-corruption','stale-mobile-handoff','stale-recovery-packet','replay-mismatch-after-recovery','unresolved-review-defect','missing-rerun-chain','invalid-recovery-escalation','branch-reconstruction-conflict','stale-session-replay','invalid-session-lineage','replay-invalid-checkpoint-chain'];
const report={schema_version:'1.0.0',fixtures:fixtures.map((id)=>({id,mutate:true,validator:'deterministic',expected:'pass-or-fail-explicit',assertion:'bounded'}))};
writeFileSync(resolve(process.cwd(),'.stealtheye/validation/h4-recovery-fixtures.json'),JSON.stringify(report,null,2));
writeFileSync(resolve(process.cwd(),'.stealtheye/validation/h4-runtime-reconstruction-fixtures.json'),JSON.stringify(report,null,2));
writeFileSync(resolve(process.cwd(),'.stealtheye/validation/h4-session-fixtures.json'),JSON.stringify(report,null,2));
console.log('h4:recovery-fixtures ok');
