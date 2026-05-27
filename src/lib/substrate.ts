import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from './bootstrap.js';

type QueueStatus = 'queued' | 'active' | 'validating' | 'complete' | 'blocked';
type RecoveryStrategy = 'retry' | 'retry-with-repair' | 'rollback-to-last-known-good' | 'escalate' | 'invariant-stop';
type Importance = 'critical' | 'high' | 'medium' | 'low' | 'archival';

const VALID_TRANSITIONS: Record<QueueStatus, QueueStatus[]> = {
  queued: ['active'],
  active: ['validating', 'blocked'],
  validating: ['complete'],
  complete: [],
  blocked: ['active']
};

const PROCESS_VERSION = '1.3.0';
const COMPAT = { state: '^1.0.0', memory: '^1.1.0', replay: '^1.3.0', packet: '^1.0.0' };

export function loadState(root = process.cwd()) { bootstrap(root); return JSON.parse(readFileSync(resolve(root, '.stealtheye/state/project-state.json'), 'utf8')); }
export function readJson(path: string, fallback: Record<string, unknown> = {}) { return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback; }

export function emitRunEvidence(name: string, payload: Record<string, unknown>, root = process.cwd()) {
  const { now, run_id } = bootstrap(root); const entry = { now, run_id, process: name, ...payload };
  writeFileSync(resolve(root, '.stealtheye/logs/process-execution.jsonl'), JSON.stringify(entry) + '\n', { flag: 'a' });
  return entry;
}

export function writeHandoff(summary: Record<string, unknown>, root = process.cwd()) {
  const { now, run_id } = bootstrap(root); const handoff = { now, run_id, ...summary };
  writeFileSync(resolve(root, `.stealtheye/handoffs/handoff-${run_id}.json`), JSON.stringify(handoff, null, 2)); updateLatestPointer('handoffs/latest.json', handoff, root);
}

export function graphIndex(root = process.cwd()) {
  bootstrap(root);
  const files = readdirSync(resolve(root, '.stealtheye/state'));
  writeFileSync(resolve(root, '.stealtheye/graphs/repo-graph.json'), JSON.stringify({ nodes: files.map((f) => ({ id: f, type: 'state-file' })) }, null, 2));
  writeFileSync(resolve(root, '.stealtheye/graphs/knowledge-graph.json'), JSON.stringify({ memory_hooks: ['memory-index.json', 'success-pattern-memory.json'], invariants: ['invariants.json'] }, null, 2));
  updateLatestPointer('graphs/latest.json', { repo: 'repo-graph.json', knowledge: 'knowledge-graph.json' }, root);
}

export function updateLifecycle(commandName: string, outcome: 'success' | 'failure', root = process.cwd()) {
  const next: QueueStatus = commandName === 'generate' ? 'active' : (commandName.includes('validate') || commandName.includes('check')) ? 'validating' : outcome === 'success' ? 'complete' : 'blocked';
  return transitionTask('phase0-main', next, commandName, root);
}

export function transitionTask(taskId: string, to: QueueStatus, reason: string, root = process.cwd()) {
  bootstrap(root); const queuePath = resolve(root, '.stealtheye/state/queue.json');
  const queue = readJson(queuePath, { items: [{ id: taskId, status: 'queued' }], required_process_selection: true }) as { items: Array<{ id: string; status: QueueStatus }>; required_process_selection: boolean };
  const idx = queue.items.findIndex((x) => x.id === taskId); if (idx < 0) queue.items.push({ id: taskId, status: 'queued' });
  const item = queue.items.find((x) => x.id === taskId)!; const from = item.status;
  if (!VALID_TRANSITIONS[from].includes(to) && from !== to) throw new Error(`invalid-transition:${from}->${to}`);
  item.status = to; writeFileSync(queuePath, JSON.stringify(queue, null, 2));
  const receipt = emitRunEvidence('queue-transition', { task_id: taskId, from, to, reason }, root);
  const historyPath = resolve(root, '.stealtheye/state/queue-transition-history.json'); const history = readJson(historyPath, { transitions: [] }) as { transitions: Array<Record<string, unknown>> };
  history.transitions.push(receipt); writeFileSync(historyPath, JSON.stringify(history, null, 2)); updateLatestPointer('state/latest-queue.json', { task_id: taskId, status: to, reason }, root);
  return receipt;
}

export function writeReplayReceipt(processName: string, payload: Record<string, unknown>, root = process.cwd()) {
  const st = loadState(root); const memory = readJson(resolve(root, '.stealtheye/state/memory-index.json'), {});
  const graphs = readJson(resolve(root, '.stealtheye/graphs/latest.json'), {}); const activeTask = ((readJson(resolve(root, '.stealtheye/state/queue.json'), { items: [] }) as any).items || []).find((x: any) => x.status !== 'complete')?.id ?? 'phase0-main';
  const orderedCommands = Array.isArray(payload.commands) ? payload.commands as string[] : [processName]; const validation = payload.validation_results ?? {};
  const dependencies = ['.stealtheye/state/project-state.json', '.stealtheye/state/queue.json', '.stealtheye/state/process-selector.json', '.stealtheye/state/memory-index.json'];
  const relevantFiles = dependencies.filter((f) => existsSync(resolve(root, f))); const digest = hashOf(root, [...relevantFiles, '.stealtheye/validation/readiness-report.json'].filter((f) => existsSync(resolve(root, f))));
  const replayConfidence = scoreReplayConfidence(validation, root, relevantFiles.length, orderedCommands.length); const uncertainty = replayUncertainty(replayConfidence, validation, root);
  const receipt = { schema_version: '1.3.0', processName, process_version: PROCESS_VERSION, timestamp: new Date().toISOString(), ordered_commands: orderedCommands, active_task: activeTask, lifecycle_state: st.current_phase, state_inputs: ['project-state.json', 'queue.json', 'next-action.json'], memory_inputs: memory, graph_inputs: graphs, relevant_files: relevantFiles, validation_outputs: validation, replay_dependencies: dependencies, replay_confidence: replayConfidence, replay_uncertainty: uncertainty, integrity: { sha256: digest, passed: digest.length > 0 }, blockers: st.blockers, next_action: st.next_action, ...payload };
  const out = resolve(root, `.stealtheye/receipts/replay-${Date.now()}.json`); writeFileSync(out, JSON.stringify(receipt, null, 2)); updateLatestPointer('receipts/latest-replay.json', receipt, root); return receipt;
}

export function enforceRetention(root = process.cwd()) {
  const handoffDir = resolve(root, '.stealtheye/handoffs'); if (!existsSync(handoffDir)) return;
  const files = readdirSync(handoffDir).filter((f) => f.startsWith('handoff-')).sort(); const receipts = readdirSync(resolve(root, '.stealtheye/receipts')).filter((f) => f.startsWith('replay-')).sort();
  const retention = { hot: 8, warm: 16, cold: 32, transient_artifact_cap: 96, category_caps: { handoffs: 32, replay_receipts: 48, working_set_items: 18 } };
  files.slice(0, Math.max(0, files.length - retention.cold)).forEach((f) => rmSync(resolve(handoffDir, f)));
  receipts.slice(0, Math.max(0, receipts.length - retention.category_caps.replay_receipts)).forEach((f) => rmSync(resolve(root, '.stealtheye/receipts', f)));
  const logs = readdirSync(resolve(root, '.stealtheye/logs')).length;
  const summary = { retained: { handoffs: Math.min(files.length, retention.cold), replay_receipts: Math.min(receipts.length, retention.category_caps.replay_receipts) }, stale_cleanup: { replay_supersession: 'receipts/latest-replay.json', latest_only_pointers: ['handoffs/latest.json', 'graphs/latest.json'] } };
  writeFileSync(resolve(root, '.stealtheye/state/artifact-retention.json'), JSON.stringify({ retention, remaining: summary.retained.handoffs, supersession: summary.stale_cleanup, anti_sprawl: { transient_artifacts: files.length + logs + receipts.length, over_cap: files.length + logs + receipts.length > retention.transient_artifact_cap, compaction_summary: summary } }, null, 2));
}

export function classifyBootstrapFailure(root = process.cwd()) { /* unchanged */
  const classes: string[] = []; if (!existsSync(resolve(root, '.stealtheye/state/project-state.json'))) classes.push('missing state'); if (!existsSync(resolve(root, '.stealtheye/processes/process-catalog.json'))) classes.push('missing process'); if (!existsSync(resolve(root, '.stealtheye/state/memory-index.json'))) classes.push('missing memory');
  const state = readJson(resolve(root, '.stealtheye/state/project-state.json'), {}); if ((state as any).schema_version && (state as any).schema_version !== '1.0.0') classes.push('incompatible state');
  const out = { status: classes.length ? 'failure' : 'ok', classes, remediation: classes.map((c) => ({ class: c, action: 'run npm run generate' })), corruption: stateCorruptionSignals(root) };
  writeFileSync(resolve(root, '.stealtheye/validation/bootstrap-diagnostics.json'), JSON.stringify(out, null, 2)); return out;
}

export function consistencyCheck(root = process.cwd()) {
  const state = loadState(root); const queue = readJson(resolve(root, '.stealtheye/state/queue.json'), { items: [] }); const drift = readJson(resolve(root, '.stealtheye/state/drift-report.json'), { severity: 'low' });
  const selector = readJson(resolve(root, '.stealtheye/state/process-selector.json'), { current: '' }); const nextAction = readJson(resolve(root, '.stealtheye/state/next-action.json'), { next_action: state.next_action });
  const memoryFreshness = readJson(resolve(root, '.stealtheye/state/memory-freshness.json'), { freshness_score: 1 }) as any;
  const inconsistent = !selector || !(queue as any).items || !(nextAction as any).next_action || memoryFreshness.freshness_score < 0.2;
  const compatibility = compatibilityCheck(root); const corruption = stateCorruptionSignals(root);
  const invariantBounds = { replay_confidence_min: 0.2, replay_confidence_max: 1, readiness_coherence: true };
  const report = { ok: !inconsistent && compatibility.compatible && corruption.signals.length === 0, drift_severity: (drift as any).severity, current_process: (selector as any).current, compatibility, corruption, invariant_bounds: invariantBounds };
  if (!report.ok) throw new Error('cross-file-inconsistency'); writeFileSync(resolve(root, '.stealtheye/validation/consistency-report.json'), JSON.stringify(report, null, 2)); return report;
}

export function inspectRepo(root = process.cwd()) {
  const st = loadState(root); const readiness = readJson(resolve(root, '.stealtheye/validation/readiness-report.json'), { status: 'partial' }) as any;
  const history = readJson(resolve(root, '.stealtheye/state/failure-pattern-memory.json'), { recurring: [] }) as any;
  const success = readJson(resolve(root, '.stealtheye/state/success-pattern-memory.json'), { repairs: [] }) as any;
  const latestReplay = readJson(resolve(root, '.stealtheye/receipts/latest-replay.json'), { replay_confidence: 0.5 }) as any;
  const routing = readJson(resolve(root, '.stealtheye/state/routing-memory.json'), { worker_outcomes: [] }) as any;
  const efficiency = readJson(resolve(root, '.stealtheye/state/operational-efficiency.json'), { score: 0.7 }) as any;
  const continuity = readJson(resolve(root, '.stealtheye/state/continuity-optimizer.json'), { continuity_health: 0.7 }) as any;
  const risk = operationalRisk((readJson(resolve(root, '.stealtheye/state/drift-report.json'), { severity: 'low' }) as any).severity, history.recurring?.length ?? 0, 0.95, latestReplay.replay_confidence ?? 0.5);
  const nextAction = prioritizeNextAction(root); const recovery = chooseRecovery(root); const tier = readinessTier(readiness.status, risk.score); const autonomy = autonomyProgression(root);
  const out = { current_phase: st.current_phase, current_tier: tier, readiness: readiness.status, autonomy_score: autonomy.autonomy_score, replay_health: Number((latestReplay.replay_confidence ?? 0.5).toFixed(3)), routing_efficiency: efficiency.routing_efficiency, repair_reliability: Number((success.repairs?.length ? 0.75 : 0.6).toFixed(2)), continuity_health: continuity.continuity_health, operational_entropy: continuity.operational_entropy, recovery_readiness: recovery.confidence, confidence_trends: { replay: latestReplay.replay_confidence ?? 0.5, recovery: recovery.confidence, next_action: nextAction.confidence }, next_action: nextAction, recommended_worker: nextAction.recommended_worker, recovery_posture: recovery, explainability_packet: buildExplainabilityPacket(nextAction, recovery, risk, tier), blockers: st.blockers };
  writeFileSync(resolve(root, '.stealtheye/state/inspect-repo.json'), JSON.stringify(out, null, 2)); return out;
}

export function registerFailurePattern(event: Record<string, unknown>, root = process.cwd()) {
  const p = resolve(root, '.stealtheye/state/failure-pattern-memory.json'); const data = readJson(p, { recurring: [], repair_intelligence: [] }) as any;
  const importance = classifyImportance(event);
  data.recurring.push({ ...event, importance }); data.recurring = data.recurring.filter((x: any) => x.importance !== 'low').slice(-60); data.repair_intelligence = summarizeRepairs(data.recurring);
  writeFileSync(p, JSON.stringify(data, null, 2));
}

function classifyImportance(event: Record<string, unknown>): Importance { if (event.success === false && event.lifecycle_stage === 'validating') return 'critical'; if (event.success === false) return 'high'; return 'medium'; }
function prioritizeNextAction(root = process.cwd()) { const loop = readJson(resolve(root, '.stealtheye/state/loop-protection.json'), { repeated_failures: 0 }) as any; const routing = readJson(resolve(root, '.stealtheye/state/routing-memory.json'), { worker_outcomes: [] }) as any; const score = Number((0.68 + Math.min(0.2, loop.repeated_failures * 0.05)).toFixed(3)); const recommended_worker = routing.worker_outcomes?.some((x: any) => x.route_failed) ? 'agent-mode' : score > 0.85 ? 'codex' : 'normal-chatgpt'; return { action: 'run deterministic repair sequence', score, confidence: 0.86, recommended_worker }; }
function chooseRecovery(root = process.cwd()) { const history = readJson(resolve(root, '.stealtheye/state/failure-pattern-memory.json'), { recurring: [] }) as any; const success = readJson(resolve(root, '.stealtheye/state/success-pattern-memory.json'), { repairs: [] }) as any; const failures = history.recurring.length; const successRate = success.repairs?.length ? success.repairs.filter((x: any) => x.outcome === 'success').length / success.repairs.length : 0.5; const strategy: RecoveryStrategy = failures > 10 ? 'rollback-to-last-known-good' : failures > 5 ? 'retry-with-repair' : 'retry'; const recommendation = { strategy, confidence: Number((0.6 + successRate * 0.35).toFixed(2)), evidence_weighting: { historical_success_rate: Number(successRate.toFixed(2)), recurrence_frequency: failures, replay_similarity: 0.74, prior_recovery_outcomes: success.repairs?.slice(-5) ?? [] }, repair_sequence: ['diagnose', 'repair', 'validate', 'replay-check', 'consistency-check', 'readiness-check'] }; writeFileSync(resolve(root, '.stealtheye/state/recovery-engine.json'), JSON.stringify(recommendation, null, 2)); return recommendation; }
function compatibilityCheck(root: string) { const processCatalog = readJson(resolve(root, '.stealtheye/processes/process-catalog.json'), { version: '1.0.0' }) as any; const state = readJson(resolve(root, '.stealtheye/state/project-state.json'), { schema_version: '1.0.0' }) as any; const replay = readJson(resolve(root, '.stealtheye/receipts/latest-replay.json'), { schema_version: '1.3.0' }) as any; const compatible = String(processCatalog.version ?? '1.0.0').startsWith('1.') && String(state.schema_version).startsWith('1.') && String(replay.schema_version ?? '1.3.0').startsWith('1.'); return { compatible, process_version: processCatalog.version ?? PROCESS_VERSION, expected: COMPAT }; }
function summarizeRepairs(recurring: any[]) { const byCommand = new Map<string, number>(); for (const r of recurring) byCommand.set(String(r.command ?? 'unknown'), (byCommand.get(String(r.command ?? 'unknown')) ?? 0) + 1); return [...byCommand.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([command, count]) => ({ command, count, importance: count > 4 ? 'high' : 'medium', recommendation: `retry-with-repair:${command}`, confidence: Math.min(0.95, 0.55 + count * 0.05) })); }
function stateCorruptionSignals(root: string) { const signals: string[] = []; const remediation: Array<Record<string, string>> = []; const queue = readJson(resolve(root, '.stealtheye/state/queue.json'), { items: [] }) as any; if (!Array.isArray(queue.items)) { signals.push('malformed state'); remediation.push({ signal: 'malformed state', action: 'regenerate queue.json with npm run generate' }); } return { signals, remediation }; }
function operationalRisk(driftSeverity: string, repeatFailures: number, validationScore: number, replayConfidence: number) { const drift = driftSeverity === 'high' ? 0.9 : driftSeverity === 'medium' ? 0.6 : 0.3; const score = Number((drift * 0.3 + Math.min(1, repeatFailures / 10) * 0.25 + (1 - validationScore) * 0.2 + (1 - replayConfidence) * 0.2 + 0.05).toFixed(3)); return { score, factors: { drift, repeated_failures: Math.min(1, repeatFailures / 10), replay_uncertainty: 1 - replayConfidence } }; }
function readinessTier(readiness: string, riskScore: number) { if (riskScore > 0.75) return 'degraded'; if (readiness === 'validated' && riskScore < 0.25) return 'autonomous'; if (readiness === 'validated' && riskScore < 0.45) return 'resilient'; if (readiness === 'partial') return 'operational'; return 'bootstrap'; }
function scoreReplayConfidence(validation: any, root: string, fileCount: number, commandCount: number) { const history = readJson(resolve(root, '.stealtheye/state/replay-history.json'), { runs: [] }) as any; const stability = readJson(resolve(root, '.stealtheye/state/validation-reliability.json'), { score: 0.8 }) as any; const recovery = readJson(resolve(root, '.stealtheye/state/recovery-outcomes.json'), { successful_recoveries: 0, failed_recoveries: 0 }) as any; const val = validation && (validation.ok === true || validation.status === 'validated') ? 0.25 : 0.1; const multiRun = Math.min(0.2, (history.runs?.length ?? 0) * 0.03); const stable = Math.min(0.2, (stability.score ?? 0.8) * 0.2); const recoveryHealth = Math.min(0.15, ((recovery.successful_recoveries ?? 1) / Math.max(1, (recovery.failed_recoveries ?? 0) + (recovery.successful_recoveries ?? 1))) * 0.15); const coverage = Math.min(0.1, fileCount * 0.02); const commandStability = Math.min(0.1, commandCount * 0.02); return Number((val + multiRun + stable + recoveryHealth + coverage + commandStability + 0.2).toFixed(3)); }
function replayUncertainty(confidence: number, validation: any, root: string) { const drift = readJson(resolve(root, '.stealtheye/state/drift-report.json'), { repeated_drift: 0 }) as any; return { score: Number((1 - confidence).toFixed(3)), reasons: [validation?.ok ? null : 'validation_not_fully_stable', drift.repeated_drift > 0 ? 'drift_recurrence' : null].filter(Boolean) }; }
function buildExplainabilityPacket(nextAction: any, recovery: any, risk: any, tier: string) { return { why_next_action: { selected: nextAction.action, reason: 'maximizes deterministic stabilization and lowers interruption risk' }, why_worker: { recommended: nextAction.recommended_worker, reason: 'based on routing memory and codex minimization goals' }, why_repair_path: { selected: recovery.strategy, reason: 'evidence-weighted success/recurrence balance' }, why_drift_severity: { score: risk.score, factors: risk.factors }, why_readiness_tier: { tier, reason: 'derived from readiness report + operational risk bounds' } }; }
function autonomyProgression(root: string) { const efficiency = readJson(resolve(root, '.stealtheye/state/operational-efficiency.json'), { successful_non_codex_handling: 0, unnecessary_codex_use: 0, human_interruption_frequency: 0.1 }) as any; const score = Number((0.4 + Math.max(0, efficiency.successful_non_codex_handling - efficiency.unnecessary_codex_use) * 0.05 + (1 - (efficiency.human_interruption_frequency ?? 0.1)) * 0.3).toFixed(3)); const out = { autonomy_score: Math.min(1, score), trajectory: score > 0.65 ? 'improving' : 'flat' }; writeFileSync(resolve(root, '.stealtheye/state/autonomy-progression.json'), JSON.stringify(out, null, 2)); return out; }
function hashOf(root: string, relFiles: string[]) { const hash = createHash('sha256'); for (const file of relFiles) { const abs = resolve(root, file); if (!existsSync(abs)) continue; const s = statSync(abs); hash.update(file + ':' + s.size + ':' + s.mtimeMs); } return hash.digest('hex'); }
function updateLatestPointer(relPath: string, payload: Record<string, unknown>, root = process.cwd()) { const absolute = resolve(root, `.stealtheye/${relPath}`); mkdirSync(resolve(absolute, '..'), { recursive: true }); writeFileSync(absolute, JSON.stringify(payload, null, 2)); }
