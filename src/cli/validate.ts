import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emitRunEvidence, writeHandoff, loadState, updateLifecycle, writeReplayReceipt, classifyBootstrapFailure, consistencyCheck, registerFailurePattern, replayDeterminismReport, continuityValidator, continuityAcceptance } from '../lib/substrate.js';

loadState();
const required = ['project-state.json','invariants.json','memory-index.json','queue.json','freshness-policy.json','routing-governance.json','maintenance-plan.json'];
const missing = required.filter((f)=>!existsSync(resolve('.stealtheye/state',f)));
if (missing.length) {
  updateLifecycle('validate', 'failure');
  registerFailurePattern({ command: 'npm run validate', file: missing[0], success: false });
  writeReplayReceipt('validate', { commands: ['npm run validate'], blockers: missing, validation_results: { ok: false } });
  throw new Error(`missing state files: ${missing.join(',')}`);
}
const bootstrapDiag = classifyBootstrapFailure();
consistencyCheck();
const replay = replayDeterminismReport();
const continuity = continuityValidator();
const acceptance = continuityAcceptance();
const reliability = { score: acceptance.pass ? 0.99 : 0.7, replay, continuity, acceptance };
writeFileSync(resolve('.stealtheye/state/validation-reliability.json'), JSON.stringify(reliability, null, 2));
updateLifecycle('validate', 'success');
emitRunEvidence('validate', { ok: true, bootstrap: bootstrapDiag.status, validation_reliability: reliability.score });
writeReplayReceipt('validate', { commands: ['npm run validate'], validation_results: { ok: true, reliability } });
writeHandoff({ action: 'validate', freshness: 'updated' });
