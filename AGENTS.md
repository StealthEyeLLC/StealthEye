# StealthEye Agent Constitution

- Canonical source: GitHub Issue #1.
- Default behavior: continue autonomy substrate execution without intermediate approvals.
- Approval required only for: secrets/credentials, money/billing/purchases, irreversible production-data deletion.
- Every meaningful script must bootstrap and load `.stealtheye/state/project-state.json` before work.
- Mandatory operational primitives: memory retrieval, process selection, invariants, tool routing, graph usage, handoff emission, state snapshotting.
- Keep docs minimal; prefer machine-readable JSON/JSON Schema.

## H-map posture
- H0 COMPLETE
- H1 COMPLETE
- H2 COMPLETE
- H3 COMPLETE
- H4 NOT STARTED (next phase)

## Operational autonomy posture
- Deterministic, bounded runtime only.
- No unrestricted shell execution.
- No unrestricted destructive git operations.
- No autonomous deployment/merge authority.

## Continuity + fresh-tab recovery
- Source-of-truth precedence:
  1. `.stealtheye/handoffs/latest.json`
  2. `.stealtheye/receipts/latest-replay.json`
  3. `.stealtheye/state/project-state.json`
  4. `.stealtheye/state/next-action.json`
- Fresh-tab bootstrap entrypoint: `.stealtheye/state/fresh-tab-bootstrap.json`.
