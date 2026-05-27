import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from './bootstrap.js';

type QueueStatus = 'queued' | 'active' | 'validating' | 'complete' | 'blocked';
type RecoveryStrategy = 'retry' | 'retry-with-repair' | 'rollback-to-last-known-good' | 'escalate' | 'invariant-stop';

const VALID_TRANSITIONS: Record<QueueStatus, QueueStatus[]> = {
  queued: ['active'],
  active: ['validating', 'blocked'],
  validating: ['complete'],
  complete: [],
  blocked: ['active']
};

const PROCESS_VERSION = '1.2.0';
const COMPAT = { state: '^1.0.0', memory: '^1.0.0', replay: '^1.2.0', packet: '^1.0.0' };

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
  const activeTask = ((readJson(resolve(root, '.stealtheye/state/queue.json'), { items: [] }) as any).items || []).find((x: any) => x.status !== 'complete')?.id ?? 'phase0-main';
  const orderedCommands = Array.isArray(payload.commands) ? payload.commands as string[] : [processName];
  const validation = payload.validation_results ?? {};
  const dependencies = ['.stealtheye/state/project-state.json', '.stealtheye/state/queue.json', '.stealtheye/state/process-selector.json', '.stealtheye/state/memory-index.json'];
  const relevantFiles = dependencies.filter((f) => existsSync(resolve(root, f)));
  const digest = hashOf(root, [...relevantFiles, '.stealtheye/validation/readiness-report.json'].filter((f) => existsSync(resolve(root, f))));
  const replayConfidence = scoreReplayConfidence(validation, relevantFiles.length, orderedCommands.length);
  const receipt = {
    schema_version: '1.2.0',
    processName,
    process_version: PROCESS_VERSION,
    timestamp: new Date().toISOString(),
    ordered_commands: orderedCommands,
    active_task: activeTask,
    lifecycle_state: st.current_phase,
    state_inputs: ['project-state.json', 'queue.json', 'next-action.json'],
    memory_inputs: memory,
    graph_inputs: graphs,
    relevant_files: relevantFiles,
    validation_outputs: validation,
    replay_dependencies: dependencies,
    replay_confidence: replayConfidence,
    integrity: { sha256: digest, passed: digest.length > 0 },
    blockers: st.blockers,
    next_action: st.next_action,
    ...payload
  };
  const out = resolve(root, `.stealtheye/receipts/replay-${Date.now()}.json`);
  writeFileSync(out, JSON.stringify(receipt, null, 2));
  updateLatestPointer('receipts/latest-replay.json', receipt, root);
  return receipt;
}

export function enforceRetention(root = process.cwd()) {
  const dir = resolve(root, '.stealtheye/handoffs');
  if (!existsSync(dir)) return;
  const files = readdirSync(dir).filter((f) => f.startsWith('handoff-')).sort();
  const retention = { hot: 10, warm: 20, cold: 40, archival: 'compressed-summary', transient_artifact_cap: 120 };
  const toDelete = files.slice(0, Math.max(0, files.length - retention.cold));
  toDelete.forEach((f) => rmSync(resolve(dir, f)));
  const logs = readdirSync(resolve(root, '.stealtheye/logs')).length;
  writeFileSync(resolve(root, '.stealtheye/state/artifact-retention.json'), JSON.stringify({ retention, remaining: files.length - toDelete.length, supersession: { handoff: 'handoffs/latest.json', replay: 'receipts/latest-replay.json' }, anti_sprawl: { transient_artifacts: files.length + logs, over_cap: files.length + logs > retention.transient_artifact_cap } }, null, 2));
}

export function classifyBootstrapFailure(root = process.cwd()) {
  const classes: string[] = [];
  if (!existsSync(resolve(root, '.stealtheye/state/project-state.json'))) classes.push('missing state');
  if (!existsSync(resolve(root, '.stealtheye/processes/process-catalog.json'))) classes.push('missing process');
  if (!existsSync(resolve(root, '.stealtheye/state/memory-index.json'))) classes.push('missing memory');
  const state = readJson(resolve(root, '.stealtheye/state/project-state.json'), {});
  if ((state as any).schema_version && (state as any).schema_version !== '1.0.0') classes.push('incompatible state');
  const out = { status: classes.length ? 'failure' : 'ok', classes, remediation: classes.map((c) => ({ class: c, action: 'run npm run generate' })), corruption: stateCorruptionSignals(root) };
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
  const compatibility = compatibilityCheck(root);
  const corruption = stateCorruptionSignals(root);
  const report = { ok: !inconsistent && compatibility.compatible && corruption.signals.length === 0, drift_severity: (drift as any).severity, current_process: (selector as any).current, compatibility, corruption };
  if (!report.ok) throw new Error('cross-file-inconsistency');
  writeFileSync(resolve(root, '.stealtheye/validation/consistency-report.json'), JSON.stringify(report, null, 2));
  return report;
}

export function inspectRepo(root = process.cwd()) {
  const st = loadState(root);
  const selector = readJson(resolve(root, '.stealtheye/state/process-selector.json'), { current: 'phase0-build' });
  const readiness = readJson(resolve(root, '.stealtheye/validation/readiness-report.json'), { status: 'partial' });
  const drift = readJson(resolve(root, '.stealtheye/state/drift-report.json'), { severity: 'low' });
  const validationReliability = readJson(resolve(root, '.stealtheye/state/validation-reliability.json'), { score: 0.8 });
  const history = readJson(resolve(root, '.stealtheye/state/failure-pattern-memory.json'), { recurring: [] }) as any;
  const latestReplay = readJson(resolve(root, '.stealtheye/receipts/latest-replay.json'), { replay_confidence: 0.5 }) as any;
  const risk = operationalRisk((drift as any).severity, history.recurring?.length ?? 0, (validationReliability as any).score ?? 0.5, latestReplay.replay_confidence ?? 0.5);
  const nextAction = prioritizeNextAction(root);
  const recovery = chooseRecovery(root);
  const tier = readinessTier((readiness as any).status, risk.score);
  const capabilities = capabilityRegistry(root);
  const out = {
    current_phase: st.current_phase,
    current_process: (selector as any).current,
    process_version: PROCESS_VERSION,
    current_tier: tier,
    current_risk: risk,
    next_action: nextAction,
    recommended_worker: nextAction.recommended_worker,
    recovery_posture: recovery,
    replay_confidence: latestReplay.replay_confidence ?? 0.5,
    validation_health: validationReliability,
    confidence: {
      next_action: nextAction.confidence,
      replay_validity: latestReplay.replay_confidence ?? 0.5,
      recovery_recommendation: recovery.confidence,
      packet_completeness: 0.88,
      validation_reliability: (validationReliability as any).score ?? 0.5
    },
    autonomy_gain_opportunities: ['repair memory compaction', 'prefer agent-mode before codex'],
    codex_necessity_assessment: nextAction.recommended_worker === 'codex' ? 'needed' : 'avoidable',
    capabilities,
    readiness: (readiness as any).status,
    blockers: st.blockers
  };
  writeFileSync(resolve(root, '.stealtheye/state/inspect-repo.json'), JSON.stringify(out, null, 2));
  return out;
}

export function registerFailurePattern(event: Record<string, unknown>, root = process.cwd()) {
  const p = resolve(root, '.stealtheye/state/failure-pattern-memory.json');
  const data = readJson(p, { recurring: [], repair_intelligence: [] }) as any;
  data.recurring.push(event);
  data.recurring = data.recurring.slice(-60);
  data.repair_intelligence = summarizeRepairs(data.recurring);
  writeFileSync(p, JSON.stringify(data, null, 2));
}

function prioritizeNextAction(root = process.cwd()) {
  const drift = readJson(resolve(root, '.stealtheye/state/drift-report.json'), { severity: 'low' }) as any;
  const loop = readJson(resolve(root, '.stealtheye/state/loop-protection.json'), { repeated_failures: 0 }) as any;
  const severity = drift.severity === 'high' ? 1 : drift.severity === 'medium' ? 0.7 : 0.3;
  const score = 0.2 + severity * 0.25 + Math.min(0.2, loop.repeated_failures * 0.05) + 0.2 + 0.15 + 0.2;
  const recommended_worker = score > 0.85 ? 'codex' : score > 0.65 ? 'agent-mode' : 'normal-chatgpt';
  return { action: 'run validate/check chain', deterministic_priority: { urgency: severity, drift_severity: severity, readiness_impact: 0.8, recovery_impact: 0.7, autonomy_gain: 0.75, codex_avoidance_value: 0.9 }, score: Number(score.toFixed(3)), confidence: 0.84, recommended_worker };
}

function chooseRecovery(root = process.cwd()) {
  const history = readJson(resolve(root, '.stealtheye/state/failure-pattern-memory.json'), { recurring: [] }) as any;
  const failures = history.recurring.length;
  const strategy: RecoveryStrategy = failures > 10 ? 'rollback-to-last-known-good' : failures > 5 ? 'retry-with-repair' : 'retry';
  const recommendation = { strategy, confidence: failures > 10 ? 0.92 : 0.78, repair_attempt_history: history.recurring.slice(-5) };
  writeFileSync(resolve(root, '.stealtheye/state/recovery-engine.json'), JSON.stringify(recommendation, null, 2));
  return recommendation;
}

function compatibilityCheck(root: string) {
  const processCatalog = readJson(resolve(root, '.stealtheye/processes/process-catalog.json'), { version: '1.0.0' }) as any;
  const state = readJson(resolve(root, '.stealtheye/state/project-state.json'), { schema_version: '1.0.0' }) as any;
  const replay = readJson(resolve(root, '.stealtheye/receipts/latest-replay.json'), { schema_version: '1.2.0' }) as any;
  const compatible = String(processCatalog.version ?? '1.0.0').startsWith('1.') && String(state.schema_version).startsWith('1.') && String(replay.schema_version ?? '1.2.0').startsWith('1.');
  return { compatible, process_version: processCatalog.version ?? PROCESS_VERSION, expected: COMPAT };
}

function capabilityRegistry(root: string) {
  const scripts = Object.keys((JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as any).scripts ?? {});
  const validations = readdirSync(resolve(root, '.stealtheye/validation')).filter((x) => x.endsWith('.json'));
  const graphOutputs = readdirSync(resolve(root, '.stealtheye/graphs')).filter((x) => x.endsWith('.json'));
  const packetTypes = ['pr-packet', 'replay-receipt', 'diagnostic'];
  const registry = { scripts, validations, packet_types: packetTypes, graph_outputs: graphOutputs, diagnostics: ['bootstrap-diagnostics', 'consistency-report'], recovery_systems: ['recovery-engine', 'loop-protection'], memory_systems: ['memory-index', 'failure-pattern-memory'], routing_systems: ['process-selector', 'worker-recommendation'] };
  writeFileSync(resolve(root, '.stealtheye/state/capability-registry.json'), JSON.stringify(registry, null, 2));
  return registry;
}

function summarizeRepairs(recurring: any[]) {
  const byCommand = new Map<string, number>();
  for (const r of recurring) byCommand.set(String(r.command ?? 'unknown'), (byCommand.get(String(r.command ?? 'unknown')) ?? 0) + 1);
  return [...byCommand.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([command, count]) => ({ command, count, recommendation: `retry-with-repair:${command}`, confidence: Math.min(0.95, 0.55 + count * 0.05) }));
}

function stateCorruptionSignals(root: string) {
  const signals: string[] = [];
  const remediation: Array<Record<string, string>> = [];
  const queue = readJson(resolve(root, '.stealtheye/state/queue.json'), { items: [] }) as any;
  if (!Array.isArray(queue.items)) {
    signals.push('malformed state');
    remediation.push({ signal: 'malformed state', action: 'regenerate queue.json with npm run generate' });
  }
  if ((queue.items || []).some((x: any) => !VALID_TRANSITIONS[x.status as QueueStatus] && x.status !== 'complete')) {
    signals.push('impossible lifecycle state');
    remediation.push({ signal: 'impossible lifecycle state', action: 'reset lifecycle to queued->active via transitionTask' });
  }
  if (existsSync(resolve(root, '.stealtheye/state/latest-queue.json')) && existsSync(resolve(root, '.stealtheye/receipts/latest-replay.json'))) {
    const latestQueue = readJson(resolve(root, '.stealtheye/state/latest-queue.json'), {}) as any;
    const replay = readJson(resolve(root, '.stealtheye/receipts/latest-replay.json'), {}) as any;
    if (latestQueue.status === 'complete' && replay.processName === 'generate') {
      signals.push('replay mismatch');
      remediation.push({ signal: 'replay mismatch', action: 'rerun check chain to refresh replay pointer' });
    }
  }
  return { signals, remediation };
}

function operationalRisk(driftSeverity: string, repeatFailures: number, validationScore: number, replayConfidence: number) {
  const drift = driftSeverity === 'high' ? 0.9 : driftSeverity === 'medium' ? 0.6 : 0.3;
  const score = Number((drift * 0.28 + Math.min(1, repeatFailures / 10) * 0.24 + (1 - validationScore) * 0.2 + (1 - replayConfidence) * 0.16 + 0.06 + 0.06).toFixed(3));
  return { score, factors: { drift, lifecycle_instability: Math.min(1, repeatFailures / 10), replay_uncertainty: 1 - replayConfidence, repeated_failures: Math.min(1, repeatFailures / 10), weak_memory_coverage: 0.3, weak_validation_coverage: 1 - validationScore } };
}

function readinessTier(readiness: string, riskScore: number) {
  if (riskScore > 0.75) return 'degraded';
  if (readiness === 'validated' && riskScore < 0.25) return 'autonomous';
  if (readiness === 'validated' && riskScore < 0.45) return 'resilient';
  if (readiness === 'partial') return 'operational';
  return 'bootstrap';
}


function scoreReplayConfidence(validation: any, fileCount: number, commandCount: number) {
  const validationBoost = validation && (validation.ok === true || validation.status === 'validated') ? 0.4 : 0.2;
  const coverage = Math.min(0.35, fileCount * 0.05);
  const commandStability = Math.min(0.25, commandCount * 0.03);
  return Number((validationBoost + coverage + commandStability).toFixed(3));
}

function hashOf(root: string, relFiles: string[]) {
  const hash = createHash('sha256');
  for (const file of relFiles) {
    const abs = resolve(root, file);
    if (!existsSync(abs)) continue;
    const s = statSync(abs);
    hash.update(file + ':' + s.size + ':' + s.mtimeMs);
  }
  return hash.digest('hex');
}

function updateLatestPointer(relPath: string, payload: Record<string, unknown>, root = process.cwd()) {
  const absolute = resolve(root, `.stealtheye/${relPath}`);
  mkdirSync(resolve(absolute, '..'), { recursive: true });
  writeFileSync(absolute, JSON.stringify(payload, null, 2));
}
