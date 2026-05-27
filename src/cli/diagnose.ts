import { classifyBootstrapFailure, consistencyCheck, emitRunEvidence, writeReplayReceipt, writeHandoff, readJson } from '../lib/substrate.js';
import { resolve } from 'node:path';

const bootstrap = classifyBootstrapFailure();
const consistency = consistencyCheck();
const validationReliability = readJson(resolve('.stealtheye/state/validation-reliability.json'), { score: 0.5 });
const failureMemory = readJson(resolve('.stealtheye/state/failure-pattern-memory.json'), { recurring: [] }) as any;
const diagnosis = {
  bootstrap,
  consistency,
  reliability_summary: validationReliability,
  recurring_failures: failureMemory.recurring.length,
  recovery_classification: bootstrap.status === 'ok' ? 'retry' : 'retry-with-repair',
  retry_recommendation: 'retry validate/check chain from latest replay receipt',
  confidence: { recovery_recommendation: 0.8, validation_reliability: (validationReliability as any).score ?? 0.5 }
};
console.log(JSON.stringify(diagnosis, null, 2));
emitRunEvidence('diagnose', diagnosis);
writeReplayReceipt('diagnose', { commands: ['npm run diagnose'], validation_results: diagnosis });
writeHandoff({ action: 'diagnose', freshness: 'updated' });
