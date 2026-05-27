import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from './bootstrap.js';
import { loadState, readJson } from './substrate.js';

export function runH4AutonomousResume(root = process.cwd()) {
  bootstrap(root); loadState(root);
  const project = readJson(resolve(root, '.stealtheye/state/project-state.json'), {}) as any;
  const h4 = readJson(resolve(root, '.stealtheye/state/h4-runtime-state.json'), {}) as any;
  const next = readJson(resolve(root, '.stealtheye/state/h4-next-action-resolution.json'), {}) as any;
  const continuity = readJson(resolve(root, '.stealtheye/state/pr-continuity-state.json'), {}) as any;
  const interruption = readJson(resolve(root, '.stealtheye/state/interrupted-work-recovery.json'), {}) as any;
  const active = readJson(resolve(root, '.stealtheye/state/active-runtime.json'), {}) as any;

  if (String(h4.status ?? 'ACTIVE').toUpperCase() === 'COMPLETE') throw new Error('h4-complete-forbidden');
  const posture = String(project?.h_map?.h4 ?? project?.posture?.h4 ?? 'ACTIVE').toUpperCase();
  if (posture === 'COMPLETE') throw new Error('h4-must-remain-active');

  const reopened = ['h0','h1','h2','h3'].filter((k) => String(project?.h_map?.[k] ?? 'COMPLETE').toUpperCase() !== 'COMPLETE');
  if (reopened.length) throw new Error(`reopened-phases:${reopened.join(',')}`);

  const branchList = Array.isArray(active?.active_branches) ? active.active_branches : [];
  if (branchList.length > 1) throw new Error('conflicting-active-branches');

  const pending_validations = (interruption.pending_validations ?? []).filter((x: unknown) => typeof x === 'string');
  const unresolved_reviews = (continuity.unresolved_reviews ?? []).filter((x: unknown) => typeof x === 'string');
  const interrupted_operations = (interruption.interrupted_operations ?? []).filter((x: unknown) => typeof x === 'string');
  const pending_pr_actions = (continuity.pending_pr_actions ?? []).filter((x: unknown) => typeof x === 'string');

  const deterministic_next_action = String(next.next_action ?? interruption.safe_continuation_action ?? 'npm run h4:validate');
  if (deterministic_next_action.includes('|')) throw new Error('multiple-conflicting-next-actions');

  const blocked = unresolved_reviews.length > 0 || interruption.ambiguous === true;
  if (interruption.ambiguous === true) throw new Error('ambiguous-recovery-state');
  const resume_safe = !blocked && pending_validations.length <= 3;

  const out = {
    schema_version: '1.0.0',
    phase: 'H4',
    resume_safe,
    confidence: resume_safe ? 0.9 : 0.62,
    continuation_mode: resume_safe ? 'autonomous-bounded' : 'escalate-human',
    latest_valid_runtime: String(h4.runtime_status ?? 'recovered'),
    interrupted_operations,
    unresolved_reviews,
    pending_validations,
    pending_pr_actions,
    blocked,
    blocker_type: blocked ? 'review-or-ambiguity' : 'none',
    human_action_needed: !resume_safe,
    escalation_reason: resume_safe ? 'none' : 'unresolved reviews or ambiguous interruption state',
    deterministic_next_action,
    recommended_command_chain: resume_safe
      ? ['npm run h4:autonomous-resume', 'npm run h4:runtime-reconstruction', 'npm run h4:fresh-tab-acceptance']
      : ['npm run h4:pr-continuity-check', 'npm run h4:governance-check']
  };

  writeFileSync(resolve(root, '.stealtheye/state/autonomous-resume-state.json'), JSON.stringify(out, null, 2));
  writeFileSync(resolve(root, '.stealtheye/state/runtime-resume-decision.json'), JSON.stringify({
    resume_safe: out.resume_safe,
    continuation_mode: out.continuation_mode,
    blocked: out.blocked,
    human_action_needed: out.human_action_needed,
    deterministic_next_action: out.deterministic_next_action
  }, null, 2));
  writeFileSync(resolve(root, '.stealtheye/state/runtime-resume-confidence.json'), JSON.stringify({
    confidence: out.confidence,
    escalation_reason: out.escalation_reason,
    latest_valid_runtime: out.latest_valid_runtime
  }, null, 2));
  return out;
}
