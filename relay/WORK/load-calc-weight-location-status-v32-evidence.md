# TASK_EVIDENCE — known weight / missing load location

Owner: fix the accepted59kg flange showing Review equipment weight, Pending core and irrelevant pending pipe-section fields. Live Common v3.2 re-grounded at149770a21ca073df49717a96e2106c967adddc2d; same responsibility. Presentation-only ENGINEERING_CRITICAL scope. No production core resolver, application-point fallback, formula, source/master authority, approval, result semantics or release changes.

## Changed files and boundaries

- `src/workspace/load-calc-preview-model.js`: reuses existing resolveComponentCaseMassValues only for observational point dry mass, alongside unchanged strict case/core values. Shared status separates applied/source/zero/stale weight from placement readiness. Does not invent a section or application point.
- `src/workspace/load-calc-preview-table.js`: known point dry mass displayed separately; accepted59kg green status, readable CoG warning, section-not-required explanation instead of meaningless Pending fields. Raw blocker/source trace retained. Insulation explicitly not included in point dry mass.
- `src/workspace/load-calc-preview-view.js`: corrects obsolete Skip wording; explicit Skip→0 remains draft until Apply, known dry mass vs placement explained.
- `src/workspace/load-calc-workbench/workbench-view.js`: same weight/mass/section presentation in main table; placement warning always visible even with another pending proposal. Main source/proposal evidence retained.
- `src/workspace/load-calc-workbench/workbench-model.js`: equipment-weight issue count uses missing dry weight rather than missing placement; non-required point-weight section no longer counted as missing. Strict readiness/coverage and overall unresolved state unchanged. Friendly CoG wording.
- `scripts/load-calc-weight-location-status-check.mjs`: applied/source/zero/negative/missing/stale/placed regressions across both tables, unaccepted700kg proposal cannot replace59kg, no fabricated OD/location, immutable inputs, strict core/coverage unchanged. Initial failure proved pending-proposal message could mask location warning; fixed by always showing placement separately, final PASS.
- Plan/evidence/PNG and derived continuity document this leg. Earlier dirty work preserved.

## Validation

PASS: load-calc-weight-location-status-check, load-calc-preview-check, load-calc-weight-review-policy-check, load-calc-workbench-check, load-calc-workbench-migration-check, load-calc-workbench-integration-check, load-calc-insulation-input-check, load-calc-unified-weight-table-check, load-calc-pending-weight-review-check, current-common-input-empirical-mass-projection-check, non-fea-component-cog-fallback-policy-check. Last two verify unchanged strict primitive placement and separately governed existing midpoint policy.

PASS: import-check, npm run build (shell and bundle checks included;2103modules/82chunks), git diff --check. Existing relative-fetch Node-test/browser bundle externalization/circular/large-chunk warnings remain. Broad non-FEA NOT_RUN; prior missing benchmarks/LFEA/BM2/Input_BM2.xml FAIL unresolved. No full-vector numerical Run this leg; Fa/Fl/global moments NOT_RUN, full-vector scenario NOT_CONFIGURED.

## Actual browser connector

Previous tab20 stale; selected browser2 reused, fresh tab21 localhost5174/AA3. Actual Sjson.json imported via file chooser, baseline67accepted/105pending proposals. Explicitly applied existing flange51234 catalogue59kg through shared UI, yielding68accepted/105proposals. This is a fresh test tab, not replacement of the previous203-record fixture.

Main table search51234: Weight applied:59kg; dry59/EMPTYfluid0/EMPTYmass(dryonly)59; point-weight basis, OD/wall/density not required; load placement pending and CoG/application-point required. Editable Preview same row confirms all values/status and still retains MISSING_COMPONENT_COG, 0mm fallback and source trace. No Review equipment weight or Pending core for the known dry mass. Checker still5/8 gates ready,39/127 mass coverage; not claimed calculation-ready.

Screenshot `load-calc-weight-location-status-v32.png`: actual browser, horizontally scrolled comparison table to show corrected applied status and separate CoG warning; no viewport override. Tab21 retained. No fabricated CoG, no numerical/result authority writes, no commit/push/merge/release.

STEP complete: requested presentation fixes. Responsibility incomplete: existing separately governed load-location/method qualification and full-vector work remain.
