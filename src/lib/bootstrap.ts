import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export type BootstrapContext = { root: string; now: string; run_id: string; };

export function bootstrap(root = process.cwd()): BootstrapContext {
  const now = new Date().toISOString();
  const run_id = `${Date.now()}`;
  const dirs = ['.stealtheye', '.stealtheye/logs', '.stealtheye/state', '.stealtheye/receipts', '.stealtheye/handoffs', '.stealtheye/snapshots'];
  dirs.forEach((d) => mkdirSync(resolve(root, d), { recursive: true }));
  const statePath = resolve(root, '.stealtheye/state/project-state.json');
  if (!existsSync(statePath)) writeFileSync(statePath, JSON.stringify(defaultState(now), null, 2));
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  const proofPath = resolve(root, '.stealtheye/logs/bootstrap-proof.jsonl');
  writeFileSync(proofPath, JSON.stringify({ now, run_id, status: 'bootstrapped', phase: state.current_phase }) + '\n', { flag: 'a' });
  return { root, now, run_id };
}

function defaultState(now: string) {
  return {
    schema_version: '1.0.0',
    current_phase: 'phase0-autonomy-substrate',
    next_action: 'run generate then validate',
    blockers: [],
    freshness: { updated_at: now },
    autonomy_scoreboard: { reward_model_scaffolded: true, score: 0 },
    recovery: { retry_policy: 'exponential-backoff', fallback: 'handoff-and-resume' }
  };
}
