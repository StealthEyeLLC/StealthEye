import { inspectRepo, emitRunEvidence, writeReplayReceipt, writeHandoff } from '../lib/substrate.js';
const inspect = inspectRepo();
console.log(JSON.stringify(inspect, null, 2));
emitRunEvidence('inspect:repo', { ok: true });
writeReplayReceipt('inspect:repo', { commands: ['npm run inspect:repo'] });
writeHandoff({ action: 'inspect:repo', freshness: 'updated' });
