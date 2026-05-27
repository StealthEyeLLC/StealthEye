import { graphIndex, emitRunEvidence, writeHandoff, loadState } from '../lib/substrate.js';
loadState();
graphIndex();
emitRunEvidence('graph', { ok: true });
writeHandoff({ action: 'graph', freshness: 'updated' });
