# LEG-001 source reconciliation — C3-B / issue #1766

Basis: `main@41df6e945789273fc327aaeca6686529a9ad8b39`
Historical BM-MESH qualification: #1652 / PR #1715
Current mesher-fix baseline: merged PR #1740 (`3464f028878cf068ac525b720d512e381d6e45c9`)

## Finding

The creation-time #1766 work breakdown is behind current production source. The current code already contains the architecture that C3-B.1 through much of C3-B.4 describe. The safe next batch is therefore current-head qualification and source-custody closure, not a second mesher implementation.

## Current production facts established by source inspection

- `lafea-mesh-producer-engine.js` explicitly routes both simply and multiply-connected planar regions through the unstructured refinement path.
- `interior-refinement-t6.js` recovers real hole-boundary constrained edges, removes hole-interior triangles, adds deterministic transition refinement and preserves analytic boundary-edge ownership for higher-order midsides.
- `lafea.3-geometry-intake-check.mjs` exercises an ordinary polygon plus OUTER+HOLE geometry through public workbench mesh generation, preflight and compiler; deterministic replay is required.
- `lafea.3-curved-geometry-intake-check.mjs` exercises LINE+CIRCULAR_ARC geometry through deterministic generated T6 evidence.
- `lafea-mesh-producer-binding-check.mjs` covers current producer qualification, T3/T6/Q8 family truth, deterministic replay, a multi-level T6 ladder, circular-hole T6, uniform-Q8 hole generation, v2 tamper/stale custody and quality qualification.
- `lafea-retained-mesh-refinement-check.mjs` covers deterministic T3/T6 retained refinement, atomic replacement/rejection and Q8 fail-closed refinement authority.
- PR #1740 repaired B02C mapped grading and curved-edge transition refinement without changing frozen quality thresholds.

These observations are source inspection, not exact-current executable PASS.

## Historical BM-MESH source drift

The current historical registry is:

`validation/lafea-benchmark-data/MESH/sources/source-registry.json@338debf9bbd75bc6032298e140543e82eee9d4a6`

Material mismatches against current main include:

| Boundary | Historical pin | Current blob | Disposition |
|---|---|---|---|
| `src/workspace/lafea-mesh-producer-binding.js` | `e8307066293314ad952608872db596cf1898d5c1` | `9be4f734ce35699da2a136b6dff236a263b1a80f` | current requalification required |
| `src/workspace/lafea-mesh-producer-engine.js` | `36fe0e7cb8b95aab8ebc2532578a68a1eb75f558` | `2b25cbe47710c7ed5dd3dd1382c731a55b73d68a` | current requalification required |
| `src/core/lafea-meshing/boundary-discretization.js` | not directly pinned by BM-MESH | `4079dabc9baab6a660337eb6c85e151048696b1d` | add direct C3-B custody |
| `src/core/lafea-meshing/interior-refinement-t6.js` | not directly pinned by BM-MESH | `8acdde8bbc3dc11c073928d3bf84e4c64b285e31` | add direct C3-B custody |

The old registry and its old exact-head PASS remain valid historical evidence. They must not be rewritten or described as current merely because the current code is expected to be better.

## Drift classification

`27dde65...` (#1715 merge) -> `41df6e9...` contains material mesher drift, so historical M0-M4 execution cannot be promoted to current evidence.

`3464f02...` (#1740 merge) -> `41df6e9...` does not change the production mesher engine/boundary/interior-refinement files, but does change `lafea-mesh-producer-binding.js` and related B02/workbench surfaces. Therefore #1740's executed mesher evidence is highly relevant but still not exact-current C3-B closure evidence.

## Required current batch

One exact clean candidate must retain:

1. ordinary polygon route;
2. analytic curved-boundary route;
3. producer binding, hole T6/Q8, deterministic replay and v2 custody;
4. retained T3/T6 refinement and negative controls;
5. B02C curved-hole regression;
6. BM-MESH M0-M4 and frozen negatives under a successor current source basis;
7. full `check:lafea-meshing`, imports and diff check.

No release/solver/recovery claim follows from mesh qualification alone.
