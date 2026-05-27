import { inspectRepo, readJson } from '../lib/substrate.js';
import { detectEnvironment, recordH1, writeH1Foundation } from '../lib/h1.js';
writeH1Foundation();
const base = inspectRepo();
const posture = detectEnvironment();
const evidence = readJson('.stealtheye/state/h1-browser-latest.json', {}) as any;
const finalStatus = readJson('.stealtheye/validation/h1-final-status.json', { status: 'NOT_READY' }) as any;
const summary = readJson('.stealtheye/validation/h1-final-summary.json', {}) as any;
const out = {
  ...base,
  h1_final_status: finalStatus.status,
  browser_proof_posture: summary.browser_proof_posture ?? 'NOT_READY',
  ci_authority_posture: summary.ci_authority_posture ?? 'NOT_CANONICAL',
  runtime_kernel_posture: evidence.runtime_kernel?.deterministic ? 'SEALED' : 'NOT_READY',
  replay_posture: evidence.replay_authority?.deterministic ? 'SEALED' : 'NOT_READY',
  continuity_posture: evidence.runtime_kernel?.continuity_engine?.bounded ? 'SEALED' : 'NOT_READY',
  authority_posture: evidence.ci_authority?.authoritative ? 'SEALED' : 'NOT_READY',
  orchestration_posture: evidence.orchestration_bounds ? 'SEALED' : 'NOT_READY',
  acceptance_seal_status: finalStatus.status === 'COMPLETE' ? 'PASS' : 'FAIL',
  environment_classes: posture.classes
};
console.log(JSON.stringify(out, null, 2));
recordH1('h1:inspect', { status: 'ok', h1_final_status: finalStatus.status } as any);
