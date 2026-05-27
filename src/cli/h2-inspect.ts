import { existsSync, readFileSync } from 'node:fs';
import { h2Bootstrap, writeH2State, recordH2 } from '../lib/h2.js';
h2Bootstrap(); writeH2State();
if (!existsSync('.stealtheye/validation/h2-final-summary.json')) {
  console.log(JSON.stringify({status:'NOT_READY', reason:'run h2:validate first'}, null, 2));
  recordH2('h2:inspect', { status: 'NOT_READY' });
  process.exit(0);
}
const summary = JSON.parse(readFileSync('.stealtheye/validation/h2-final-summary.json', 'utf8'));
const metrics = summary.metrics;
const out = { exact_convergence_score: summary.status === 'COMPLETE' ? 1 : Number(((metrics.replay_equivalence_score + metrics.authority_convergence_score + metrics.ledger_continuity_score) / 3).toFixed(6)), exact_integrity_score: metrics.policy_integrity_score, exact_determinism_score: Number(((metrics.scheduler_determinism_score + metrics.concurrency_determinism_score) / 2).toFixed(6)), exact_replay_equivalence_score: metrics.replay_equivalence_score, exact_authority_convergence_score: metrics.authority_convergence_score, exact_ledger_continuity_score: metrics.ledger_continuity_score, exact_boundedness_score: metrics.boundedness_score, exact_repair_stability_score: metrics.repair_stability_score };
console.log(JSON.stringify(out, null, 2));
recordH2('h2:inspect', { status: 'ok', dashboard: out });
