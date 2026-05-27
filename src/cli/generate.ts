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
  working_set: { summary: 'phase0 hardening', compression: { mode: 'compact', max_items: 12 }, priorities: { critical: ['lifecycle'], active: ['replay'], background: ['compaction'], archival: [] } },
  process_selector: { current: 'phase0-build', version: '1.2.0', allowed: ['phase0-build', 'recovery', 'validation'] },
  readiness: { status: 'partial', missing: [], tier: 'bootstrap' },
  next_action: { next_action: 'run validate', confidence: 0.8 },
  drift_report: { severity: 'low', repeated_drift: 0, drift_type: 'none' },
  codex_minimization: { avoidable_codex_usage: 0, successful_non_codex_handling: 0, preparation_quality: 0.9, packet_completeness: 0.8, estimated_future_autonomy_gain: 0.85 },
  loop_protection: { retry_count: 0, repeated_failures: 0, unstable_transitions: 0, repeated_drift: 0 },
  failure_pattern_memory: { recurring: [], repair_intelligence: [] },
  validation_reliability: { flaky_validations: [], unstable_checks: [], repeated_failures: 0, repair_success_rate: 1, score: 1 },
  process_compatibility: { version: '1.2.0', compatibility: 'ok' }
};
for (const [k, v] of Object.entries(payloads)) writeFileSync(resolve(root, `.stealtheye/state/${k.replaceAll('_','-')}.json`), JSON.stringify(v, null, 2));
updateLifecycle('generate', 'success');
emitRunEvidence('generate', { generated: Object.keys(payloads).length });
writeReplayReceipt('generate', { commands: ['npm run generate'] });
enforceRetention();
writeHandoff({ action: 'generate', freshness: 'updated' });
