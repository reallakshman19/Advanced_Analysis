# Current Issue State — ADV-LAFEA4-A1-1758

ISSUE_CURRENT_STATE_BASIS: IB-0001
ISSUE_CURRENT_STATE_ENDPOINT: EP-0002
LIVE_MAIN: 41df6e945789273fc327aaeca6686529a9ad8b39
LIVE_MAIN_TREE: 2ebc03a01b3b7485e1b38a7fa41367f92bb92085
BRANCH: engineering/lafea4-a1-1758-geometry-mesh-custody
STATE_UPDATED_AT: 2026-09-12T06:05:06Z

## Task ledger
TASK-001 | Re-pin live main and A1 source owners. | COMPLETE | live source/contracts traced
TASK-002 | G1 planar single-patch. | SOURCE_PRESENT_EXECUTION_NOT_RUN | `scripts/lafea-shell-mesh-producer-check.mjs`
TASK-003 | G2 two-patch conforming seam. | SOURCE_PRESENT_EXECUTION_NOT_RUN | `scripts/lafea-shell-multipatch-seam-check.mjs`
TASK-004 | G3 controlled curved midsurface. | SOURCE_PRESENT_EXECUTION_NOT_RUN | cylindrical / curved-hole / periodic qualifiers plus geometric-quality evidence
TASK-005 | G4 determinism. | SOURCE_PATCHED_VALIDATION_NOT_RUN | LEG-001 extends shell producer qualification to two independent Node processes
TASK-006 | G5 refinement ladder. | PARTIAL_SOURCE_PRESENT_EXECUTION_NOT_RUN | coarse/fine shell producer ladders exist; >=3 retained levels still to prove
TASK-007 | area/boundary/normal/tangent/thickness evidence. | PARTIAL_SOURCE_PRESENT | multipatch area/seam metrics, parent-normal/geometric-quality and source-bound thickness basis exist; full retained element/region provenance matrix remains open
TASK-008 | exact retained mesh compiler identity. | SOURCE_PRESENT_EXECUTION_NOT_RUN | compiler requires exact current source/domain/geometry/mesh parents and kernel mesh binding
TASK-009 | stale-parent invalidation. | SOURCE_PRESENT_EXECUTION_NOT_RUN | workbench invalidation/recovery contracts traced
TASK-010 | mandatory negatives. | PARTIAL_SOURCE_PRESENT_EXECUTION_NOT_RUN | topology orientation BLOCK exists; parent-normal hard gate remains dormant by governed TECH-12 trust-root policy
TASK-011 | supported geometry envelope. | SOURCE_TRACE_COMPLETE | planar, planar multipatch, cylindrical, cylindrical-hole, periodic cylindrical; explicit limitations retained
TASK-012 | preserve NO-PATCH boundary. | PASS_TO_DATE | only determinism qualification script + chain custody changed

## Source findings
1. `lafea-analysis-mesh-quality.js` blocks local winding conflicts, disconnected patches and non-manifold shell topology through `shellOrientationTopology`.
2. Topology consistency alone does not prove orientation relative to the governed midsurface. Existing TECH-12 parent-normal qualification owns that distinction for cylindrical/cylindrical-hole surfaces.
3. The parent-normal production trust root is intentionally null; current production behavior is shadow-only pending separately reviewed exact-head evidence. A1 must not bypass this with a parallel hard gate.
4. `lafea-shell-thickness-basis.js` independently recomputes source authority and rejects stale/invalid thickness; geometric-quality evidence binds `thicknessBasisHash` but remains informational/not gated.
5. Generic retained mesh evidence binds source/domain/geometry/profile/mesh hashes. Workbench recovery validates artifact self-consistency and current profile; custody projections classify current/stale after publication.
6. Existing `lafea.10-determinism-check.mjs` proved cross-process determinism only for the core 2D triangulator. Shell route replays were in-process. LEG-001 closes that source-coverage gap by re-running each production shell qualifier twice in independent Node processes and comparing byte-identical stdout.

## Benchmark status
G1: NOT_RUN on A1 head
G2: NOT_RUN on A1 head
G3: NOT_RUN on A1 head
G4: SOURCE_COMPLETE_VALIDATION_NOT_RUN
G5: NOT_RUN on A1 head
ALL_MANDATORY_NEGATIVES: NOT_RUN on A1 head

## Evidence policy
Historical PR #1715 M0-M4/negative PASS is ancestry only. Source inspection establishes ownership/contract facts, never executable PASS. LEG-001 is not PASS until `npm run check:lafea-meshing` executes on the exact candidate head.

## Release posture
RELEASE_NOT_QUALIFIED / HOLD
