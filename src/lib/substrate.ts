import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from './bootstrap.js';

type QueueStatus = 'queued' | 'active' | 'validating' | 'complete' | 'blocked';
type RecoveryClass = 'retryable' | 'repairable' | 'escalation-required' | 'invariant-violation';

const VALID_TRANSITIONS: Record<QueueStatus, QueueStatus[]> = {
  queued: ['active'],
  active: ['validating', 'blocked'],
  validating: ['complete'],
  complete: [],
  blocked: ['active']
};

export function loadState(root = process.cwd()) {
  bootstrap(root);
  return JSON.parse(readFileSync(resolve(root, '.stealtheye/state/project-state.json'), 'utf8'));
}

export function readJson(path: string, fallback: Record<string, unknown> = {}) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback;
}

export function emitRunEvidence(name: string, payload: Record<string, unknown>, root = process.cwd()) {
  const { now, run_id } = bootstrap(root);
  const entry = { now, run_id, process: name, ...payload };
  writeFileSync(resolve(root, '.stealtheye/logs/process-execution.jsonl'), JSON.stringify(entry) + '\n', { flag: 'a' });
  return entry;
}

export function writeHandoff(summary: Record<string, unknown>, root = process.cwd()) {
  const { now, run_id } = bootstrap(root);
  const handoff = { now, run_id, ...summary };
  writeFileSync(resolve(root, `.stealtheye/handoffs/handoff-${run_id}.json`), JSON.stringify(handoff, null, 2));
  updateLatestPointer('handoffs/latest.json', handoff, root);
}

export function graphIndex(root = process.cwd()) {
  bootstrap(root);
  const files = readdirSync(resolve(root, '.stealtheye/state'));
  writeFileSync(resolve(root, '.stealtheye/graphs/repo-graph.json'), JSON.stringify({ nodes: files.map((f) => ({ id: f, type: 'state-file' })) }, null, 2));
  writeFileSync(resolve(root, '.stealtheye/graphs/knowledge-graph.json'), JSON.stringify({ memory_hooks: ['memory-index.json'], invariants: ['invariants.json'] }, null, 2));
  updateLatestPointer('graphs/latest.json', { repo: 'repo-graph.json', knowledge: 'knowledge-graph.json' }, root);
}

export function updateLifecycle(commandName: string, outcome: 'success' | 'failure', root = process.cwd()) {
  const next: QueueStatus = commandName === 'generate' ? 'active' : (commandName.includes('validate') || commandName.includes('check')) ? 'validating' : outcome === 'success' ? 'complete' : 'blocked';
  return transitionTask('phase0-main', next, commandName, root);
}

export function transitionTask(taskId: string, to: QueueStatus, reason: string, root = process.cwd()) {
  bootstrap(root);
  const queuePath = resolve(root, '.stealtheye/state/queue.json');
  const queue = readJson(queuePath, { items: [{ id: taskId, status: 'queued' }], required_process_selection: true }) as { items: Array<{ id: string; status: QueueStatus }>; required_process_selection: boolean };
  const idx = queue.items.findIndex((x) => x.id === taskId);
  if (idx < 0) queue.items.push({ id: taskId, status: 'queued' });
  const item = queue.items.find((x) => x.id === taskId)!;
  const from = item.status;
  if (!VALID_TRANSITIONS[from].includes(to) && from !== to) throw new Error(`invalid-transition:${from}->${to}`);
  item.status = to;
  writeFileSync(queuePath, JSON.stringify(queue, null, 2));
  const receipt = emitRunEvidence('queue-transition', { task_id: taskId, from, to, reason }, root);
  const historyPath = resolve(root, '.stealtheye/state/queue-transition-history.json');
  const history = readJson(historyPath, { transitions: [] }) as { transitions: Array<Record<string, unknown>> };
  history.transitions.push(receipt);
  writeFileSync(historyPath, JSON.stringify(history, null, 2));
  updateLatestPointer('state/latest-queue.json', { task_id: taskId, status: to, reason }, root);
  return receipt;
}

export function writeReplayReceipt(processName: string, payload: Record<string, unknown>, root = process.cwd()) {
  const st = loadState(root);
  const memory = readJson(resolve(root, '.stealtheye/state/memory-index.json'), {});
  const graphs = readJson(resolve(root, '.stealtheye/graphs/latest.json'), {});
  const receipt = {
    processName,
    timestamp: new Date().toISOString(),
    commands: payload.commands ?? [processName],
    state_inputs: ['project-state.json', 'queue.json', 'next-action.json'],
    memory_inputs: memory,
    graph_inputs: graphs,
    validation_results: payload.validation_results ?? {},
    drift_status: payload.drift_status ?? 'stable',
    blockers: st.blockers,
    next_action: st.next_action,
    ...payload
  };
  const out = resolve(root, `.stealtheye/receipts/replay-${Date.now()}.json`);
  writeFileSync(out, JSON.stringify(receipt, null, 2));
  updateLatestPointer('receipts/latest-replay.json', receipt, root);
}

export function enforceRetention(root = process.cwd()) {
  const dir = resolve(root, '.stealtheye/handoffs');
  if (!existsSync(dir)) return;
  const files = readdirSync(dir).filter((f) => f.startsWith('handoff-')).sort();
  const retention = { hot: 10, warm: 20, cold: 40, archival: 'compressed-summary' };
  const toDelete = files.slice(0, Math.max(0, files.length - retention.cold));
  toDelete.forEach((f) => rmSync(resolve(dir, f)));
  writeFileSync(resolve(root, '.stealtheye/state/artifact-retention.json'), JSON.stringify({ retention, remaining: files.length - toDelete.length, supersession: { handoff: 'handoffs/latest.json', replay: 'receipts/latest-replay.json' } }, null, 2));
}

export function classifyBootstrapFailure(root = process.cwd()) {
  const classes: string[] = [];
  if (!existsSync(resolve(root, '.stealtheye/state/project-state.json'))) classes.push('missing state');
  if (!existsSync(resolve(root, '.stealtheye/processes/process-catalog.json'))) classes.push('missing process');
  if (!existsSync(resolve(root, '.stealtheye/state/memory-index.json'))) classes.push('missing memory');
  const out = { status: classes.length ? 'failure' : 'ok', classes, remediation: classes.map((c) => ({ class: c, action: 'run npm run generate' })) };
  writeFileSync(resolve(root, '.stealtheye/validation/bootstrap-diagnostics.json'), JSON.stringify(out, null, 2));
  return out;
}

export function consistencyCheck(root = process.cwd()) {
  const state = loadState(root);
  const queue = readJson(resolve(root, '.stealtheye/state/queue.json'), { items: [] });
  const drift = readJson(resolve(root, '.stealtheye/state/drift-report.json'), { severity: 'low' });
  const selector = readJson(resolve(root, '.stealtheye/state/process-selector.json'), { current: '' });
  const nextAction = readJson(resolve(root, '.stealtheye/state/next-action.json'), { next_action: state.next_action });
  const inconsistent = !selector || !(queue as any).items || !(nextAction as any).next_action;
  const report = { ok: !inconsistent, drift_severity: (drift as any).severity, current_process: (selector as any).current };
  if (inconsistent) throw new Error('cross-file-inconsistency');
  writeFileSync(resolve(root, '.stealtheye/validation/consistency-report.json'), JSON.stringify(report, null, 2));
  return report;
}

export function inspectRepo(root = process.cwd()) {
  const st = loadState(root);
  const selector = readJson(resolve(root, '.stealtheye/state/process-selector.json'), { current: 'phase0-build' });
  const readiness = readJson(resolve(root, '.stealtheye/validation/readiness-report.json'), { status: 'partial' });
  const drift = readJson(resolve(root, '.stealtheye/state/drift-report.json'), { severity: 'low' });
  const out = { current_phase: st.current_phase, current_process: (selector as any).current, next_action: st.next_action, blockers: st.blockers, active_task: 'phase0-main', drift_severity: (drift as any).severity, readiness: (readiness as any).status, recommended_worker: 'codex', codex_needed: (readiness as any).status !== 'validated', human_action_needed: st.blockers.length > 0, replay_source: 'receipts/latest-replay.json', last_successful_validation: (readiness as any).status === 'validated' };
  writeFileSync(resolve(root, '.stealtheye/state/inspect-repo.json'), JSON.stringify(out, null, 2));
  return out;
}

function updateLatestPointer(relPath: string, payload: Record<string, unknown>, root = process.cwd()) {
  const absolute = resolve(root, `.stealtheye/${relPath}`);
  mkdirSync(resolve(absolute, '..'), { recursive: true });
  writeFileSync(absolute, JSON.stringify(payload, null, 2));
}
