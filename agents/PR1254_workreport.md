# PR1254 — B02D V2 diagnostic execution carrier

HANDOVER_READINESS: DIAGNOSTIC_ONLY
PR_RECOVERY_STATE: EXPERIMENTAL_CARRIER
PROMOTION_ELIGIBILITY: NO
MERGE_AUTHORITY: NOT_GRANTED

## Role
PR #1254 is retained only to execute its already-existing temporary V2 workflows. It is not a promotion candidate because it contains ten temporary workflow files and experimental numerical history.

## Current diagnostic basis
- V2 definition/generator/pre-observation check remain the original prospectively frozen #1254 assets.
- V2 response output was not used to choose the frozen mesh definition.
- No hard mesh-quality or response-acceptance threshold is changed.
- This carrier is being pinned to the exact B01 numerical candidate from PR #1258 for diagnostic replay.

## B01 candidate bytes transplanted for replay
From PR #1258 production qualification head `80986bcc42ebb6cb5e48a68e9b5ad88c9084d1f4`:
- retained symmetric Jacobi-CG solver/support;
- T6 mesh-quality metric-domain correction;
- B-bar two-translation roundoff-bounded nullspace reconstruction.

The purpose is to test the previously failing frozen V2 response on the same B01 mechanics that now pass the focused Lamé and 54/270/16 matrices. This does not grant release authority and does not make PR #1254 mergeable as a product increment.

## Historical V2 response blocker
The first frozen V2 response passed all T3/T6/Q8 x L1-L4 pre-observation mesh checks, then failed at `B02D T6/L4` with `REACTION_EQUILIBRIUM_FAILURE`.

## Exact next action
Observe the existing V2 production-response workflow after the B01 candidate-byte transplant. If the response qualifies, use the result only as diagnostic evidence and continue promotion work in the clean B02D successor branch `agent/lafea-b02d-v2-clean-qualification-20260819`.
