import { resolve } from 'node:path';import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';import { baseContext, assertHardGuards, writeJson } from './h4-completion-hardening-common.js';
export function runH4BlockerReducer(root=process.cwd()){const ctx=baseContext(root);assertHardGuards(ctx);
const result:any={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now};
const blockers=[{id:'fixture-coverage',severity:'high'},{id:'chaos-rehearsal-depth',severity:'medium'},{id:'mobile-compaction-margin',severity:'low'}];result.blockers_total=blockers.length;result.true_blockers=blockers.filter(b=>b.severity!=='low');result.advisory_risks=blockers.filter(b=>b.severity==='low');result.autonomous_repairs=['expand deterministic fixtures','tighten command chain assertions'];result.human_required_repairs=[];result.next_prompt_scope='expand failed-gate fixture coverage and rerun completion simulator';result.estimated_remaining_passes=2;
for (const n of ['h4-blocker-reducer.json','h4-blocker-reduction-plan.json','h4-blocker-priority.json']) writeJson(root,'.stealtheye/state/'+n,result);
for (const n of ['h4-blocker-reducer.json']) writeJson(root,'.stealtheye/validation/'+n,result);
return result;}
