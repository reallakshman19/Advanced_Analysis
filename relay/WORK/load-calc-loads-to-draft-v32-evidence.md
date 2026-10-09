# TASK_EVIDENCE — Loads to 3D Draft / calculated support inspector

Same responsibility `owner-direct:advanced-analysis:sjson-routine-run-auto-20261001`; live Common v3.2 `149770a21ca073df49717a96e2106c967adddc2d`. Local worktree `load-calc-draft-validation/AA`, branch `codex/load-calc-workbench-review`, existing draft PR1915. This leg is STEP only, not full-vector or responsibility completion. Local uncommitted changes; no PR publication, merge or release. Primary checkout untouched.

## Changed files and boundaries

- `src/workspace/load-calc-workbench/draft-support-loads.js`: read-only join between existing calculated support sites and exact selected canonical support/source-member or restraint IDs. No nearest-coordinate matching, force summation, mass/solver edits or authoritative draft writes. Current gravity receipt/source/seal/distribution/site semantic hash checks and existing scenario-current guard; source mismatch or changed draft topology withholds all values.
- `src/workspace/load-calc-workbench/draft-loads-inspector.js`: disposable card in the existing certified 3D inspector, default OPE selector and three-case gravity table; exact signed scenario vectors and component projections only when supplied by a current scenario. Explicit zero remains zero, missing remains unavailable. Transfer moment N·mm is labelled chainage demand, distinct from solved global moments N·m. Case/result class/contact state/sign conventions/receipt hashes remain visible. Teardown removes listeners; no selection/journal/source mutation.
- `src/workspace/load-calc-workbench/results-view.js`: current-results-only Loads to 3D Draft button, without another runner/export authority.
- `src/workspace/load-calc-consumer-controller.js`: guarded button navigation, disposable inspector mount and focus through the existing canonical selection owner. Existing production SJSON-fidelity controller chain unchanged. Previous support-mapping changes in this same dirty diff are preserved, not part of this leg.
- `scripts/load-calc-loads-to-draft-check.mjs`: actual captured gravity receipt equality, exact/co-located joins, distinct multi-selection, zero/missing/non-support, source/seal/site/receipt/topology negatives; synthetic signed scenario projection (presentation only, not source numerical qualification); disposable lifecycle using production selection store with a test DOM seam, duplicate mount, case change, back navigation, stale event and cleanup. Original bundle/draft remain immutable.
- This plan/evidence/screenshot and derived continuity snapshot record truthful current/next state. Older evidence remains historical.

Protected load/coordinate/sign/reference-point mechanics, stiffness/recovery/source/master/benchmark/publication authority unchanged. No support type changes applied: unresolved choices remain Skip. No geometry commands staged or committed in the live browser.

## Executed validation

PASS: `node scripts/load-calc-loads-to-draft-check.mjs`, `load-calc-workbench-results-check.mjs`, `load-calc-workbench-integration-check.mjs`, `load-calc-support-mapping-check.mjs`, `load-calc-workbench-check.mjs`, `load-calc-workbench-migration-check.mjs`, `advanced-shell-contract-check.mjs`, `import-check.mjs`.

PASS: `npm run build` (2103 modules, 18.07s, bundle guard PASS); `git diff --check`. Existing circular/large-chunk/externalized-module warnings retained. Node-only master controller asynchronous relative-URL seed warning does not erase the executed assertion results and is not called engineering PASS.

FAIL: broader `node scripts/run-non-fea-checks.mjs` stopped at Empirical restraint network V1: missing `benchmarks/LFEA/BM2/Input_BM2.xml` (ENOENT). Fixture not present in the worktree or primary checkout; no substitute oracle fabricated. Later suite stages NOT_RUN. Prior successful stages are not represented as a complete suite PASS. Legacy exhaustive regressions NOT_RUN.

## Actual browser connector verification

Fresh in-app tab18 at `http://localhost:5174/AA3/` after old tab17 became unresponsive following development update. Actual Sjson source, existing project profile12 and existing203 accepted input records/seven reviewed zero weights restored through normal UI. Existing gravity Run executed once: fresh visible state verified success after connector click timeout. No calculation/input approval manufactured by the inspector.

Current gravity remained CALCULATED_WITH_EXCEPTIONS, 37 support rows/81 exceptions per case. Allocated/unallocated N: EMPTY 79790.710/704.604; OPE 80890.933/704.683; HYD 96211.950/705.778.

Browser verified:

- Results button enabled and opens existing certified 3D Draft, focusing exact PS-12244 source support `=1006649732/51230`. Draft remains Clean, zero edits.
- Inspector shows PS-12244: EMPTY3791.649N, OPE3811.490N, HYD4087.778N, 12 contributors and exception status. Case selection HYD changes hero value to4087.778N without rerun/input change.
- Clicking exact PS-12246 tree support `=1006649732/51240` updates site/card: EMPTY3483.883N, OPE3501.187N, HYD3742.151N, 13 contributors. Switching back OPE displays3501.187N. No sums across sites.
- Clear selection removes numerical card and displays click-a-support prompt. Actual viewport pick selected an instrument, which correctly remains a non-support prompt rather than showing another support's loads. Support selection itself was verified through the normal source tree/canonical selection owner; direct viewport support picking NOT separately evidenced.
- Back to results removes card (count0), returns to new Results stage with existing current gravity. Re-entering via button creates exactly one card, defaults OPE and focuses PS-12244 again. Listener/duplicate cleanup additionally exercised by focused unit test.
- Unavailable Fa/Fl/global moments explicitly labelled not calculated; Fh labelled separate screening estimate, not asserted as solved reaction. Synthetic scenario vector display exercised in tests only; actual source-bound full-vector scenario remains NOT_CONFIGURED/NOT_RUN.
- Tab18 retained as deliverable with PS-12244 current OPE load card. Screenshot: `relay/WORK/load-calc-loads-to-draft-v32.png`.

## Next

The requested read-only Results-to-Draft support load interface is delivered locally. Full-vector source-bound scenario/profile/case/restraint authority remains absent; retain missing values and all-Skip unresolved mappings. Address that numerical leg through existing authorized owners, not UI authority changes. Missing benchmark fixture must be restored through its owning source before a whole-suite PASS can be claimed. No release/publication claim.
