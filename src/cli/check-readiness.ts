import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emitRunEvidence, writeHandoff, loadState, updateLifecycle, writeReplayReceipt, readJson } from '../lib/substrate.js';

const st = loadState();
const continuity = readJson(resolve('.stealtheye/validation/continuity-validator.json'), {});
const replay = readJson(resolve('.stealtheye/validation/replay-determinism.json'), {});
const acceptance = readJson(resolve('.stealtheye/validation/continuity-acceptance.json'), {});
const report = { phase: st.current_phase, status: (acceptance as any).pass ? 'validated' : 'partial', continuity, replay, acceptance, low_human_interruption: true, premium_worker_minimized: true };
writeFileSync(resolve('.stealtheye/validation/readiness-report.json'), JSON.stringify(report, null, 2));
writeFileSync(resolve('.stealtheye/validation/phase0-readiness.json'), JSON.stringify({ ready: report.status === 'validated', report }, null, 2));
writeFileSync(resolve('.stealtheye/validation/phase0-gap-report.json'), JSON.stringify({ gaps: report.status === 'validated' ? [] : ['continuity-acceptance'], next_repairs: ['run generate/validate/check chain'] }, null, 2));
updateLifecycle('check:readiness', 'success');
emitRunEvidence('check:readiness', report);
writeReplayReceipt('check:readiness', { commands: ['npm run check:readiness'], validation_results: report });
writeHandoff({ action: 'check:readiness', freshness: 'updated' });
