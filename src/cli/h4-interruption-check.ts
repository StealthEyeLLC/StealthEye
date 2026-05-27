import { readJson } from '../lib/substrate.js';
import { resolve } from 'node:path';
const s=readJson(resolve(process.cwd(),'.stealtheye/state/interrupted-work-recovery.json'),{}) as any;
if((s.interrupted===true)&&!s.safe_continuation_action) throw new Error('interrupted-no-next-action');
if((s.pending_pr===true)&&!s.interrupted_pr_handling) throw new Error('pending-pr-no-policy');
if((s.pending_review_defects===true)&&!s.review_defect_repair_policy) throw new Error('pending-review-defect-no-policy');
if((s.pending_validation_reruns===true)&&!(s.interrupted_command_chain||[]).length) throw new Error('pending-validation-no-command-chain');
console.log('h4:interruption-check ok');
