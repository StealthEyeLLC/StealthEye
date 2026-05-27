import { inspectRepo, readJson } from '../lib/substrate.js';
import { recordH1 } from '../lib/h1.js';
const base = inspectRepo();
const status = readJson('.stealtheye/validation/h1-final-status.json', { status: 'NOT_READY' }) as any;
const gaps = readJson('.stealtheye/validation/h1-final-gaps.json', { blockers: [] }) as any;
const out = {
  ...base,
  phase0_status: 'COMPLETE',
  h1_status: status.status,
  final_runtime_seal_status: readJson('.stealtheye/receipts/h1-runtime-seal.json', { status: 'missing' }).status,
  final_continuity_seal_status: readJson('.stealtheye/receipts/h1-continuity-seal.json', { status: 'missing' }).status,
  final_replay_seal_status: readJson('.stealtheye/receipts/h1-replay-seal.json', { status: 'missing' }).status,
  final_authority_seal_status: readJson('.stealtheye/receipts/h1-authority-seal.json', { status: 'missing' }).status,
  final_orchestration_seal_status: readJson('.stealtheye/receipts/h1-orchestration-seal.json', { status: 'missing' }).status,
  remaining_blockers: gaps.blockers ?? [],
  human_action_needed: (gaps.blockers ?? []).length > 0
};
console.log(JSON.stringify(out, null, 2));
recordH1('inspect:repo', out as any);
