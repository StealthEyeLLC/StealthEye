# stealtheye

StealthEye autonomy substrate repository.

## Current posture (as of 2026-05-28)
- H0: COMPLETE
- H1: COMPLETE
- H2: COMPLETE
- H3: COMPLETE
- H4: COMPLETE

## Canonical substrate guarantees
- Bootstrap-first runtime (`.stealtheye/state/project-state.json` is required before meaningful work).
- Deterministic autonomy continuity and fresh-tab runtime reconstruction.
- Replay-safe recovery and deterministic lineage conflict handling.
- Deterministic serialization and bounded artifact retention/compaction.
- No unrestricted shell authority; no unrestricted destructive git authority; no autonomous deployment/merge authority.

## Canonical continuity model
- Recovery entrypoint: `.stealtheye/state/fresh-tab-bootstrap.json`.
- Source-of-truth precedence:
  1. `.stealtheye/handoffs/latest.json`
  2. `.stealtheye/receipts/latest-replay.json`
  3. `.stealtheye/state/project-state.json`
  4. `.stealtheye/state/next-action.json`

## Governance + approval boundaries (enforced)
- Human approval remains mandatory for:
  - secrets/credentials
  - money/billing/purchases
  - irreversible production-data deletion

## Future phase transition posture
- Future phases must use the H4 substrate as canonical runtime authority.
- Future phases must preserve continuity, replay, lineage, governance, serialization, and approval-boundary invariants.
- Future phases must not introduce unrestricted autonomy or weaken completion-law guarantees.

## Commands
- `npm run generate`
- `npm run validate`
- `npm run graph`
- `npm run check:readiness`
- `npm run check`
- `npm run compile:packet`
- `npm run inspect:repo`
- `npm run diagnose`
