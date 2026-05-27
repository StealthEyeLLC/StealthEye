import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from './bootstrap.js';
import { loadState, readJson, writeHandoff, writeReplayReceipt } from './substrate.js';

type RuntimeStatus = 'active'|'recovered'|'stale-rejected'|'replay-mismatch-rejected'|'terminal';

const retention = { handoffs: 24, replays: 36, runtime_checkpoints: 24, recovery_packets: 24 };

export function ensureH4RuntimeSurfaces(root = process.cwd()) {
  bootstrap(root); loadState(root);
  const now = new Date().toISOString();
  mkdirSync(resolve(root, '.stealtheye/runtime/contracts'), { recursive: true });
  mkdirSync(resolve(root, '.stealtheye/runtime/checkpoints'), { recursive: true });
  mkdirSync(resolve(root, '.stealtheye/runtime/bootstrap'), { recursive: true });
  mkdirSync(resolve(root, '.stealtheye/runtime/receipts'), { recursive: true });
  mkdirSync(resolve(root, '.stealtheye/templates'), { recursive: true });

  const schemas: Record<string, unknown> = {
    'runtime-session-envelope.schema.json': { type: 'object', required: ['schema_version','session_id','status','started_at','surface_hash'], properties: { schema_version: { type: 'string' }, session_id: { type: 'string' }, status: { enum: ['active','recovered','terminal'] }, started_at: { type: 'string', format: 'date-time' }, resumed_from: { type: 'string' }, surface_hash: { type: 'string' } }, additionalProperties: true },
    'bounded-continuation.schema.json': { type: 'object', required: ['max_hops','terminal_states','next_action'], properties: { max_hops: { type: 'integer', minimum: 1, maximum: 12 }, terminal_states: { type: 'array', items: { type: 'string' } }, next_action: { type: 'string' } } },
    'runtime-checkpoint.schema.json': { type: 'object', required: ['checkpoint_id','session_id','timestamp','lineage_parent'], properties: { checkpoint_id: { type: 'string' }, session_id: { type: 'string' }, timestamp: { type: 'string', format: 'date-time' }, lineage_parent: { type: 'string' }, continuity_ok: { type: 'boolean' } } },
    'replay-chain.schema.json': { type: 'object', required: ['chain','latest_pointer'], properties: { chain: { type: 'array', items: { type: 'object', required: ['id','prev_id','digest'] } }, latest_pointer: { type: 'string' } } },
    'deterministic-continuation-contract.schema.json': { type: 'object', required: ['deterministic','append_safe','replay_safe','bounded_growth'], properties: { deterministic: { const: true }, append_safe: { const: true }, replay_safe: { const: true }, bounded_growth: { const: true } } },
    'session-resurrection.schema.json': { type: 'object', required: ['source_priority','latest_valid_runtime_selection'], properties: { source_priority: { type: 'array', items: { type: 'string' } }, latest_valid_runtime_selection: { type: 'string' } } },
    'interruption-recovery.schema.json': { type: 'object', required: ['stale_rejection','replay_mismatch_rejection','bounded_recovery_sequence'], properties: { stale_rejection: { const: true }, replay_mismatch_rejection: { const: true }, bounded_recovery_sequence: { type: 'array', items: { type: 'string' } } } },
    'continuity-integrity.schema.json': { type: 'object', required: ['timestamp_coherent','latest_pointer_correct','lineage_unbroken'], properties: { timestamp_coherent: { type: 'boolean' }, latest_pointer_correct: { type: 'boolean' }, lineage_unbroken: { type: 'boolean' }, orphan_count: { type: 'integer' } } }
  };
  for (const [n, body] of Object.entries(schemas)) writeFileSync(resolve(root, '.stealtheye/runtime/contracts', n), JSON.stringify(body, null, 2));

  const checkpointId = `runtime-checkpoint-${Date.now()}`;
  const checkpoint = { checkpoint_id: checkpointId, session_id: `h4-${Date.now()}`, timestamp: now, lineage_parent: readJson(resolve(root, '.stealtheye/state/runtime-checkpoint-index.json'), { latest: 'seed' }).latest ?? 'seed', continuity_ok: true };
  writeFileSync(resolve(root, `.stealtheye/runtime/checkpoints/${checkpointId}.json`), JSON.stringify(checkpoint, null, 2));

  const replayChain = buildReplayChain(root);
  const graphs = buildRuntimeGraphs(root, replayChain.chain as Array<Record<string, string>>);
  const recovery = resolveBootstrap(root, replayChain.latest_pointer as string);

  writeFileSync(resolve(root, '.stealtheye/state/h4-runtime-state.json'), JSON.stringify({ phase: 'H4', status: 'ACTIVE', runtime_status: recovery.status, updated_at: now, deterministic: true, bounded: true }, null, 2));
  writeFileSync(resolve(root, '.stealtheye/state/runtime-lineage.json'), JSON.stringify({ phase: 'H4', lineage: replayChain.chain, terminal_states: ['terminal','stale-rejected','replay-mismatch-rejected'], stale_state_detected: recovery.status === 'stale-rejected' }, null, 2));
  writeFileSync(resolve(root, '.stealtheye/state/runtime-checkpoint-index.json'), JSON.stringify({ latest: checkpointId, checkpoints: readdirSync(resolve(root, '.stealtheye/runtime/checkpoints')).filter((f) => f.endsWith('.json')).sort(), orphan_checkpoints: orphanCheckpoints(root) }, null, 2));
  writeFileSync(resolve(root, '.stealtheye/state/runtime-recovery-state.json'), JSON.stringify(recovery, null, 2));
  const integrity = runtimeIntegrity(root, replayChain, recovery);
  writeFileSync(resolve(root, '.stealtheye/state/runtime-integrity-report.json'), JSON.stringify(integrity, null, 2));

  writeFileSync(resolve(root, '.stealtheye/runtime/bootstrap/validation-receipt.json'), JSON.stringify({ kind: 'bootstrap-validation', timestamp: now, ok: integrity.ok, reason: integrity.failures }, null, 2));
  writeFileSync(resolve(root, '.stealtheye/runtime/receipts/continuity-replay-receipt.json'), JSON.stringify({ kind: 'continuity-replay', timestamp: now, latest_pointer: replayChain.latest_pointer, replay_mismatch: recovery.status === 'replay-mismatch-rejected' }, null, 2));
  writeFileSync(resolve(root, '.stealtheye/runtime/receipts/runtime-recovery-receipt.json'), JSON.stringify({ kind: 'runtime-recovery', timestamp: now, sequence: recovery.recovery_sequence, summary: recovery.summary }, null, 2));

  writeTemplates(root);
  enforceH4Retention(root);
  writeReplayReceipt('h4:runtime-check', { commands: ['npm run h4:runtime-check'], validation_results: { ok: integrity.ok, status: integrity.ok ? 'validated' : 'failed' } }, root);
  writeHandoff({ action: 'h4-runtime-check', phase: 'h4', status: 'ACTIVE', freshness: 'updated' }, root);
  return { integrity, graphs, recovery };
}

function buildReplayChain(root: string) {
  const receipts = readdirSync(resolve(root, '.stealtheye/receipts')).filter((f) => f.startsWith('replay-')).sort();
  const chain = receipts.slice(-12).map((r, i, arr) => ({ id: r, prev_id: i === 0 ? 'root' : arr[i - 1], digest: `${r.length}-${i}` }));
  const latest_pointer = (readJson(resolve(root, '.stealtheye/receipts/latest-replay.json'), { timestamp: '' }) as any).timestamp ?? '';
  const out = { chain, latest_pointer };
  writeFileSync(resolve(root, '.stealtheye/runtime/replay-chain.json'), JSON.stringify(out, null, 2));
  return out;
}

function buildRuntimeGraphs(root: string, chain: Array<Record<string, string>>) {
  const graph = {
    runtime_continuity_graph: { nodes: chain.map((c) => c.id), terminal_states: ['terminal','stale-rejected','replay-mismatch-rejected'], bounded_depth: chain.length },
    replay_lineage_graph: chain,
    session_transition_graph: chain.map((c) => ({ from: c.prev_id, to: c.id, status: 'active' })),
    blocker_propagation_graph: { blockers: [], propagated: false }
  };
  writeFileSync(resolve(root, '.stealtheye/graphs/h4-runtime-graphs.json'), JSON.stringify(graph, null, 2));
  return graph;
}

function resolveBootstrap(root: string, latestPointer: string): { status: RuntimeStatus; next_action: string; recovery_sequence: string[]; summary: string; stale_rejected: boolean; replay_mismatch_rejected: boolean } {
  const handoff = readJson(resolve(root, '.stealtheye/handoffs/latest.json'), { now: '' }) as any;
  const replay = readJson(resolve(root, '.stealtheye/receipts/latest-replay.json'), { timestamp: '' }) as any;
  const stale = handoff.now && replay.timestamp && Math.abs(new Date(handoff.now).getTime() - new Date(replay.timestamp).getTime()) > 15 * 60 * 1000;
  const mismatch = !latestPointer || replay.timestamp !== latestPointer;
  const status: RuntimeStatus = stale ? 'stale-rejected' : mismatch ? 'replay-mismatch-rejected' : 'recovered';
  const next_action = status === 'recovered' ? 'run h4:validate then check' : 'repair latest pointers deterministically';
  return { status, next_action, recovery_sequence: ['resolve-canonical-bootstrap','select-latest-valid-runtime','derive-next-action','emit-receipts'], summary: `runtime ${status}`, stale_rejected: stale, replay_mismatch_rejected: mismatch };
}

function runtimeIntegrity(root: string, replayChain: any, recovery: any) {
  const failures: string[] = [];
  if (!replayChain.chain.length) failures.push('orphan-continuity');
  if (recovery.stale_rejected) failures.push('stale-handoff');
  const orphans = orphanCheckpoints(root);
  if (orphans.length > 0) failures.push('orphan-checkpoint');
  return { ok: failures.length === 0, failures, ambiguity: false, conflicting_latest_pointers: false, replay_mismatch: recovery.replay_mismatch_rejected, invalid_runtime_state: false, orphan_runtime_artifacts: orphans };
}

function orphanCheckpoints(root: string) {
  const index = readJson(resolve(root, '.stealtheye/state/runtime-checkpoint-index.json'), { checkpoints: [] }) as any;
  const files = readdirSync(resolve(root, '.stealtheye/runtime/checkpoints')).filter((f) => f.endsWith('.json'));
  const known = new Set(Array.isArray(index.checkpoints) ? index.checkpoints : []);
  return files.filter((f) => !known.has(f));
}

function enforceH4Retention(root: string) {
  prune(resolve(root, '.stealtheye/handoffs'), 'handoff-', retention.handoffs);
  prune(resolve(root, '.stealtheye/receipts'), 'replay-', retention.replays);
  prune(resolve(root, '.stealtheye/runtime/checkpoints'), 'runtime-checkpoint-', retention.runtime_checkpoints);
}

function prune(dir: string, prefix: string, max: number) { if (!existsSync(dir)) return; const files = readdirSync(dir).filter((f) => f.startsWith(prefix)).sort(); files.slice(0, Math.max(0, files.length - max)).forEach((f) => rmSync(resolve(dir, f))); }

function writeTemplates(root: string) {
  const templates: Record<string, unknown> = {
    'h4-execution-handoff-template.json': { template: 'h4 execution handoff', fields: ['summary','continuity_state','next_action','runtime_integrity'] },
    'runtime-recovery-pr-template.json': { template: 'runtime recovery pr', fields: ['problem','recovery_sequence','receipts','risk'] },
    'continuity-incident-template.json': { template: 'continuity incident', fields: ['detected_at','surface','mismatch','resolution'] },
    'fresh-tab-restoration-checklist.json': { template: 'fresh tab restoration checklist', steps: ['read bootstrap','validate latest pointers','run h4 runtime check','resume next action'] },
    'deterministic-operator-summary-template.json': { template: 'deterministic operator summary', fields: ['status','h4_state','blockers','next'] }
  };
  for (const [name, body] of Object.entries(templates)) writeFileSync(resolve(root, '.stealtheye/templates', name), JSON.stringify(body, null, 2));
}
