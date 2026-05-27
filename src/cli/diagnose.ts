import { classifyBootstrapFailure, consistencyCheck, emitRunEvidence, writeReplayReceipt, writeHandoff, readJson, entropyReport } from '../lib/substrate.js';
import { resolve } from 'node:path';

const bootstrap = classifyBootstrapFailure();
const consistency = consistencyCheck();
const entropy = entropyReport();
const diagnosis = {
  bootstrap,
  consistency,
  entropy,
  replay: readJson(resolve('.stealtheye/validation/replay-determinism.json'), {}),
  coherence: readJson(resolve('.stealtheye/state/inspect-repo.json'), {}).coherence ?? {},
  maintenance_recommendations: entropy.recommendations
};
console.log(JSON.stringify(diagnosis, null, 2));
emitRunEvidence('diagnose', diagnosis);
writeReplayReceipt('diagnose', { commands: ['npm run diagnose'], validation_results: diagnosis });
writeHandoff({ action: 'diagnose', freshness: 'updated' });
