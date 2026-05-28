import { resolve } from 'node:path';
import { assertHardGuards, baseContext, writeJson } from './h4-completion-hardening-common.js';
import { readJson } from './substrate.js';

export function runH4FinalGapClassifier(root=process.cwd()){
 const ctx=baseContext(root);assertHardGuards(ctx);
 const proof=readJson(resolve(root,'.stealtheye/validation/h4-final-end-to-end-proof.json'),{}) as any;
 const law=readJson(resolve(root,'.stealtheye/validation/h4-completion-law.json'),{}) as any;
 const blockers=(proof.blockers ?? []).concat(law.status==='PASS'?[]:['completion-law-not-authorized']);
 const classification={true_blockers:blockers,advisory_blockers:proof.risks ?? [],nondeterminism_blockers:[],replay_blockers:blockers.filter((b:string)=>b.includes('replay')),lineage_blockers:blockers.filter((b:string)=>b.includes('lineage')),freeze_blockers:blockers.filter((b:string)=>b.includes('freeze')),governance_blockers:blockers.filter((b:string)=>b.includes('governance')),mobile_blockers:blockers.filter((b:string)=>b.includes('mobile')),serialization_blockers:blockers.filter((b:string)=>b.includes('serialization'))};
 const out={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now,classification,remaining_prompts_before_h4_completion_consideration:blockers.length===0?0:1,remaining_repair_scope:blockers.length===0?'none':'resolve final blockers',remaining_hardening_scope:blockers.length===0?'none':'targeted blocker closure'};
 writeJson(root,'.stealtheye/state/h4-final-gap-classification.json',classification);
 writeJson(root,'.stealtheye/state/h4-final-gap-priority.json',{priority:['proof','law','decision']});
 writeJson(root,'.stealtheye/state/h4-final-gap-repairs.json',{repairs:blockers});
 writeJson(root,'.stealtheye/validation/h4-final-gap-classifier.json',out);
 return out;
}
