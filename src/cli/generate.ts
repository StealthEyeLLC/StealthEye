import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from '../lib/bootstrap.js';
import { emitRunEvidence, writeHandoff } from '../lib/substrate.js';

const ctx = bootstrap();
const root = ctx.root;
const payloads: Record<string, unknown> = {
  queue: { items: [], required_process_selection: true },
  invariants: { must_bootstrap_first: true, must_select_process: true, must_emit_handoff: true, must_retrieve_memory: true },
  anti_invariants: { optional_state_usage: false, docs_only_enforcement: false },
  variants: { mobile_mode: true, cloud_mode: true },
  tool_routing: { deep_reasoning: ['architecture'], fast_exec: ['mechanical-edits'], web_research: ['version-sensitive-facts'] },
  memory_index: { required: ['working-set.json', 'repo-facts.json'] },
  working_set: { focus: ['phase0-substrate'], status: 'active' },
  merge_risk_tracking: { risks: [] },
  resource_budgeting: { token_budget: 120000, ci_minutes_budget: 120 },
  drift_detection: { enabled: true, baseline: 'known-good/latest.json' },
  process_selector: { current: 'phase0-build', allowed: ['phase0-build', 'recovery', 'validation'] },
  readiness: { status: 'partial', missing: [] }
};
for (const [k, v] of Object.entries(payloads)) writeFileSync(resolve(root, `.stealtheye/state/${k.replaceAll('_','-')}.json`), JSON.stringify(v, null, 2));
emitRunEvidence('generate', { generated: Object.keys(payloads).length });
writeHandoff({ action: 'generate', freshness: 'updated' });
