import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrap } from './bootstrap.js';
import { loadState, readJson } from './substrate.js';

export function runH4MobileCompaction(rootArg = process.cwd()) {
  const { root } = bootstrap(rootArg); loadState(root);
  const now = new Date().toISOString();
  const decision = readJson(resolve(root, '.stealtheye/state/fresh-tab-decision-core.json'), {} as any) as any;
  const summary = { phase: 'H4', status: 'ACTIVE', next_action: decision.next_action ?? 'run h4:decision-core', escalation_status: decision.escalation_required ? 'required' : 'not-required', approval_boundary_state: 'explicit-boundaries-preserved', branch_state: 'h4/autonomy-continuity-fresh-tab-runtime', compact: true, updated_at: now };
  writeFileSync(resolve(root, '.stealtheye/state/mobile-continuity-compaction.json'), JSON.stringify(summary, null, 2));
  writeFileSync(resolve(root, '.stealtheye/state/mobile-runtime-summary.json'), JSON.stringify({ continuity: 'bounded', replay: 'tracked', interruptions: 'recoverable', pr: 'continuity-guarded', blockers: decision.blockers ?? [], updated_at: now }, null, 2));
  const compactMd = `# Mobile Runtime Compact\n- H4 status: ACTIVE\n- Next action: ${summary.next_action}\n- Escalation: ${summary.escalation_status}\n- Branch: ${summary.branch_state}\n- Approval boundaries: explicit and preserved\n`;
  const emergencyMd = `# Mobile Runtime Emergency\n- If blocked: run npm run h4:continuity-fabric\n- Then: npm run h4:decision-core\n- Escalate only for invalid escalation path or undefined recovery path.\n- H4 status must remain ACTIVE.\n`;
  if (compactMd.length > 1200) throw new Error('oversized-mobile-summary');
  writeFileSync(resolve(root, '.stealtheye/handoffs/mobile-runtime-compact.md'), compactMd);
  writeFileSync(resolve(root, '.stealtheye/handoffs/mobile-runtime-emergency.md'), emergencyMd);
}
