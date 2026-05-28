# StealthEye Agent Constitution

- Canonical source: GitHub Issue #1.
- Default behavior: continue deterministic autonomy substrate execution without intermediate approvals.
- Approval required only for: secrets/credentials, money/billing/purchases, irreversible production-data deletion.
- Every meaningful script must bootstrap and load `.stealtheye/state/project-state.json` before work.
- Mandatory operational primitives: memory retrieval, process selection, invariants, tool routing, graph usage, handoff emission, state snapshotting.
- Keep docs minimal; prefer machine-readable JSON/JSON Schema.

## H-map posture
- H0 COMPLETE
- H1 COMPLETE
- H2 COMPLETE
- H3 COMPLETE
- H4 COMPLETE

## Post-H4 operating model
- Deterministic, bounded runtime only.
- Continuity authority uses canonical latest pointers (`handoffs/latest.json`, `receipts/latest-replay.json`).
- Fresh-tab recovery is first-class and replay-safe.
- Mobile supervision remains supported through compact handoffs and bounded recovery state.

## Governance + approval invariants
- No unrestricted shell execution.
- No unrestricted destructive git operations.
- No autonomous deployment/merge authority.
- Approval boundary never regresses: secrets, billing, irreversible production-data deletion always require human approval.

## Continuity authority rules
- Source-of-truth precedence:
  1. `.stealtheye/handoffs/latest.json`
  2. `.stealtheye/receipts/latest-replay.json`
  3. `.stealtheye/state/project-state.json`
  4. `.stealtheye/state/next-action.json`
- Fresh-tab bootstrap entrypoint: `.stealtheye/state/fresh-tab-bootstrap.json`.
- Completion-law and final-decision artifacts are canonical H4 completion authorities.

## What must never regress
- Deterministic serialization and replay-safe recovery.
- Deterministic lineage conflict handling and bounded containment.
- Governance-boundary enforcement and approval-boundary enforcement.
- Canonical-state continuity semantics and latest-pointer integrity.

## Future phase expectations
- Future phases must layer on top of the H4 substrate and preserve all invariants.
- Future work may extend capabilities but must not weaken bounded autonomy or governance laws.
- H4 completion law remains the baseline contract for all subsequent phase transitions.
