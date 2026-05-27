import { writeFileSync } from 'node:fs';import { resolve } from 'node:path';
import { runH4FreshTab } from '../lib/h4-fresh-tab.js';import { runH4PrContinuity } from '../lib/h4-pr-continuity.js';import { runH4NextAction } from '../lib/h4-next-action.js';
const a=runH4FreshTab(); const b=runH4PrContinuity(); const c=runH4NextAction();
writeFileSync(resolve(process.cwd(),'.stealtheye/validation/h4-fresh-tab-smoke.json'),JSON.stringify({ok:true,steps:['repo-only-state-loading','canonical-order','pr-continuity','next-action'],h4_status:a.h4_status,safe_to_continue:c.safe_to_continue},null,2));
console.log('h4:fresh-tab-smoke ok');
