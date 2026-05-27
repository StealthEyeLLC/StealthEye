import { writeFileSync } from 'node:fs'; import { resolve } from 'node:path';
const safety={schema_version:'1.0.0',autonomous_continuation_allowed_when:['single-active-branch','no-unresolved-review-ambiguity','deterministic-next-action'],forbidden_autonomous_actions:['deployment','merge-without-checks','secrets-handling']};
const escalation={schema_version:'1.0.0',mandatory_escalation_when:['review-ambiguity','branch-drift-ambiguity','replay-mismatch'],human_action_required:['manual-review-resolution']};
const boundary={schema_version:'1.0.0',approval_boundary_enforcement:['no billing','no secrets','no irreversible prod deletion'],safe_merge_requirements:['all validations pass','explicit continuity state'],safe_recovery_requirements:['deterministic replay','bounded command chain']};
writeFileSync(resolve(process.cwd(),'.stealtheye/state/runtime-safety-law.json'),JSON.stringify(safety,null,2));
writeFileSync(resolve(process.cwd(),'.stealtheye/state/runtime-escalation-law.json'),JSON.stringify(escalation,null,2));
writeFileSync(resolve(process.cwd(),'.stealtheye/state/runtime-boundary-law.json'),JSON.stringify(boundary,null,2));
console.log('h4:runtime-safety-check ok');
