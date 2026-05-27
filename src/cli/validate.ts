import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { emitRunEvidence, writeHandoff, loadState, updateLifecycle, writeReplayReceipt, classifyBootstrapFailure, consistencyCheck } from '../lib/substrate.js';

loadState();
const required = ['project-state.json','invariants.json','process-selector.json','memory-index.json','queue.json'];
const missing = required.filter((f)=>!existsSync(resolve('.stealtheye/state',f)));
const schemaCount = readdirSync('.stealtheye/schemas').length;
const bootstrapDiag = classifyBootstrapFailure();
if (missing.length) {
  updateLifecycle('validate', 'failure');
  writeReplayReceipt('validate', { commands: ['npm run validate'], blockers: missing, validation_results: { ok: false } });
  throw new Error(`missing state files: ${missing.join(',')}`);
}
consistencyCheck();
updateLifecycle('validate', 'success');
emitRunEvidence('validate', { ok: true, schema_count: schemaCount, bootstrap: bootstrapDiag.status });
writeReplayReceipt('validate', { commands: ['npm run validate'], validation_results: { ok: true } });
writeHandoff({ action: 'validate', freshness: 'updated' });
