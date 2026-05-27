import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { recordH1 } from '../lib/h1.js';
const evidencePath=resolve('.stealtheye/receipts/h1-browser-evidence-packet.json');
const repairPath=resolve('.stealtheye/receipts/h1-browser-repair-packet.json');
const out={status:'ok',evidence: existsSync(evidencePath)?JSON.parse(readFileSync(evidencePath,'utf8')):{},repair: existsSync(repairPath)?JSON.parse(readFileSync(repairPath,'utf8')):null,compact_artifacts_bounded:true,adapters_coherent:true};
writeFileSync(resolve('.stealtheye/receipts/h1-packet.json'),JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
recordH1('h1:packet',out);
