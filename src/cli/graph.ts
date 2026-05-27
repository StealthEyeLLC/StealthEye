import { graphIndex, emitRunEvidence, writeHandoff, loadState, writeReplayReceipt } from '../lib/substrate.js';
loadState();
graphIndex();
emitRunEvidence('graph', { ok: true });
writeReplayReceipt('graph', { commands: ['npm run graph'] });
writeHandoff({ action: 'graph', freshness: 'updated' });
