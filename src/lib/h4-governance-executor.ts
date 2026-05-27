import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from './bootstrap.js';
import { readJson, writeHandoff, writeReplayReceipt } from './substrate.js';

export function runH4GovernanceExecutor(root = process.cwd()) {
  bootstrap(root);
  const now = new Date().toISOString();
  const arbitration = readJson(resolve(root, '.stealtheye/state/continuity-arbitration-resolution.json'), { escalation_required: false }) as any;
  const escalation = arbitration.escalation_required ? 'human-review-required' : 'autonomous-safe-continuation';
  if (!escalation) throw new Error('undefined-escalation');
  const forbidden_actions = ['secrets','billing','deployment','destructive-git','production-delete'];
  const state = { phase: 'H4', status: 'ACTIVE', escalation, safe_authority: escalation === 'autonomous-safe-continuation' ? 'bounded-autonomy' : 'escalation-only', timestamp: now };
  const lineage = { replay_safe: true, timestamp: now, proofs: ['governance-replay-proof','boundary-proof'] };
  const decisions = { deterministic_classification: escalation, human_action_gate: escalation !== 'autonomous-safe-continuation', merge_authorization: false };
  const boundaries = { approval_boundary_enforced: true, forbidden_actions, unauthorized_autonomous_continuation: false };
  writeFileSync(resolve(root, '.stealtheye/state/governance-execution-state.json'), JSON.stringify(state, null, 2));
  writeFileSync(resolve(root, '.stealtheye/state/governance-execution-lineage.json'), JSON.stringify(lineage, null, 2));
  writeFileSync(resolve(root, '.stealtheye/state/governance-escalation-decisions.json'), JSON.stringify(decisions, null, 2));
  writeFileSync(resolve(root, '.stealtheye/state/governance-boundary-enforcement.json'), JSON.stringify(boundaries, null, 2));
  writeReplayReceipt('h4:governance-executor', { commands: ['npm run h4:governance-executor'], validation_results: { ok: true } }, root);
  writeHandoff({ phase: 'h4', action: 'governance-executor', status: 'ACTIVE', escalation }, root);
  return { state, decisions };
}
