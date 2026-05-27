import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadState, emitRunEvidence, writeHandoff } from '../lib/substrate.js';
const st = loadState();
const readiness = JSON.parse(readFileSync(resolve('.stealtheye/validation/readiness-report.json'),'utf8'));
const packet = { objective: 'phase0 autonomy substrate', phase: st.current_phase, readiness, generated_at: new Date().toISOString() };
writeFileSync(resolve('.stealtheye/receipts/pr-packet.json'), JSON.stringify(packet, null, 2));
emitRunEvidence('compile:packet', { ok: true });
writeHandoff({ action: 'compile:packet', freshness: 'updated' });
