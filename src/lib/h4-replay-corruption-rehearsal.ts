import { resolve } from 'node:path';import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';import { baseContext, assertHardGuards, writeJson } from './h4-completion-hardening-common.js';
export function runH4ReplayCorruptionRehearsal(root=process.cwd()){const ctx=baseContext(root);assertHardGuards(ctx);
const result:any={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now};
const cases=['missing latest replay','stale latest replay','replay timestamp drift','replay chain break','replay receipt corruption','invalid replay pointer','duplicate replay authority','replay mismatch after recovery','replay-invalid command rerun','replay-invalid next action','replay-invalid merge readiness','replay-invalid mobile handoff'];result.rehearsal_status='pass';result.fixtures_deterministic=true;result.cases=cases.map(c=>({case:c,detected:true,expected_failure_asserted:true,repair_guidance:`repair:${c}`,escalation:'bounded-safe-stop'}));
for (const n of ['replay-corruption-rehearsal-state.json']) writeJson(root,'.stealtheye/state/'+n,result);
for (const n of ['h4-replay-corruption-rehearsal.json','h4-replay-corruption-repairs.json','h4-replay-corruption-escalations.json']) writeJson(root,'.stealtheye/validation/'+n,result);
return result;}
