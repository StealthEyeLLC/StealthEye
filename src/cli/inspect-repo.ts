import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inspectRepo, readJson } from '../lib/substrate.js';
import { recordH1 } from '../lib/h1.js';
const base = inspectRepo();
const h1 = readJson('.stealtheye/validation/h1-final-status.json', { status: 'NOT_READY' }) as any;
const h2 = readJson('.stealtheye/validation/h2-final-status.json', { status: 'NOT_READY' }) as any;
const h2Summary = readJson('.stealtheye/validation/h2-final-summary.json', { metrics: {} }) as any;
const sealRaw = existsSync('.stealtheye/receipts/H2_FINAL_SEAL.json') ? readFileSync('.stealtheye/receipts/H2_FINAL_SEAL.json', 'utf8') : '';
const out = {
  ...base,
  phase0_status: 'COMPLETE',
  h1_status: h1.status,
  h2_status: h2.status,
  h3_status: 'NOT_STARTED',
  exact_canonical_seal_sha: sealRaw ? createHash('sha256').update(sealRaw).digest('hex') : 'missing',
  exact_convergence_score: h2Summary.metrics?.replay_equivalence_score ?? 0,
  exact_boundedness_score: h2Summary.metrics?.boundedness_score ?? 0,
  exact_retention_posture: 'BOUNDED',
  exact_authority_posture: h2Summary.metrics?.authority_convergence_score ?? 0,
  exact_replay_posture: h2Summary.metrics?.replay_equivalence_score ?? 0
};
console.log(JSON.stringify(out, null, 2));
recordH1('inspect:repo', out as any);
