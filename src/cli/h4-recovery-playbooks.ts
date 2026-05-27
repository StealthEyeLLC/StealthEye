import { mkdirSync, writeFileSync } from 'node:fs'; import { resolve } from 'node:path';
const root=process.cwd(); const dir=resolve(root,'.stealtheye/playbooks'); mkdirSync(dir,{recursive:true});
const names=['interrupted-validation','interrupted-pr','interrupted-merge','stale-branch','replay-mismatch','failed-command-chain','invalid-next-action','branch-divergence','mobile-emergency','fresh-tab-cold-restart'];
const playbooks=names.map((n)=>({id:n,symptoms:[`${n}-detected`],deterministic_detection:['repo-state-assertions'],safe_recovery_steps:['run relevant h4 command','revalidate'],bounded_escalation_path:['escalate to human if blocked'],approval_boundary_guidance:['no secrets/billing/destructive prod actions'],forbidden_actions:['unbounded shell','unrestricted destructive git'],next_validation_chain:['npm run h4:validate','npm run h4:fresh-tab-acceptance']}));
for(const p of playbooks) writeFileSync(resolve(dir,`${p.id}.json`),JSON.stringify(p,null,2));
writeFileSync(resolve(root,'.stealtheye/state/runtime-recovery-playbooks.json'),JSON.stringify({schema_version:'1.0.0',playbooks},null,2));
console.log('h4:recovery-playbooks ok');
