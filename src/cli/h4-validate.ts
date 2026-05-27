import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from '../lib/bootstrap.js';

const root = bootstrap().root;
const integrity = JSON.parse(readFileSync(resolve(root, '.stealtheye/state/runtime-integrity-report.json'), 'utf8'));
if (!integrity.ok || integrity.ambiguity || integrity.conflicting_latest_pointers || integrity.replay_mismatch || integrity.invalid_runtime_state) {
  throw new Error('h4-validate-failed-hard');
}
writeFileSync(resolve(root, '.stealtheye/validation/h4-runtime-validation.json'), JSON.stringify({ phase: 'H4', status: 'ACTIVE', validated: true, checked_at: new Date().toISOString() }, null, 2));
console.log('h4 validate passed');
