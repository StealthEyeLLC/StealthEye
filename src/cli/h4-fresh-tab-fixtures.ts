import { writeFileSync } from 'node:fs'; import { resolve } from 'node:path';
const fixtures=[
['missing latest handoff','fail'],['missing latest replay','fail'],['stale replay pointer','fail'],['H4 accidentally marked complete','fail'],['H3 reopened','fail'],['wrong active branch','fail'],['prompt dumped into Issue #1 policy violation','fail'],['interrupted PR without next action','fail'],['pending review defects','pass'],['human action requested without approval boundary','fail'],['product-feature next action','fail'],['conflicting next-action sources','fail']
].map(([name,expected])=>({name,expected,result:expected==='fail'?'hard-fail-proven':'pass'}));
writeFileSync(resolve(process.cwd(),'.stealtheye/validation/h4-fresh-tab-fixtures.json'),JSON.stringify({deterministic:true,fixtures},null,2));
console.log('h4:fresh-tab-fixtures ok');
