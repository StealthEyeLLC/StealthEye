# stealtheye

StealthEye autonomy substrate repository.

## Current posture (as of 2026-05-27)
- H0: COMPLETE
- H1: COMPLETE
- H2: COMPLETE
- H3: COMPLETE
- H4: NOT STARTED (next phase only)

## Deterministic operational guarantees
- Bootstrap-first runtime (`.stealtheye/state/project-state.json` is required before meaningful work).
- Bounded continuity artifacts via retention/compaction (`handoffs/latest.json`, `receipts/latest-replay.json`).
- Deterministic replay/handoff surfaces with explicit latest pointers.
- No unrestricted shell authority; no unrestricted destructive git authority.

## Current capabilities
- State generation/validation/graphing/readiness/packet compilation.
- H1/H2/H3 inspect/validate/packet/smoke command chains.
- Canonical continuity surfaces for fresh-tab reconstruction:
  - `.stealtheye/state/fresh-tab-bootstrap.json`
  - `.stealtheye/handoffs/latest.json`
  - `.stealtheye/receipts/latest-replay.json`
  - `.stealtheye/state/next-action.json`
  - `.stealtheye/state/working-set.json`

## Autonomy boundaries (enforced)
- Human approval remains mandatory for:
  - secrets/credentials
  - money/billing/purchases
  - irreversible production-data deletion
- H4 runtime behavior is not implemented in this branch.

## Continuity limitations
- Continuity remains file-surface based (no vector DB / embedding memory).
- Recovery quality depends on canonical latest pointers and validation freshness.
- Historical receipt archives are bounded and compacted; not full infinite history.

## Fresh-tab recovery direction
- Start at `.stealtheye/state/fresh-tab-bootstrap.json`.
- Resolve current runtime via `handoffs/latest.json` and `receipts/latest-replay.json`.
- Confirm next action via `.stealtheye/state/next-action.json`.

## Commands
- `npm run generate`
- `npm run validate`
- `npm run graph`
- `npm run check:readiness`
- `npm run check`
- `npm run compile:packet`
