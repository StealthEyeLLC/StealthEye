import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from '../lib/bootstrap.js';
import { emitRunEvidence, writeHandoff, updateLifecycle, writeReplayReceipt, enforceRetention } from '../lib/substrate.js';

const ctx = bootstrap();
const root = ctx.root;
const payloads: Record<string, unknown> = {
  queue: { items: [{ id: 'phase0-main', status: 'queued' }], required_process_selection: true },
  invariants: { must_bootstrap_first: true, must_select_process: true, must_emit_handoff: true, must_retrieve_memory: true },
  memory_index: { required: ['working-set.json', 'repo-facts.json'] },
  working_set: { summary: 'phase0 hardening', priorities: { critical: ['lifecycle'], active: ['replay'], background: ['compaction'], archival: [] } },
  process_selector: { current: 'phase0-build', allowed: ['phase0-build', 'recovery', 'validation'] },
  readiness: { status: 'partial', missing: [] },
  next_action: { next_action: 'run validate' },
  drift_report: { severity: 'low', repeated_drift: 0 },
  codex_minimization: { avoidable_codex_usage: 0, successful_non_codex_handling: 0, preparation_quality: 0.9, packet_completeness: 0.8, estimated_future_autonomy_gain: 0.85 },
  loop_protection: { retry_count: 0, repeated_failures: 0, unstable_transitions: 0, repeated_drift: 0 }
};
for (const [k, v] of Object.entries(payloads)) writeFileSync(resolve(root, `.stealtheye/state/${k.replaceAll('_','-')}.json`), JSON.stringify(v, null, 2));
updateLifecycle('generate', 'success');
emitRunEvidence('generate', { generated: Object.keys(payloads).length });
writeReplayReceipt('generate', { commands: ['npm run generate'] });
enforceRetention();
writeHandoff({ action: 'generate', freshness: 'updated' });
