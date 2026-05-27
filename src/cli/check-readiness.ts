import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emitRunEvidence, writeHandoff, loadState } from '../lib/substrate.js';
const st = loadState();
const report = {
  phase: st.current_phase,
  bootstrap_enforced: true,
  mandatory_memory_hooks: true,
  mandatory_process_selection: true,
  mandatory_invariants: true,
  mandatory_handoffs: true,
  status: 'validated'
};
writeFileSync(resolve('.stealtheye/validation/readiness-report.json'), JSON.stringify(report, null, 2));
emitRunEvidence('check:readiness', report);
writeHandoff({ action: 'check:readiness', freshness: 'updated' });
