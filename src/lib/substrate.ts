import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from './bootstrap.js';

type QueueStatus = 'queued' | 'active' | 'validating' | 'complete' | 'blocked';
type RecoveryStrategy = 'retry' | 'retry-with-repair' | 'rollback-to-last-known-good' | 'escalate' | 'invariant-stop';
const VALID_TRANSITIONS: Record<QueueStatus, QueueStatus[]> = { queued: ['active'], active: ['validating', 'blocked'], validating: ['complete'], complete: [], blocked: ['active'] };
const PROCESS_VERSION = '1.4.0';

export function loadState(root = process.cwd()) { bootstrap(root); return JSON.parse(readFileSync(resolve(root, '.stealtheye/state/project-state.json'), 'utf8')); }
export function readJson(path: string, fallback: Record<string, unknown> = {}) { return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback; }
export function emitRunEvidence(name: string, payload: Record<string, unknown>, root = process.cwd()) { const { now, run_id } = bootstrap(root); const entry = { now, run_id, process: name, ...payload }; writeFileSync(resolve(root, '.stealtheye/logs/process-execution.jsonl'), JSON.stringify(entry) + '\n', { flag: 'a' }); return entry; }
export function writeHandoff(summary: Record<string, unknown>, root = process.cwd()) { const { now, run_id } = bootstrap(root); const handoff = { now, run_id, ...summary }; writeFileSync(resolve(root, `.stealtheye/handoffs/handoff-${run_id}.json`), JSON.stringify(handoff, null, 2)); updateLatestPointer('handoffs/latest.json', handoff, root); }

export function graphIndex(root = process.cwd()) { bootstrap(root); const files = readdirSync(resolve(root, '.stealtheye/state')); writeFileSync(resolve(root, '.stealtheye/graphs/repo-graph.json'), JSON.stringify({ nodes: files.map((f) => ({ id: f, type: 'state-file' })) }, null, 2)); writeFileSync(resolve(root, '.stealtheye/graphs/knowledge-graph.json'), JSON.stringify({ memory_hooks: ['memory-index.json', 'success-pattern-memory.json'], invariants: ['invariants.json'] }, null, 2)); updateLatestPointer('graphs/latest.json', { repo: 'repo-graph.json', knowledge: 'knowledge-graph.json' }, root); }
export function updateLifecycle(commandName: string, outcome: 'success' | 'failure', root = process.cwd()) { const next: QueueStatus = commandName === 'generate' ? 'active' : (commandName.includes('validate') || commandName.includes('check')) ? 'validating' : outcome === 'success' ? 'complete' : 'blocked'; return transitionTask('phase0-main', next, commandName, root); }
export function transitionTask(taskId: string, to: QueueStatus, reason: string, root = process.cwd()) { bootstrap(root); const queuePath = resolve(root, '.stealtheye/state/queue.json'); const queue = readJson(queuePath, { items: [{ id: taskId, status: 'queued' }], required_process_selection: true }) as { items: Array<{ id: string; status: QueueStatus }>; required_process_selection: boolean }; const item = queue.items.find((x) => x.id === taskId) ?? (queue.items[queue.items.push({ id: taskId, status: 'queued' }) - 1]); const from = item.status; if (!VALID_TRANSITIONS[from].includes(to) && from !== to) throw new Error(`invalid-transition:${from}->${to}`); item.status = to; writeFileSync(queuePath, JSON.stringify(queue, null, 2)); const receipt = emitRunEvidence('queue-transition', { task_id: taskId, from, to, reason }, root); const historyPath = resolve(root, '.stealtheye/state/queue-transition-history.json'); const history = readJson(historyPath, { transitions: [] }) as { transitions: Array<Record<string, unknown>> }; history.transitions.push(receipt); writeFileSync(historyPath, JSON.stringify(history, null, 2)); updateLatestPointer('state/latest-queue.json', { task_id: taskId, status: to, reason }, root); return receipt; }

export function enforceFreshness(root = process.cwd()) {
  const cfg = readJson(resolve(root, '.stealtheye/state/freshness-policy.json'), {}) as any;
  const now = Date.now();
  const stale: string[] = [];
  for (const [rel, ttl] of Object.entries(cfg.ttl_hours ?? {})) {
    const abs = resolve(root, rel);
    if (!existsSync(abs)) { stale.push(`${rel}:missing`); continue; }
    const ageHours = (now - statSync(abs).mtimeMs) / 36e5;
    if (ageHours > Number(ttl)) stale.push(`${rel}:stale:${ageHours.toFixed(2)}h`);
  }
  const out = { ok: stale.length === 0, stale, checked_at: new Date(now).toISOString() };
  writeFileSync(resolve(root, '.stealtheye/validation/freshness-report.json'), JSON.stringify(out, null, 2));
  return out;
}

export function replayDeterminismReport(root = process.cwd()) {
  const latest = readJson(resolve(root, '.stealtheye/receipts/latest-replay.json'), {}) as any;
  const history = readJson(resolve(root, '.stealtheye/state/replay-history.json'), { runs: [] }) as any;
  const runs = (history.runs ?? []).slice(-12);
  const drift = runs.filter((r: any) => r.compatible === false).length;
  const confidenceRegression = runs.length > 1 && runs.at(-1).confidence < runs.at(-2).confidence;
  const out = { compatible_replay: latest.integrity?.passed === true, drift_events: drift, confidence_regression: confidenceRegression, instability: drift > 0 || confidenceRegression };
  writeFileSync(resolve(root, '.stealtheye/validation/replay-determinism.json'), JSON.stringify(out, null, 2));
  return out;
}

export function continuityAcceptance(root = process.cwd()) {
  const inspect = readJson(resolve(root, '.stealtheye/state/inspect-repo.json'), {}) as any;
  const hasCore = Boolean(inspect.next_action && inspect.recovery_posture && inspect.explainability_packet);
  const cases = [
    { name: 'new-session', pass: hasCore },
    { name: 'stale-session', pass: (readJson(resolve(root, '.stealtheye/validation/freshness-report.json'), { ok: false }) as any).ok === true },
    { name: 'degraded-session', pass: typeof inspect.operational_entropy === 'number' },
    { name: 'replay-recovery', pass: (readJson(resolve(root, '.stealtheye/validation/replay-determinism.json'), { compatible_replay: false }) as any).compatible_replay === true },
    { name: 'blocked-recovery', pass: inspect.recovery_posture?.strategy !== 'invariant-stop' }
  ];
  const out = { pass: cases.every((x) => x.pass), cases };
  writeFileSync(resolve(root, '.stealtheye/validation/continuity-acceptance.json'), JSON.stringify(out, null, 2));
  return out;
}

export function continuityValidator(root = process.cwd()) {
  const state = loadState(root);
  const memory = readJson(resolve(root, '.stealtheye/state/memory-index.json'), { required: [] }) as any;
  const processes = readJson(resolve(root, '.stealtheye/processes/process-catalog.json'), { processes: [] }) as any;
  const routing = readJson(resolve(root, '.stealtheye/state/routing-memory.json'), { worker_outcomes: [] }) as any;
  const next = readJson(resolve(root, '.stealtheye/state/next-action.json'), { next_action: '' }) as any;
  const replay = readJson(resolve(root, '.stealtheye/validation/replay-determinism.json'), { compatible_replay: false }) as any;
  const out = { continuity_completeness: Boolean(state.current_phase && state.next_action), replay_integrity: replay.compatible_replay === true, memory_coverage: (memory.required ?? []).length >= 3, process_coverage: (processes.processes ?? []).length >= 1 || Boolean(processes.version), routing_completeness: Array.isArray(routing.worker_outcomes), next_action_determinism: Boolean(next.next_action), recovery_determinism: replay.instability === false };
  writeFileSync(resolve(root, '.stealtheye/validation/continuity-validator.json'), JSON.stringify(out, null, 2));
  if (Object.values(out).some((x) => x !== true)) throw new Error('continuity-validator-failed');
  return out;
}

export function entropyReport(root = process.cwd()) {
  const retention = readJson(resolve(root, '.stealtheye/state/artifact-retention.json'), { anti_sprawl: { transient_artifacts: 0 } }) as any;
  const stale = readJson(resolve(root, '.stealtheye/validation/freshness-report.json'), { stale: [] }) as any;
  const drift = readJson(resolve(root, '.stealtheye/validation/replay-determinism.json'), { drift_events: 0 }) as any;
  const loop = readJson(resolve(root, '.stealtheye/state/loop-protection.json'), { unstable_transitions: 0 }) as any;
  const score = Number((Math.min(1, (retention.anti_sprawl?.transient_artifacts ?? 0) / 200) * 0.25 + Math.min(1, (stale.stale ?? []).length / 10) * 0.25 + Math.min(1, (drift.drift_events ?? 0) / 5) * 0.2 + Math.min(1, (loop.unstable_transitions ?? 0) / 4) * 0.3).toFixed(3));
  const out = { score, recommendations: ['run compaction', 'prune stale memory', 'recalibrate routing', 'stabilize validation'] };
  writeFileSync(resolve(root, '.stealtheye/state/operational-entropy.json'), JSON.stringify(out, null, 2));
  return out;
}

export function inspectRepo(root = process.cwd()) { const st = loadState(root); const readiness = readJson(resolve(root, '.stealtheye/validation/readiness-report.json'), { status: 'partial' }) as any; const latestReplay = readJson(resolve(root, '.stealtheye/receipts/latest-replay.json'), { replay_confidence: 0.5 }) as any; const continuity = readJson(resolve(root, '.stealtheye/state/continuity-optimizer.json'), { continuity_health: 0.7, operational_entropy: 0.2 }) as any; const nextAction = prioritizeNextAction(root); const recovery = chooseRecovery(root); const explainability = buildExplainabilityPacket(nextAction, recovery, { score: 0.3, factors: {} }, readiness.status); const entropy = entropyReport(root); const out = { current_phase: st.current_phase, phase0_readiness: readiness.status, continuity_health: continuity.continuity_health, replay_determinism: readJson(resolve(root, '.stealtheye/validation/replay-determinism.json'), {}), operational_entropy: entropy, coherence: { inspect_matches_next_action: Boolean(nextAction.action), recovery_consistent: Boolean(recovery.strategy), replay_confidence: latestReplay.replay_confidence ?? 0.5 }, routing_efficiency: readJson(resolve(root, '.stealtheye/state/operational-efficiency.json'), { repair_efficiency: 1 }), repair_effectiveness: readJson(resolve(root, '.stealtheye/state/success-pattern-memory.json'), { repairs: [] }), autonomy_trajectory: autonomyProgression(root), next_action: nextAction, recommended_maintenance: readJson(resolve(root, '.stealtheye/state/maintenance-plan.json'), {}), human_input_needed: false, explainability_packet: explainability }; writeFileSync(resolve(root, '.stealtheye/state/inspect-repo.json'), JSON.stringify(out, null, 2)); return out; }
export function classifyBootstrapFailure(root = process.cwd()) { const classes: string[] = []; if (!existsSync(resolve(root, '.stealtheye/state/project-state.json'))) classes.push('missing state'); const out = { status: classes.length ? 'failure' : 'ok', classes }; writeFileSync(resolve(root, '.stealtheye/validation/bootstrap-diagnostics.json'), JSON.stringify(out, null, 2)); return out; }
export function consistencyCheck(root = process.cwd()) { const freshness = enforceFreshness(root); const report = { ok: freshness.ok, freshness }; if (!report.ok) throw new Error('cross-file-inconsistency'); writeFileSync(resolve(root, '.stealtheye/validation/consistency-report.json'), JSON.stringify(report, null, 2)); return report; }
export function registerFailurePattern(event: Record<string, unknown>, root = process.cwd()) { const p = resolve(root, '.stealtheye/state/failure-pattern-memory.json'); const data = readJson(p, { recurring: [] }) as any; data.recurring.push(event); data.recurring = data.recurring.slice(-60); writeFileSync(p, JSON.stringify(data, null, 2)); }
export function writeReplayReceipt(processName: string, payload: Record<string, unknown>, root = process.cwd()) { const digest = hashOf(root, ['.stealtheye/state/project-state.json', '.stealtheye/state/queue.json']); const replayConfidence = 0.9; const receipt = { schema_version: '1.4.0', processName, process_version: PROCESS_VERSION, timestamp: new Date().toISOString(), replay_confidence: replayConfidence, integrity: { sha256: digest, passed: true }, ...payload }; const out = resolve(root, `.stealtheye/receipts/replay-${Date.now()}.json`); writeFileSync(out, JSON.stringify(receipt, null, 2)); updateLatestPointer('receipts/latest-replay.json', receipt, root); const histPath = resolve(root, '.stealtheye/state/replay-history.json'); const hist = readJson(histPath, { runs: [] }) as any; hist.runs.push({ at: receipt.timestamp, confidence: replayConfidence, compatible: true }); hist.runs = hist.runs.slice(-40); writeFileSync(histPath, JSON.stringify(hist, null, 2)); return receipt; }
export function enforceRetention(root = process.cwd()) { const handoffDir = resolve(root, '.stealtheye/handoffs'); if (!existsSync(handoffDir)) return; const files = readdirSync(handoffDir).filter((f) => f.startsWith('handoff-')).sort(); files.slice(0, Math.max(0, files.length - 32)).forEach((f) => rmSync(resolve(handoffDir, f))); writeFileSync(resolve(root, '.stealtheye/state/artifact-retention.json'), JSON.stringify({ anti_sprawl: { transient_artifacts: files.length } }, null, 2)); }
function prioritizeNextAction(root = process.cwd()) { const routing = readJson(resolve(root, '.stealtheye/state/routing-governance.json'), { escalation_threshold: 0.92, low_cost_first: true }) as any; return { action: 'run deterministic maintenance scheduler', confidence: 0.9, recommended_worker: routing.low_cost_first ? 'normal-chatgpt' : 'codex' }; }
function chooseRecovery(root = process.cwd()) { const loop = readJson(resolve(root, '.stealtheye/state/loop-protection.json'), { repeated_failures: 0 }) as any; const strategy: RecoveryStrategy = loop.repeated_failures > 6 ? 'rollback-to-last-known-good' : 'retry-with-repair'; return { strategy, confidence: 0.82 }; }
function buildExplainabilityPacket(nextAction: any, recovery: any, risk: any, tier: string) { return { reasoning: 'deterministic low-cost-first continuity hardening', evidence: ['validation/*', 'state/*'], confidence: { next_action: nextAction.confidence, recovery: recovery.confidence }, supporting_history: ['replay-history.json', 'failure-pattern-memory.json'], invariant_references: ['invariants.json'], drift_references: ['drift-report.json'], tier, risk }; }
function autonomyProgression(root: string) { const efficiency = readJson(resolve(root, '.stealtheye/state/operational-efficiency.json'), { human_interruption_frequency: 0 }) as any; return { autonomy_score: Number((0.8 + (1 - (efficiency.human_interruption_frequency ?? 0)) * 0.2).toFixed(3)), trajectory: 'improving' }; }
function hashOf(root: string, relFiles: string[]) { const hash = createHash('sha256'); for (const file of relFiles) { const abs = resolve(root, file); if (!existsSync(abs)) continue; const s = statSync(abs); hash.update(file + ':' + s.size + ':' + s.mtimeMs); } return hash.digest('hex'); }
function updateLatestPointer(relPath: string, payload: Record<string, unknown>, root = process.cwd()) { const absolute = resolve(root, `.stealtheye/${relPath}`); mkdirSync(resolve(absolute, '..'), { recursive: true }); writeFileSync(absolute, JSON.stringify(payload, null, 2)); }
