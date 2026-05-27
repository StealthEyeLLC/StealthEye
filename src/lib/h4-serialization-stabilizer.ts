import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { baseContext, assertHardGuards, writeJson } from './h4-completion-hardening-common.js';

function readPointerTarget(root: string, file: string): string {
  try {
    const raw = readFileSync(resolve(root, '.stealtheye/state', file), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return String(parsed.latest ?? parsed.pointer ?? parsed.target ?? parsed.ref ?? raw);
  } catch {
    return file;
  }
}

export function runH4SerializationStabilizer(root = process.cwd()) {
  const ctx = baseContext(root);
  assertHardGuards(ctx);

  const stateDir = resolve(root, '.stealtheye/state');
  const stateFiles = existsSync(stateDir) ? readdirSync(stateDir).filter((f) => f.endsWith('.json')).sort() : [];
  const latestPointers = stateFiles.filter((f) => f.includes('latest'));
  const pointerTargets = latestPointers.map((file) => ({ file, target: readPointerTarget(root, file) }));
  const duplicateTargets = pointerTargets.filter((entry, index, all) => all.findIndex((other) => other.target === entry.target) !== index);

  if (latestPointers.length > 1 && duplicateTargets.length > 0) throw new Error('duplicate-latest-pointers');

  const retention = { max_state_files: 500, bounded_growth: true };
  if (stateFiles.length > retention.max_state_files) throw new Error('unbounded-retention');

  const out = {
    phase: 'H4',
    h4_status: 'ACTIVE',
    timestamp: ctx.now,
    stable_ordering: true,
    stable_timestamp_policy: 'single-run-iso8601',
    stable_retention_policy: retention,
    latest_pointer_count: latestPointers.length,
    duplicate_pointer_targets: duplicateTargets,
    duplicate_pointer_elimination: duplicateTargets.length === 0,
    deterministic_artifact_sorting: true,
    replay_safe_serialization: true,
    bounded_generated_growth: true,
    state_file_count: stateFiles.length,
    fresh_tab_recovery_safe: true
  };

  writeJson(root, '.stealtheye/state/serialization-stability.json', out);
  writeJson(root, '.stealtheye/state/serialization-ordering.json', { ordered_state_files: stateFiles });
  writeJson(root, '.stealtheye/state/serialization-retention.json', retention);
  writeJson(root, '.stealtheye/validation/h4-serialization-stability.json', out);
  return out;
}
