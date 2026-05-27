import { readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from './bootstrap.js';
import { readJson, writeReplayReceipt, writeHandoff } from './substrate.js';

export function runH4ContinuityArbitration(root = process.cwd()) {
  bootstrap(root);
  const now = new Date().toISOString();
  const runtime = readJson(resolve(root, '.stealtheye/state/h4-runtime-state.json'), { status: 'ACTIVE', runtime_status: 'unknown' }) as any;
  const lineage = readJson(resolve(root, '.stealtheye/state/runtime-lineage.json'), { lineage: [] }) as any;
  const replay = readJson(resolve(root, '.stealtheye/receipts/latest-replay.json'), {}) as any;
  const nextAction = readJson(resolve(root, '.stealtheye/state/next-action.json'), { next_action: 'run h4:validate' }) as any;
  const quarantine = readJson(resolve(root, '.stealtheye/state/runtime-quarantine-state.json'), { quarantined: [] }) as any;

  const runtimes = [runtime].filter(Boolean);
  const authoritative = runtimes.filter((x) => x.runtime_status === 'recovered' || x.runtime_status === 'active');
  if (runtime.status === 'COMPLETE') throw new Error('H4 COMPLETE forbidden');
  if (authoritative.length > 1) throw new Error('multiple-active-authoritative-runtimes');
  if (!nextAction.next_action) throw new Error('undefined-canonical-runtime');

  const risks = {
    unresolved_authoritative_conflict: authoritative.length !== 1,
    replay_invalid_arbitration: !replay.timestamp,
    merge_authority_ambiguity: !!readJson(resolve(root, '.stealtheye/state/pr-continuity.json'), { merge_authority_ambiguous: false }).merge_authority_ambiguous,
    stale_mobile_continuity: !!readJson(resolve(root, '.stealtheye/state/mobile-compaction-health.json'), { stale: false }).stale
  };
  if (risks.replay_invalid_arbitration) throw new Error('replay-invalid-arbitration');

  const resolution = {
    canonical_runtime: authoritative[0]?.runtime_status ?? 'recovered',
    canonical_branch: readJson(resolve(root, '.stealtheye/state/branch-continuity.json'), { canonical_branch: 'h4/autonomy-continuity-fresh-tab-runtime' }).canonical_branch,
    canonical_replay_pointer: replay.timestamp,
    canonical_next_action: nextAction.next_action,
    quarantine_strategy: quarantine.quarantined?.length ? 'bounded-runtime-quarantine' : 'none',
    escalation_required: Object.values(risks).some(Boolean)
  };

  const out = { phase: 'H4', status: 'ACTIVE', timestamp: now, arbitration_precedence: ['latest-handoff','latest-replay','project-state','next-action'], conflicts_checked: ['runtimes','branches','replay-chains','next-actions','pr-states','merge-states','mobile-continuity'], resolution };
  const lineageOut = { timestamp: now, replay_safe: true, lineage: (lineage.lineage ?? []).slice(-12), selection: resolution.canonical_runtime };
  writeFileSync(resolve(root, '.stealtheye/state/continuity-arbitration.json'), JSON.stringify(out, null, 2));
  writeFileSync(resolve(root, '.stealtheye/state/continuity-arbitration-lineage.json'), JSON.stringify(lineageOut, null, 2));
  writeFileSync(resolve(root, '.stealtheye/state/continuity-arbitration-risks.json'), JSON.stringify(risks, null, 2));
  writeFileSync(resolve(root, '.stealtheye/state/continuity-arbitration-resolution.json'), JSON.stringify(resolution, null, 2));
  writeReplayReceipt('h4:continuity-arbitration', { commands: ['npm run h4:continuity-arbitration'], validation_results: { ok: !Object.values(risks).some(Boolean) } }, root);
  writeHandoff({ phase: 'h4', action: 'continuity-arbitration', status: 'ACTIVE' }, root);
  return { out, risks, resolution };
}
