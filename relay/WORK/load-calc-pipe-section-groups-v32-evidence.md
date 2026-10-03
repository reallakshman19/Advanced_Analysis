# TASK_EVIDENCE — single pipe basis, dependent fitting weights

Owner: implement branch+bore pipe review with aligned summary/table counts and reuse the previously approved DN150/200/250 weight-only inputs. Live Common v3.2 re-grounded at 149770a21ca073df49717a96e2106c967adddc2d; same responsibility. ENGINEERING_CRITICAL, STEP scope. No source/master precedence, material grade, class identity, fitting formula, CoG, coordinate, result or release authority changed.

## Changed files in this leg

- `src/workspace/load-calc-workbench/pipe-section-review.js`: pure shared pipe-only issue predicate, branch+bore grouping and fitting dependency links. Unknown identities remain separate; existing core owns actual section selection and conflicts.
- `src/workspace/load-calc-workbench/approved-pipe-weight-inputs.js`: explicit button applies only complete, current proposal groups for the exact previously approved Sjson semantic hash. PIPE target, source bore, master revision/hash, line-list hash, source binding, three permitted fields, units and numeric-value guards; prevalidates the entire set before using existing approximate-match acceptance owner. No automatic import approval, grade, class identity or equipment weights. The 1e-8 comparison accounts for serialized numeric values, not any benchmark tolerance.
- `src/workspace/load-calc-workbench/current-review.js`: exposes eligible prior-approved pipe count from current preparation.
- `src/workspace/load-calc-workbench/workbench-model.js`: card and section tab use the same pipe-only predicate; dependency navigation can filter exact bore.
- `src/workspace/load-calc-workbench/workbench-controller.js`: grouped section rendering; routes explicit apply/navigation to existing owner; changing branch/category clears the linked bore filter.
- `src/workspace/load-calc-workbench/workbench-view.js`: grouped pipe table with collapsed dependent fitting lists, prior-approved-input button, and fitting-to-pipe links instead of independent fitting section prompts.
- `src/workspace/load-calc-consumer-controller.js`: existing route owns linked group navigation and explicit prior-approved proposal application; refreshes current preparation afterward.
- `src/workspace/load-calc-preview-table.js`, `src/workspace/load-calc-preview-view.js`: same pipe dependency wording/link in editable Preview; no extra fitting section mutation.
- `src/workspace/load-calc-workbench/workbench.css`: scoped group styling.
- `scripts/load-calc-workbench-check.mjs`: pipe-only section filter expectation replaces old independent fitting-section population.
- `scripts/load-calc-pipe-section-groups-check.mjs`: actual byte-bound Sjson regression, same count predicate, complete approved-group acceptance, unrelated pending equipment retention, stale/source/master/revision/units/value/field/non-PIPE negatives, immutable source inputs, unchanged independent annulus/fitting formula and location.
- Plan, evidence, screenshots and derived continuity only. Earlier uncommitted changes preserved; primary checkout untouched.

## Validation

PASS: new pipe-section-groups regression; workbench, preview, weight-location-status, weight-review-policy, fitting-section-selection, source-bore-selection, workbench-migration, workbench-integration, pending-weight-review, unified-weight-table, current-common-input-empirical-mass-projection, non-fea-component-cog-fallback-policy checks (13 focused checks). PASS imports, shell contract, build (2105 modules, 83 chunks), diff check. Existing Node relative-fetch warning and build externalization/circular/large-chunk warnings retained.

Initial test failure exposed source hash differences between default normalization and actual byte-bound import. Test now preserves sourceBytes/SHA256 exactly as real import; production source guard was not loosened. Additional guard test initially used absent normalized nominal bore; corrected to consume existing preserved arrive/leave bore evidence, rejecting conflicting known bores.

Broad non-FEA NOT_RUN this leg; previously recorded missing `benchmarks/LFEA/BM2/Input_BM2.xml` FAIL unresolved. No full-vector run, Fa/Fl/global moments NOT_RUN, full-vector scenario NOT_CONFIGURED.

## Actual browser connector

Selected browser2 retained, fresh actual app tab22 at localhost5174/AA3; fixture imported via file chooser. Baseline67 accepted /105 proposed fields. Before Apply: card35 pipe components and section table35, nine branch+bore groups,29 dependent fittings. Elbow51207 showed Uses branch pipe section, Waiting for pipe section and no independent OD/wall/density review; its Review pipe basis link opened the exact S8810111/B2 DN150 group (3pipes/4fittings).

Explicit Apply previously approved weight inputs (35pipes) succeeded through real UI. Accepted records67→172, proposed fields105→0; section issues35→0; strict checker mass coverage38/127→96/127 but gate readiness remains5/8. Equipment review remains28 unresolved items. Elbow51207 dry mass13.68852703538862kg, shown13.6885kg, using borrowed pipe OD168.3/wall14.2748/rho7850. Independent unchanged annulus times1.5OD check agrees. No CoG fabricated: dry mass known, load placement still pending.

Screenshots `load-calc-pipe-section-groups-v32-before.png` and `load-calc-pipe-section-groups-v32.png` saved from actual UI. Tab22 retained at corrected elbow row. Original approved readiness fixture preserved; browser is a fresh test session. No commit, push, merge or release this leg.

STEP complete: pipe-section grouping/count/application fix. Responsibility incomplete: equipment/placement/method qualification and full-vector loads remain separate.
