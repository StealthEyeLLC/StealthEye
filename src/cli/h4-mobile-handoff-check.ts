import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const md=readFileSync(resolve(process.cwd(),'.stealtheye/handoffs/mobile-current.md'),'utf8');
const sections=['Done','Blocked','Next','Human action needed','H4 status','Active branch','Next command'];
let idx=-1; for(const s of sections){const n=md.indexOf(`${s}\n`); if(n<idx||n<0) throw new Error('missing-required-sections'); idx=n;}
if(md.length>2400) throw new Error('oversized-handoff');
console.log('h4:mobile-handoff-check ok');
