import { writeFileSync } from 'node:fs'; import { resolve } from 'node:path';
const now=new Date().toISOString();
const session={schema_version:'1.0.0',active_session_id:'h4-session-1',status:'active',interruption_marker:false,resume_proof:'deterministic'};
const lineage={schema_version:'1.0.0',sessions:[{id:'h4-session-0',parent:'root'},{id:'h4-session-1',parent:'h4-session-0'}],canonical_order:['h4-session-0','h4-session-1']};
const checkpoints={schema_version:'1.0.0',checkpoints:[{id:'s1',session_id:'h4-session-1',at:now,status:'ok'}],stale_session_quarantine:[]};
writeFileSync(resolve(process.cwd(),'.stealtheye/state/fresh-tab-session.json'),JSON.stringify(session,null,2));
writeFileSync(resolve(process.cwd(),'.stealtheye/state/fresh-tab-session-lineage.json'),JSON.stringify(lineage,null,2));
writeFileSync(resolve(process.cwd(),'.stealtheye/state/fresh-tab-session-checkpoints.json'),JSON.stringify(checkpoints,null,2));
console.log('h4:session-check ok');
