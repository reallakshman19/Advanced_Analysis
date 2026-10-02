# TASK_EVIDENCE — current results integrated into the new workbench

Responsibility: owner-direct:advanced-analysis:sjson-routine-run-auto-20261001
Protocol: reallaksh19/Common@149770a21ca073df49717a96e2106c967adddc2d:skills/engineering-pr-delivery-v3.2
Basis: HEAD 6518a502d0c86524e4ad45801f4be35817622b5c; existing dirty work preserved. No commit, PR, merge, release or workflow mutation.
Plan: relay/WORK/load-calc-workbench-results-v32-plan.md; implementation-start recorded before production edits.

## Delivered and boundary

Prepared workbench stage four now displays existing gravity results, exact receipt and exception evidence, plus the existing automatic Fh/line-stop screening controls. Three compact case cards report existing allocated/unallocated forces, total support-row counts and exception counts. Receipt/scope disclosures fold without modifying the original values. The existing results/export route remains the owner; no new download or calculation runner was created.

Separate configured beam/contact results use the existing renderer only when scenario/proposal/authorization/execution identities, current overlay and existing Common Input authorization checker agree. Source-only prototype remains without calculated results. Invalid prepared bindings withhold old results. Distribution content, execution identities, scenario/overlay identities and common consumption receipts participate in invalidation.

Fv/Fa/Fl/global moments remain unavailable on this actual dataset because no beam/contact scenario is configured. A rendering test of synthetic method-owned globalReaction/anchorDecomposition is not a numerical qualification or an actual Sjson solve. No scalar gravity relabelling, restraint inference, stiffness/friction defaults, sign conversion, source authority or publication change.

## Browser verification — PASS within this scope

Connector: Codex In-app Browser, localhost:5173/AA3/, retained tab 13. Actual public/fixtures/Sjson.json imported with the UI chooser. Existing source/master/project state loaded; only the five previously approved weight-only section/density groups were replayed after hot reload (105 fields, 98 retained records -> 203 accepted / 0 proposals). No grade/fitting/restraint qualification was granted. Existing mapped workbook remained unchanged; PS-12247 source trace reports LineList Excel row 319, working temperature 309 C, hash 723518a16b1a744c9328539f1a25fe15ea246757930970603a89d3cea46e3f41.

The one-click existing gravity runner completed CURRENT / CALCULATED_WITH_EXCEPTIONS, not a clean complete-system solution:

| Case | Support rows | Allocated N | Unallocated N | Exceptions |
|---|---:|---:|---:|---:|
| EMPTY | 37 | 86244.830 | 962.029 | 81 |
| OPE | 37 | 87345.053 | 962.107 | 81 |
| HYD | 37 | 102666.069 | 963.203 | 81 |

34/37 OPE screening references estimated; 3 unresolved exact pipe matches remain row-local, not gravity blockers. PS-12247: OPE 7032.911 N, OD168.3/wall14.2748 mm, T309 C; Fh 2109.873 N and line-stop estimate 7850 N. Local T100 C changed only preview stop estimate to 9300 N; automatic restore returned T309/7850. Clearing T earlier in the final-layout browser test produced Not evaluated for both estimates, not zero. This is screening, not assigned guide/stop reactions.

All seven receipt code strings and all three complete gravity table text strings were byte-equal between existing/new UIs and before/after local preview edits. Export-route navigation to existing loads was verified with equal receipt/tables before the last receipt-invalidation-only reload; file download itself NOT_RUN. Final source session also independently verified equal receipt/tables after edit/restore.

Final ordered receipt hashes (identities vary on replay; values above remained equal):

1. Moment retention fnv1a64:9f6770ee6594005d
2. Common Input fnv1a64:fb9e64489269ffd8
3. Common seal fnv1a64:e97273a09d02be1c
4. Run authorization fnv1a64:de9c3589184b58da
5. Mass projection fnv1a64:29ba5337ed5bf5b8
6. Distribution fnv1a64:42383904052ef631
7. Receipt fnv1a64:59098c768767965b

Proof captures: load-calc-workbench-results-v32-summary.png and load-calc-workbench-results-v32-screening.png. Browser transport occasionally timed out while import/Run completed; following DOM outcome was inspected and no duplicate Run was issued blindly. A stale tab-12 focus failure was handled by a fresh tab in the same browser. No hidden page stores or injected page calculations were accessed.

SHA256 custody: actual Sjson 1e75a288545b771d2292cf730ca19d943e40fa547244478038da65eb8e4fc39a; summary PNG 34541f45fb38853aa6df8737c38a23a0e65f569d5560c4bded832cea2675fea8; screening PNG bff6e89168638630e6b5fd81a4bde98d347987f26f1afb688ed00a045e10771c.

## Validation

PASS executable checks:

- node scripts/load-calc-workbench-check.mjs — input authority, unavailable preparation, injected results seam and binding reset; adapted old stage-four placeholder assertion to the explicit result host (stage-three runner remains disabled).
- node scripts/load-calc-workbench-results-check.mjs — existing renderer delegation; signed synthetic force/moment/anchor fields including zero; stale/source/proposal/authorization/execution/overlay negatives; current vs historical/blocked summary values; input immutability; no alternate authorizer/runner.
- node scripts/load-calc-empirical-screening-binding-check.mjs
- node scripts/load-calc-empirical-screening-check.mjs
- node scripts/load-calc-quantity-scope-check.mjs
- node scripts/load-calc-selection-currentness-check.mjs
- node scripts/load-calc-common-input-currentness-check.mjs
- node scripts/load-calc-current-common-input-run-routing-check.mjs
- node scripts/empirical-load-calc-scenario-check.mjs
- node scripts/empirical-result-overlay-check.mjs
- npm run check:imports
- node scripts/advanced-shell-contract-check.mjs
- npm run build (final 17.97 s, bundle check PASS)
- git diff --check

Existing Node-relative master URL seeding warnings and build externalization/circular/large-chunk warnings remain. They are not successful master loading/qualification evidence. Previously recorded master-data-containment regex failure, calc-workspace runner/profile failure and shared-model source-guard failure are NOT CLEARED and NOT_RUN this leg. Full non-FEA suite, actual beam/contact source qualification, full-vector Sjson solve and exported download verification NOT_RUN.

## Changed-file explanation

- src/workspace/load-calc-workbench/results-view.js: reuse existing result renderers, guarded scenario display, compact existing-audit summaries and presentation-only folding.
- src/workspace/load-calc-workbench/current-results.js: current owner snapshots and existing current-authorization check, not new approval/execution.
- src/workspace/load-calc-workbench/current-review.js: result/receipt invalidation alongside existing input binding; distribution has no embedded semanticHash so hash its actual content.
- src/workspace/load-calc-workbench/workbench-controller.js: injected stage-four renderer, withheld for unavailable prepared review.
- src/workspace/load-calc-workbench/workbench-runtime.js: bind that renderer in the production prepared workbench only.
- src/workspace/load-calc-workbench/workbench-view.js: result host, truthful result/footer labels; preserve source prototype and existing calculation boundary.
- src/workspace/load-calc-workbench/workbench.css: result-only scoped cards, tables and disclosures.
- src/workspace/load-calc-consumer-view.js: change the existing workbench header label to INPUTS & RESULTS; prior dirty changes untouched.
- scripts/load-calc-workbench-check.mjs: intentional new-stage assertion and injected unavailable-result guard.
- scripts/load-calc-workbench-results-check.mjs: new bounded presentation/currentness falsifiers.
- relay/WORK/load-calc-workbench-results-v32-plan.md, this evidence file and two PNGs: scoped plan/evidence/browser custody.
- relay/GENERATED/tasks/load-calc-sjson.continuity.json: derived existing-responsibility continuation; units/progress unchanged.

## TASK_RESULT

ResultScope: STEP
ResponsibilityComplete: NO
Coverage: stage-four integration and actual gravity/screening display verified; configured scenario display guarded and synthetically tested, not solved on actual source.
Progress/Evidence: 1/3 outcome units, 33/33%; no credit for partial UI/tests.
Next: exact source/qualified restraint-basis input preview and existing scenario preparation for the requested projections; retain no-invented-restraint/stiffness/friction/axis boundary. The read-only workbench still cannot run directly. Legacy validation failures remain open.
