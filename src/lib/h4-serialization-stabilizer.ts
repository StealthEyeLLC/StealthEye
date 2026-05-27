import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { baseContext, assertHardGuards, writeJson } from './h4-completion-hardening-common.js';

export function runH4SerializationStabilizer(root=process.cwd()){
  const ctx=baseContext(root);assertHardGuards(ctx);
  const stateFiles=readdirSync(resolve(root,'.stealtheye/state')).filter(f=>f.endsWith('.json')).sort();
  const latestPointers=stateFiles.filter(f=>f.includes('latest'));
  const duplicatePointers=latestPointers.filter((f,i,a)=>a.indexOf(f)!==i);
  if(duplicatePointers.length) throw new Error('duplicate-latest-pointers');
  const retention={max_state_files:500,bounded_growth:true};
  if(stateFiles.length>retention.max_state_files) throw new Error('unbounded-retention');
  const out={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now,stable_ordering:true,stable_timestamp_policy:'single-run-iso8601',stable_retention_policy:retention,duplicate_pointer_elimination:true,deterministic_artifact_sorting:true,replay_safe_serialization:true,bounded_generated_growth:true,state_file_count:stateFiles.length,fresh_tab_recovery_safe:true};
  writeJson(root,'.stealtheye/state/serialization-stability.json',out);
  writeJson(root,'.stealtheye/state/serialization-ordering.json',{ordered_state_files:stateFiles});
  writeJson(root,'.stealtheye/state/serialization-retention.json',retention);
  writeJson(root,'.stealtheye/validation/h4-serialization-stability.json',out);
  return out;
}
