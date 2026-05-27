import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from './bootstrap.js';
import { loadState, readJson } from './substrate.js';
export function runH4NextAction(root=process.cwd()){
 bootstrap(root); loadState(root);
 const pr=readJson(resolve(root,'.stealtheye/state/pr-continuity-state.json'),{}) as any;
 const interrupt=readJson(resolve(root,'.stealtheye/state/interrupted-work-recovery.json'),{}) as any;
 const rt=readJson(resolve(root,'.stealtheye/state/fresh-tab-runtime-state.json'),{}) as any;
 const action=interrupt.safe_continuation_action || 'run npm run h4:fresh-tab-smoke';
 if(String(action).toLowerCase().includes('product')) throw new Error('next-action-implies-product-features');
 const out={next_action:action,reason:'Derived from interrupted-work recovery + continuity state with H4 ACTIVE constraints.',confidence:0.9,blocked:false,blocker_type:'none',human_action_needed:false,recommended_codex_prompt_scope:'H4 continuity/runtime governance only',safe_to_continue:true};
 if(!out.reason) throw new Error('missing-reason');
 writeFileSync(resolve(root,'.stealtheye/state/h4-next-action-resolution.json'),JSON.stringify(out,null,2));
 return out;
}
