import { runH4Orchestration } from '../lib/h4-orchestration.js';
const out=runH4Orchestration();
if(!out.ok) throw new Error('h4-orchestrate-failed');
console.log('h4 orchestrate passed');
