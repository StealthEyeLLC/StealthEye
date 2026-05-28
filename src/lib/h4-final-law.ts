import { assertHardGuards, baseContext, writeJson } from './h4-completion-hardening-common.js';
export function runH4FinalLaw(root=process.cwd()){
 const ctx=baseContext(root);assertHardGuards(ctx);
 const prohibitions=['forbid premature H4 completion','forbid weakened governance','forbid replay-invalid continuation','forbid lineage-invalid continuation','forbid unrestricted autonomy','forbid approval-boundary bypass','forbid chat-memory authority','forbid Issue #1 prompt dumping','forbid reopening H0-H3'];
 const requirements={completion:'all hard-fail classes resolved',freeze:'all freeze blockers closed',governance:'approval boundaries explicit',replay:'invalid replay always rejected',lineage:'canonical lineage non-ambiguous',continuity:'fresh-tab deterministic',mobile:'compact exact handoff',serialization:'atomic and stable'};
 const blockers=['premature-completion-forbidden-while-blockers-open'];
 const out={phase:'H4',h4_status:'ACTIVE',timestamp:ctx.now,prohibitions,requirements,status:'ENFORCED'};
 writeJson(root,'.stealtheye/validation/h4-final-law.json',out);
 writeJson(root,'.stealtheye/validation/h4-final-law-risks.json',{risks:['attempted-completion-with-open-blockers']});
 writeJson(root,'.stealtheye/validation/h4-final-law-authority.json',{authority:'repo-state-over-chat-memory'});
 writeJson(root,'.stealtheye/validation/h4-final-law-blockers.json',{blockers});
 return out;
}
