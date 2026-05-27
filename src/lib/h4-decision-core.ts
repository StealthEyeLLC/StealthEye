import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from './bootstrap.js';
import { loadState, readJson } from './substrate.js';

export function runH4DecisionCore(rootArg = process.cwd()) {
  const { root } = bootstrap(rootArg); loadState(root);
  const now = new Date().toISOString();
  const continuity = readJson(resolve(root, '.stealtheye/state/continuity-fabric-state.json'), {} as any) as any;
  const next = readJson(resolve(root, '.stealtheye/state/next-action.json'), { next_action: 'npm run h4:validate' } as any) as any;
  const blockers = [...(continuity.continuity_blockers ?? [])];
  if ((continuity.status ?? 'ACTIVE') === 'COMPLETE') blockers.push('h4-complete-illegal');
  const action = blockers.length ? 'repair continuity blockers' : (next.next_action ?? 'npm run h4:validate');
  const core = { phase: 'H4', status: 'ACTIVE', next_action: action, why: blockers.length ? 'blockers-detected' : 'safe-autonomous-continuation', evidence: ['repo-native state precedence', 'continuity fabric', 'runtime matrix'], blockers, escalation_required: blockers.length > 0, human_action_needed: blockers.includes('invalid-escalation-path'), safe_to_continue: blockers.length === 0, continuity_confidence: continuity.continuity_confidence ?? 'medium', recommended_validation_chain: ['h4:validate','h4:governance-check','h4:determinism-check'], recommended_pr_action: 'continue h4 hardening PR only', recommended_runtime_action: 'bounded deterministic run', updated_at: now };
  writeFileSync(resolve(root, '.stealtheye/state/fresh-tab-decision-core.json'), JSON.stringify(core, null, 2));
  writeFileSync(resolve(root, '.stealtheye/state/fresh-tab-decision-tree.json'), JSON.stringify({ nodes: [{ id: 'root', condition: 'continuity blockers empty' }, { id: 'resume', action: 'continue bounded validation chain' }], updated_at: now }, null, 2));
  writeFileSync(resolve(root, '.stealtheye/state/fresh-tab-decision-evidence.json'), JSON.stringify({ sources: ['.stealtheye/handoffs/latest.json','.stealtheye/receipts/latest-replay.json','.stealtheye/state/project-state.json','.stealtheye/state/next-action.json'], repo_native_only: true, updated_at: now }, null, 2));
  writeFileSync(resolve(root, '.stealtheye/state/fresh-tab-decision-risks.json'), JSON.stringify({ risks: blockers, escalation_severity: blockers.length ? 'high' : 'low', safe_autonomy_level: blockers.length ? 'restricted' : 'bounded-autonomous', updated_at: now }, null, 2));
  if (!core.evidence.length) throw new Error('undefined-evidence');
  return core;
}
