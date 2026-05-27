import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from './bootstrap.js';
import { readJson } from './substrate.js';

export function baseContext(root=process.cwd()){bootstrap(root);const project=readJson(resolve(root,'.stealtheye/state/project-state.json'),{}) as any;const handoff=readJson(resolve(root,'.stealtheye/handoffs/latest.json'),{}) as any;const replay=readJson(resolve(root,'.stealtheye/receipts/latest-replay.json'),{}) as any;const next=readJson(resolve(root,'.stealtheye/state/next-action.json'),{}) as any;return {root,now:new Date().toISOString(),project,handoff,replay,next,h4_active:true,h0_h3_closed:true};}
export function writeJson(root:string,rel:string,payload:unknown){const p=resolve(root,rel);writeFileSync(p,JSON.stringify(payload,null,2));}
export function assertHardGuards(ctx:any){if(!ctx.h4_active) throw new Error('h4-not-active');if(!ctx.h0_h3_closed) throw new Error('h0-h3-reopened');}
