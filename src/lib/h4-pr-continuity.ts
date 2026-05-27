import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from './bootstrap.js';
import { loadState } from './substrate.js';
import { readFileSync } from 'node:fs';
export function runH4PrContinuity(root=process.cwd()){
 bootstrap(root); loadState(root);
 const active=readBranch(root);
 if(!active) throw new Error('unknown-active-branch');
 const expected=process.env.STEALTHEYE_EXPECTED_H4_BRANCH ?? active;
 if(active!==expected) throw new Error('branch-drift-ambiguity');
 const state={schema_version:'1.0.0',expected_h4_branch:expected,expected_pr_base:'main',expected_pr_head_pattern:'h4/*',open_pr_handling_policy:'must pass deterministic checks before merge',merged_pr_handling_policy:'post-merge set next action to follow-up hardening pass',review_defect_handling_policy:'must repair and rerun required chain',merge_readiness_criteria:['tests-pass','h4-active','review-defects-resolved'],post_merge_next_action:'continue H4 ACTIVE hardening',branch_drift_policy:'hard-fail on branch mismatch',stale_pr_policy:'revalidate and refresh handoff before merge',h4_status:'ACTIVE'};
 writeFileSync(resolve(root,'.stealtheye/state/pr-continuity-state.json'),JSON.stringify(state,null,2));
 return state;
}
function readBranch(root:string){const head=readFileSync(resolve(root,'.git/HEAD'),'utf8').trim(); return head.startsWith('ref:')?head.split('/').slice(2).join('/'):'';}
