import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from './bootstrap.js';
import { loadState, readJson } from './substrate.js';

export const CANONICAL_ORDER = [
  'AGENTS.md','llms.txt','llms-full.txt','.stealtheye/state/fresh-tab-bootstrap.json','.stealtheye/state/continuity-surface-index.json','.stealtheye/state/active-runtime.json','.stealtheye/state/mission-lineage-index.json','.stealtheye/validation/h4-readiness.json','.stealtheye/state/project-state.json','.stealtheye/handoffs/latest.json','.stealtheye/receipts/latest-replay.json','.stealtheye/state/next-action.json','.stealtheye/state/working-set.json'
];

export function runH4FreshTab(root=process.cwd()){
  bootstrap(root); loadState(root);
  const loaded:string[]=[]; const missing:string[]=[];
  for(const p of CANONICAL_ORDER){(existsSync(resolve(root,p))?loaded:missing).push(p);}
  if(missing.length) throw new Error(`missing-mandatory-surfaces:${missing.join(',')}`);
  const project=readJson(resolve(root,'.stealtheye/state/project-state.json'),{}) as any;
  const h4=readJson(resolve(root,'.stealtheye/state/h4-runtime-state.json'),{}) as any;
  const readiness=readJson(resolve(root,'.stealtheye/validation/h4-readiness.json'),{}) as any;
  const next=readJson(resolve(root,'.stealtheye/state/next-action.json'),{}) as any;
  const handoff=readJson(resolve(root,'.stealtheye/handoffs/latest.json'),{}) as any;
  const replay=readJson(resolve(root,'.stealtheye/receipts/latest-replay.json'),{}) as any;
  const status = String(h4.status ?? 'ACTIVE').toUpperCase();
  if(status==='COMPLETE') throw new Error('h4-must-remain-active');
  const stale:string[]=[];
  if(!handoff.now) stale.push('handoff-latest-pointer-stale');
  if(!replay.timestamp) stale.push('replay-latest-pointer-stale');
  const output={schema_version:'1.0.0',phase:'H4',h4_status:'ACTIVE',active_branch:readBranch(root),canonical_source_order:CANONICAL_ORDER,loaded_surfaces:loaded,missing_surfaces:missing,stale_surfaces:stale,blocker_classification:stale.length?['continuity-pointer-risk']:[],approval_boundary_status:'enforced-bounded-governance',next_action:String(next.next_action??'run npm run h4:next-action-check'),confidence:stale.length?0.72:0.93,recovery_mode:'repo-native-no-chat-memory',mobile_summary:'H4 ACTIVE. Continue deterministic continuity checks.',human_action_needed:false};
  writeFileSync(resolve(root,'.stealtheye/state/fresh-tab-runtime-state.json'),JSON.stringify(output,null,2));
  writeRecoveryPacket(root, output, project, readiness, handoff, replay);
  return output;
}

function writeRecoveryPacket(root:string, rt:any, project:any, readiness:any, handoff:any, replay:any){
  const packet={schema_version:'1.0.0',phase:'H4',h4_status:'ACTIVE',authoritative_branch:readBranch(root),read_first:CANONICAL_ORDER,latest_valid_handoff:handoff,latest_valid_replay:replay,next_action:rt.next_action,blockers:rt.blocker_classification,approval_boundaries:['no secrets/credentials without approval','no billing/purchases','no irreversible prod data delete','no unrestricted shell/destructive git'],immediate_actions:['run npm run h4:fresh-tab','run npm run h4:load-order-check','run npm run h4:next-action-check'],never_do:['treat chat memory as canonical','post prompts into Issue #1','mark H4 COMPLETE'],branches_or_prs_for_inspection:[readBranch(root)],continuity_command_chain:['npm run h4:fresh-tab','npm run h4:fresh-tab-smoke','npm run h4:mobile-handoff-check'],human_action_required:false,posture:{h0:'COMPLETE',h1:'COMPLETE',h2:'COMPLETE',h3:'COMPLETE',h4:'ACTIVE'},readiness_status:readiness.status ?? 'ACTIVE'};
  writeFileSync(resolve(root,'.stealtheye/state/fresh-tab-recovery-packet.json'),JSON.stringify(packet,null,2));
  writeFileSync(resolve(root,'.stealtheye/handoffs/fresh-tab-mobile-summary.md'),`Done\n- Fresh-tab runtime state generated.\n\nBlocked\n- None.\n\nNext\n- ${rt.next_action}\n\nHuman action needed\n- No\n\nH4 status\n- ACTIVE\n\nActive branch\n- ${readBranch(root)}\n\nNext command\n- npm run h4:fresh-tab-smoke\n`);
}

function readBranch(root:string){
  const head=readFileSync(resolve(root,'.git/HEAD'),'utf8').trim();
  return head.startsWith('ref:')?head.split('/').slice(2).join('/'):head;
}
