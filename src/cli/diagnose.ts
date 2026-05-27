import { classifyBootstrapFailure, consistencyCheck, emitRunEvidence, writeReplayReceipt, writeHandoff } from '../lib/substrate.js';
const bootstrap = classifyBootstrapFailure();
const consistency = consistencyCheck();
const diagnosis = { bootstrap, consistency, recovery_classification: bootstrap.status === 'ok' ? 'retryable' : 'repairable', retry_recommendation: 'retry validate/check chain from latest replay receipt' };
console.log(JSON.stringify(diagnosis, null, 2));
emitRunEvidence('diagnose', diagnosis);
writeReplayReceipt('diagnose', { commands: ['npm run diagnose'], validation_results: diagnosis });
writeHandoff({ action: 'diagnose', freshness: 'updated' });
