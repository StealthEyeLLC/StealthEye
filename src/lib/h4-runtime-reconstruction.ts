import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from './bootstrap.js';
import { loadState, readJson } from './substrate.js';

function readBranch(root: string) {
  const head = readFileSync(resolve(root, '.git/HEAD'), 'utf8').trim();
  return head.startsWith('ref:') ? head.split('/').slice(2).join('/') : head;
}

export function runH4RuntimeReconstruction(root = process.cwd()) {
  bootstrap(root); loadState(root);
  const branch = readBranch(root);
  const project = readJson(resolve(root, '.stealtheye/state/project-state.json'), {}) as any;
  const pr = readJson(resolve(root, '.stealtheye/state/pr-continuity-state.json'), {}) as any;
  const next = readJson(resolve(root, '.stealtheye/state/h4-next-action-resolution.json'), {}) as any;
  const replay = readJson(resolve(root, '.stealtheye/receipts/latest-replay.json'), {}) as any;
  const handoff = readJson(resolve(root, '.stealtheye/handoffs/latest.json'), {}) as any;

  if (String(project?.h_map?.h4 ?? 'ACTIVE').toUpperCase() === 'COMPLETE') throw new Error('h4-complete-forbidden');
  if (!branch) throw new Error('branch-drift-ambiguity');
  if (!handoff.now || !replay.timestamp) throw new Error('replay-drift');

  const expected_pr_state = String(pr.pr_state ?? 'open');
  const merge_state = expected_pr_state === 'merged' ? 'merged' : 'not-merged';
  if (expected_pr_state === 'merged' && branch.includes('h4/')) throw new Error('impossible-merge-state');

  const reconstruction = {
    schema_version: '1.0.0',
    phase: 'H4',
    expected_active_branch: branch,
    expected_pr_state,
    expected_merge_state: merge_state,
    expected_review_status: String(pr.review_status ?? 'pending'),
    expected_next_operational_step: String(next.next_action ?? 'npm run h4:autonomous-resume'),
    merge_already_occurred: merge_state === 'merged',
    runtime_drift_detected: false,
    branch_continuity_diverged: false
  };

  writeFileSync(resolve(root, '.stealtheye/state/runtime-reconstruction.json'), JSON.stringify(reconstruction, null, 2));
  writeFileSync(resolve(root, '.stealtheye/state/runtime-branch-reconstruction.json'), JSON.stringify({
    expected_active_branch: reconstruction.expected_active_branch,
    branch_continuity_diverged: reconstruction.branch_continuity_diverged,
    runtime_drift_detected: reconstruction.runtime_drift_detected
  }, null, 2));
  writeFileSync(resolve(root, '.stealtheye/state/runtime-pr-reconstruction.json'), JSON.stringify({
    expected_pr_state: reconstruction.expected_pr_state,
    expected_review_status: reconstruction.expected_review_status,
    expected_merge_state: reconstruction.expected_merge_state
  }, null, 2));
  return reconstruction;
}
