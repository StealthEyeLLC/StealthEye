import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from './bootstrap.js';

export function loadState(root = process.cwd()) {
  bootstrap(root);
  return JSON.parse(readFileSync(resolve(root, '.stealtheye/state/project-state.json'), 'utf8'));
}

export function emitRunEvidence(name: string, payload: Record<string, unknown>, root = process.cwd()) {
  const { now, run_id } = bootstrap(root);
  writeFileSync(resolve(root, '.stealtheye/logs/process-execution.jsonl'), JSON.stringify({ now, run_id, process: name, ...payload }) + '\n', { flag: 'a' });
}

export function writeHandoff(summary: Record<string, unknown>, root = process.cwd()) {
  const { now, run_id } = bootstrap(root);
  writeFileSync(resolve(root, `.stealtheye/handoffs/handoff-${run_id}.json`), JSON.stringify({ now, ...summary }, null, 2));
}

export function graphIndex(root = process.cwd()) {
  bootstrap(root);
  const files = readdirSync(resolve(root, '.stealtheye/state'));
  writeFileSync(resolve(root, '.stealtheye/graphs/repo-graph.json'), JSON.stringify({ nodes: files.map((f) => ({ id: f, type: 'state-file' })) }, null, 2));
  writeFileSync(resolve(root, '.stealtheye/graphs/knowledge-graph.json'), JSON.stringify({ memory_hooks: ['memory-index.json'], invariants: ['invariants.json'] }, null, 2));
}
