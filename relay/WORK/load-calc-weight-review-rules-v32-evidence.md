# Configurable weight-review rules — STEP evidence

2026-10-03. Common v3.2 exact149770a21ca073df49717a96e2106c967adddc2d. Owner responsibility unchanged. Local worktree `codex/load-calc-workbench-review`, HEAD2b5dfebba05b1ae75b25d23506be5cf3f0bf0559. Primary checkout untouched. Existing draft PR1915 not updated/pushed this leg.

## Scope and boundaries

Default manual equipment-weight review: flange/blind flange, valve/UZV, control valve, relief/safety valve, and generic instrument with bore strictly greater than100mm. Unknown instrument bore stays visible for classification, not silently assigned zero. Family switches and bore threshold are configurable in a friendly settings table, stored in this browser under AA.loadCalc.weightReviewPolicy.v1. Reset defaults edits the draft; Save persists it. Invalid settings/storage errors are reported without claiming persistence.

Elbow/tee/olet (and existing reducer/cap pipe-like families) retain the existing automatic pipe-equivalent derivation. Gasket missing mass retains the existing0kg resolver default. Explicit source/accepted weights retain precedence. No fitting formula, default numerical evidence, section authority, mass population, source hash, Common input seal, solver, support mapping or result/publication authority changed. Borrowed derivation dimensions are displayed separately from own section evidence; own-section values remain null when absent. UI review preference is not an approval or alternate Run-eligibility rule. Existing203 accepted input records/seven explicit zeros remain unchanged.

## Changed files in this leg

- src/workspace/load-calc-weight-review-scope.js: validated/persisted UI policy, shared family classifier and strict instrument bore threshold.
- src/workspace/load-calc-weight-review-settings.js: configurable family table, numeric threshold, save/cancel/reset and explicit automatic-weight rules.
- src/workspace/load-calc-weight-review-model.js: contextual equipment classification; skip scope uses the same row policy; numerical resolver unchanged.
- src/workspace/load-calc-fitting-weight-review.js: catalogue candidates use the same contextual policy; resolved-item count excludes out-of-scope instruments.
- src/workspace/load-calc-preview-model.js: propagate policy/context and expose borrowedValue separately, preserving own value semantics.
- src/workspace/load-calc-preview-table.js: legacy preview distinguishes automatic/manual weight review and labels borrowed pipe derivation basis.
- src/workspace/load-calc-weight-review-dialog.js: shared policy filtering, settings entry, nested save/reopen and UI binding guard.
- src/workspace/load-calc-workbench/current-review.js: preference change invalidates observational UI binding only.
- src/workspace/load-calc-workbench/workbench-controller.js: settings opening and prepared-review refresh.
- src/workspace/load-calc-workbench/workbench-model.js: equipment-only weight category/issue group and pipe-only section summary.
- src/workspace/load-calc-workbench/workbench-view.js: settings entry, automatic/equipment status and borrowed dimensions projection.
- scripts/load-calc-weight-review-policy-check.mjs: new policy, threshold, family, source precedence, persistence, unchanged derivation, own/borrowed section and real Sjson coverage.
- scripts/load-calc-manual-weight-review-scope-check.mjs: real contextual default28/127 review population and control/instrument distinction.
- scripts/load-calc-pending-weight-review-check.mjs: default28-to4 pending population; preserve historical seven zero input custody and original acceptance negative controls.
- scripts/load-calc-direct-instrument-weight-check.mjs: updated default scope; unchanged actual UZV548kg master/provenance and mismatch/ambiguity/custody checks.
- relay/WORK/load-calc-weight-review-rules-v32-plan.md, this evidence and two PNGs: bounded plan and proof.
- relay/GENERATED/tasks/load-calc-sjson.continuity.json: derived current/next/result continuity only.

Other dirty files belong to previous legs and are not included in this leg's implementation claims.

## Executed validation

PASS: load-calc-weight-review-policy-check; load-calc-manual-weight-review-scope-check; load-calc-preview-check; load-calc-weight-review-check; load-calc-pending-weight-review-check; load-calc-workbench-check; load-calc-workbench-integration-check; load-calc-workbench-migration-check; load-calc-workbench-results-check; load-calc-loads-to-draft-check; load-calc-fitting-section-selection-check; load-calc-direct-instrument-weight-check. PASS: import-check, advanced-shell-contract-check, npm run build (including bundle-chunk-check), git diff --check.

An initial preview regression rejected borrowed dimensions appearing as own section values. Fixed by separate borrowedValue; rerun PASS. Pending/direct-instrument tests initially expected the old31/all-instrument review population; updated only UI-scope expectations to28 with three small instruments excluded, preserving numerical/master and seven historical zero-input assertions; rerun PASS. Migration/draft Node checks log existing browser-relative master fetch warnings; executable assertions pass. Build retains externalization/circular/large-chunk warnings.

Broad run-non-fea-checks NOT_RUN this leg. Previous leg FAIL missing benchmarks/LFEA/BM2/Input_BM2.xml remains unresolved; do not infer whole-suite PASS. Actual full-vector scenario remains NOT_CONFIGURED; Fa/Fl/global moments NOT_RUN. No numerical completion, production approval, merge or release asserted.

## Browser connector verification

Actual localhost5174/AA3 browser tab19, Sjson127 components/279 entities. Default equipment category28/127. Disabling flange review and saving threshold150 produced6/127 valve-family items; reopened settings retained unchecked flange/150 threshold. Reset+Save restored28/127 and100mm. No automatic pipe-like fittings/gaskets in equipment category; generic DN80 flow meter51274 absent, control valve51284 and UZV51250 retained.

Restored existing authorized project-data JSON and explicit-zero sidecar through their UI file choosers, resulting203 accepted records/0 proposals and Input Check ready. All-components search51356 shows elbow dry13.6885kg estimate, borrowed OD168.3mm/wall14.2748mm/density7850kg/m³, Automatic weight and No manual catalogue-weight review. Its technical EMPTY-core/application-point caveat remains visible; dry estimate is not promoted to complete mass evidence. Gasket51235 in initial real preview shows dry0kg and Automatic weight.

Equipment popup shows28 items and0 checker mass-review obligations with existing accepted inputs. Changing flange switch via nested settings refreshes popup to6 items; Reset+Save restores defaults. Closed weight popup, refreshed prepared inputs and left settings open at defaults. Tab19 retained as deliverable. No new catalogue acceptance or numerical Run performed this leg.

Proof: load-calc-weight-review-rules-v32.png (default settings table) and load-calc-weight-review-automatic-v32.png (actual elbow estimate/borrowed basis). Previous read-only 3D Draft loads feature remains protected and its focused check PASS.

## Next

Requested review UI scope/configuration is complete locally. Broader responsibility remains STEP1/3, not complete. Preserve existing all-Skip support choices and authorized scalar gravity flow. Any full-vector continuation requires its existing source-bound scenario/profile/case/restraint authority; UI review switches do not supply it. No commit/push/publication this leg.
