import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from '../lib/bootstrap.js';
import { emitRunEvidence, writeHandoff, updateLifecycle, writeReplayReceipt, enforceRetention } from '../lib/substrate.js';

const ctx = bootstrap();
const root = ctx.root;
const payloads: Record<string, unknown> = {
  queue: { items: [{ id: 'phase0-main', status: 'queued' }], required_process_selection: true },
  invariants: { must_bootstrap_first: true, must_select_process: true, must_emit_handoff: true, must_retrieve_memory: true },
  memory_index: { required: ['working-set.json', 'repo-facts.json', 'failure-pattern-memory.json'], compact: true },
  'freshness-policy': { ttl_hours: { '.stealtheye/state/project-state.json': 48, '.stealtheye/state/memory-index.json': 48, '.stealtheye/receipts/latest-replay.json': 24, '.stealtheye/validation/readiness-report.json': 24, '.stealtheye/graphs/latest.json': 72, '.stealtheye/handoffs/latest.json': 24 } },
  'routing-governance': { escalation_threshold: 0.92, minimum_confidence: 0.75, low_cost_first: true, premium_worker_gate: true, human_interruption_minimization_score: 0.9 },
  'maintenance-plan': { plans: ['compaction', 'cleanup', 'replay-regeneration', 'freshness-repair', 'routing-recalibration', 'memory-pruning', 'validation-stabilization'], scheduler: { deterministic: true, mode: 'state-driven' } },
  'phase0-gate': { requirements: ['continuity', 'replay', 'routing', 'diagnostics', 'freshness', 'recovery', 'explainability', 'validation-reliability', 'low-human-interruption'] },
  'canonical-authority': { latest_files: ['project-state.json', 'next-action.json', 'inspect-repo.json'], superseded_pattern: 'replay-*.json', transient_paths: ['.stealtheye/logs'], archival_paths: ['.stealtheye/snapshots'] },
  'loop-protection': { retry_count: 0, repeated_failures: 0, unstable_transitions: 0, repeated_drift: 0, replay_oscillation: 0, routing_churn: 0, stale_regeneration_repeats: 0 },
  'continuity-optimizer': { continuity_health: 0.9, operational_entropy: 0.15 },
  'operational-efficiency': { unnecessary_codex_use: 0, successful_non_codex_handling: 3, repair_efficiency: 1, validation_stability: 1, recovery_efficiency: 1, human_interruption_frequency: 0.02 },
  'failure-pattern-memory': { recurring: [] },
  'success-pattern-memory': { repairs: [] },
  'replay-history': { runs: [] },
  'next-action': { next_action: 'run validate', confidence: 0.9 },
  'drift-report': { severity: 'low', repeated_drift: 0 }
};
for (const [k, v] of Object.entries(payloads)) writeFileSync(resolve(root, `.stealtheye/state/${k.replaceAll('_','-')}.json`), JSON.stringify(v, null, 2));
updateLifecycle('generate', 'success');
emitRunEvidence('generate', { generated: Object.keys(payloads).length });
writeReplayReceipt('generate', { commands: ['npm run generate'] });
enforceRetention();
writeHandoff({ action: 'generate', freshness: 'updated' });
