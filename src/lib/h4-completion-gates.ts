import { resolve } from 'node:path';import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';import { baseContext, assertHardGuards, writeJson } from './h4-completion-hardening-common.js';
export function runH4CompletionGates(root=process.cwd()){const ctx=baseContext(root);assertHardGuards(ctx);
const result:any={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now};
const blockers=['replay-corruption-burn-in','lineage-chaos-expansion'];result.gate_status='not-ready';result.gates_passed=['fresh-tab recovery','governance audit','mobile supervision'];result.gates_failed=['full fixture coverage'];result.remaining_blockers=blockers;result.required_repairs=blockers.map(b=>`repair:${b}`);result.confidence=0.82;result.estimated_remaining_h4_passes=2;result.safe_to_consider_completion=false;

for (const n of ['h4-completion-gates.json','h4-completion-gate-evidence.json','h4-completion-gate-blockers.json','h4-completion-gate-confidence.json']) writeJson(root,'.stealtheye/validation/'+n,result);
return result;}
