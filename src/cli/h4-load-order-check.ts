import { CANONICAL_ORDER, runH4FreshTab } from '../lib/h4-fresh-tab.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const rt=runH4FreshTab();
if(JSON.stringify(rt.canonical_source_order)!==JSON.stringify(CANONICAL_ORDER)) throw new Error('invalid-precedence-order');
const agents=readFileSync(resolve(process.cwd(),'AGENTS.md'),'utf8');
if(!agents.includes('Canonical source: GitHub Issue #1')) throw new Error('issue-1-not-referenced');
if(rt.h4_status!=='ACTIVE') throw new Error('h4-complete-forbidden');
console.log('h4:load-order-check ok');
