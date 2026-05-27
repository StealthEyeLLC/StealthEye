import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { emitRunEvidence, writeHandoff } from '../lib/substrate.js';
import { loadState } from '../lib/substrate.js';

loadState();
const required = ['project-state.json','invariants.json','process-selector.json','tool-routing.json','memory-index.json'];
const missing = required.filter((f)=>!existsSync(resolve('.stealtheye/state',f)));
const schemaCount = readdirSync('.stealtheye/schemas').length;
if (missing.length) throw new Error(`missing state files: ${missing.join(',')}`);
emitRunEvidence('validate', { ok: true, schema_count: schemaCount });
writeHandoff({ action: 'validate', freshness: 'updated' });
