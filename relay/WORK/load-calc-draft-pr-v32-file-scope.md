# Draft PR file-scope manifest

Every path below is explicitly selected from accumulated load-calc work. Unrelated 3D/viewport changes (including event-topic-ids.js) and uncommitted legacy agent-chain artifacts remain local, unstaged. Seven existing load-calc documentation commits already on local main remain ancestry relative to origin/main; their historical contents are not rewritten.

## Review blockers, not qualification claims

This accumulated draft contains changes to mass evidence, source/master binding and routing, not just UI. In particular master-data-ui.js auto-accepts catalogue candidates and rebinds source references, and ProjectDataStore.syncAuthorityHashes rewrites dataset-backed evidence while retaining values. Review must establish that weights remain appropriately reviewed and old-source approvals are not laundered onto replacement sources. This packaging leg does not qualify or approve those behaviors, change production to clear them, or merge them. Existing tests and partial browser gravity results are insufficient authority evidence.

Actual beam/contact source inputs are not configured. Fv/Fa/Fl/moments and direct new-workbench Run remain incomplete. The engineering responsibility is NOT complete.

## Selected files

- `docs/load calc/load-calc-workbench-spec-and-implementation-plan.md` — Full workbench specification and phased implementation boundaries.
- `prototypes/load-calc-workbench/README.md` — Source-only reference prototype README.md for the approved workbench design; not a production calculation authority.
- `prototypes/load-calc-workbench/check.mjs` — Source-only reference prototype check.mjs for the approved workbench design; not a production calculation authority.
- `prototypes/load-calc-workbench/index.html` — Source-only reference prototype index.html for the approved workbench design; not a production calculation authority.
- `prototypes/load-calc-workbench/workbench-model.js` — Source-only reference prototype workbench-model.js for the approved workbench design; not a production calculation authority.
- `prototypes/load-calc-workbench/workbench-view.js` — Source-only reference prototype workbench-view.js for the approved workbench design; not a production calculation authority.
- `prototypes/load-calc-workbench/workbench.css` — Source-only reference prototype workbench.css for the approved workbench design; not a production calculation authority.
- `prototypes/load-calc-workbench/workbench.js` — Source-only reference prototype workbench.js for the approved workbench design; not a production calculation authority.
- `relay/GENERATED/tasks/load-calc-sjson.continuity.json` — Derived v3.2 continuity for the same responsibility; STEP only, 1/3 outcome units.
- `relay/WORK/load-calc-draft-pr-v32-plan.md` — Canonical v3.2 load-calc-draft-pr-v32-plan.md records bounded plan/evidence/progress; no legacy relay writes.
- `relay/WORK/load-calc-exception-review-v32-evidence.md` — Canonical v3.2 load-calc-exception-review-v32-evidence.md records bounded plan/evidence/progress; no legacy relay writes.
- `relay/WORK/load-calc-exception-review-v32-plan.md` — Canonical v3.2 load-calc-exception-review-v32-plan.md records bounded plan/evidence/progress; no legacy relay writes.
- `relay/WORK/load-calc-fh-auto-binding-v32-browser.png` — Prior actual-browser proof capture retained with its leg-specific evidence custody; not a fresh clean-commit browser run.
- `relay/WORK/load-calc-fh-auto-binding-v32-evidence.md` — Canonical v3.2 load-calc-fh-auto-binding-v32-evidence.md records bounded plan/evidence/progress; no legacy relay writes.
- `relay/WORK/load-calc-fh-auto-binding-v32-plan.md` — Canonical v3.2 load-calc-fh-auto-binding-v32-plan.md records bounded plan/evidence/progress; no legacy relay writes.
- `relay/WORK/load-calc-fh-screening-v32-browser.png` — Prior actual-browser proof capture retained with its leg-specific evidence custody; not a fresh clean-commit browser run.
- `relay/WORK/load-calc-fh-screening-v32-evidence.md` — Canonical v3.2 load-calc-fh-screening-v32-evidence.md records bounded plan/evidence/progress; no legacy relay writes.
- `relay/WORK/load-calc-fh-screening-v32-plan.md` — Canonical v3.2 load-calc-fh-screening-v32-plan.md records bounded plan/evidence/progress; no legacy relay writes.
- `relay/WORK/load-calc-quantity-scope-v32-browser.png` — Prior actual-browser proof capture retained with its leg-specific evidence custody; not a fresh clean-commit browser run.
- `relay/WORK/load-calc-quantity-scope-v32-evidence.md` — Canonical v3.2 load-calc-quantity-scope-v32-evidence.md records bounded plan/evidence/progress; no legacy relay writes.
- `relay/WORK/load-calc-quantity-scope-v32-plan.md` — Canonical v3.2 load-calc-quantity-scope-v32-plan.md records bounded plan/evidence/progress; no legacy relay writes.
- `relay/WORK/load-calc-selection-currentness-v32-browser.png` — Prior actual-browser proof capture retained with its leg-specific evidence custody; not a fresh clean-commit browser run.
- `relay/WORK/load-calc-selection-currentness-v32-evidence.md` — Canonical v3.2 load-calc-selection-currentness-v32-evidence.md records bounded plan/evidence/progress; no legacy relay writes.
- `relay/WORK/load-calc-selection-currentness-v32-plan.md` — Canonical v3.2 load-calc-selection-currentness-v32-plan.md records bounded plan/evidence/progress; no legacy relay writes.
- `relay/WORK/load-calc-v32-units.json` — Canonical v3.2 load-calc-v32-units.json records bounded plan/evidence/progress; no legacy relay writes.
- `relay/WORK/load-calc-workbench-results-v32-evidence.md` — Canonical v3.2 load-calc-workbench-results-v32-evidence.md records bounded plan/evidence/progress; no legacy relay writes.
- `relay/WORK/load-calc-workbench-results-v32-plan.md` — Canonical v3.2 load-calc-workbench-results-v32-plan.md records bounded plan/evidence/progress; no legacy relay writes.
- `relay/WORK/load-calc-workbench-results-v32-screening.png` — Prior actual-browser proof capture retained with its leg-specific evidence custody; not a fresh clean-commit browser run.
- `relay/WORK/load-calc-workbench-results-v32-summary.png` — Prior actual-browser proof capture retained with its leg-specific evidence custody; not a fresh clean-commit browser run.
- `scripts/authorized-empirical-ancillary-distributed-mass-check.mjs` — Focused executable regression/falsifier for authorized empirical ancillary distributed mass; no oracle/tolerance relaxation.
- `scripts/authorized-empirical-effective-support-guard-check.mjs` — Focused executable regression/falsifier for authorized empirical effective support guard; no oracle/tolerance relaxation.
- `scripts/authorized-empirical-ledger-readiness-check.mjs` — Focused executable regression/falsifier for authorized empirical ledger readiness; no oracle/tolerance relaxation.
- `scripts/current-common-input-empirical-mass-projection-check.mjs` — Focused executable regression/falsifier for current common input empirical mass projection; no oracle/tolerance relaxation.
- `scripts/current-common-input-empirical-support-load-execution-check.mjs` — Focused executable regression/falsifier for current common input empirical support load execution; no oracle/tolerance relaxation.
- `scripts/current-common-input-handcalc-mass-support-parity-check.mjs` — Focused executable regression/falsifier for current common input handcalc mass support parity; no oracle/tolerance relaxation.
- `scripts/load-calc-approximate-match-preview-check.mjs` — Focused executable regression/falsifier for load calc approximate match preview; no oracle/tolerance relaxation.
- `scripts/load-calc-common-input-currentness-check.mjs` — Focused executable regression/falsifier for load calc common input currentness; no oracle/tolerance relaxation.
- `scripts/load-calc-empirical-screening-binding-check.mjs` — Focused executable regression/falsifier for load calc empirical screening binding; no oracle/tolerance relaxation.
- `scripts/load-calc-empirical-screening-check.mjs` — Focused executable regression/falsifier for load calc empirical screening; no oracle/tolerance relaxation.
- `scripts/load-calc-exception-review-check.mjs` — Focused executable regression/falsifier for load calc exception review; no oracle/tolerance relaxation.
- `scripts/load-calc-fitting-section-selection-check.mjs` — Focused executable regression/falsifier for load calc fitting section selection; no oracle/tolerance relaxation.
- `scripts/load-calc-insulation-input-check.mjs` — Focused executable regression/falsifier for load calc insulation input; no oracle/tolerance relaxation.
- `scripts/load-calc-line-list-row-provenance-check.mjs` — Focused executable regression/falsifier for load calc line list row provenance; no oracle/tolerance relaxation.
- `scripts/load-calc-manual-weight-review-scope-check.mjs` — Focused executable regression/falsifier for load calc manual weight review scope; no oracle/tolerance relaxation.
- `scripts/load-calc-preview-check.mjs` — Focused executable regression/falsifier for load calc preview; no oracle/tolerance relaxation.
- `scripts/load-calc-quantity-scope-check.mjs` — Focused executable regression/falsifier for load calc quantity scope; no oracle/tolerance relaxation.
- `scripts/load-calc-run-ready-snapshot-check.mjs` — Focused executable regression/falsifier for load calc run ready snapshot; no oracle/tolerance relaxation.
- `scripts/load-calc-selection-currentness-check.mjs` — Focused executable regression/falsifier for load calc selection currentness; no oracle/tolerance relaxation.
- `scripts/load-calc-source-bore-selection-check.mjs` — Focused executable regression/falsifier for load calc source bore selection; no oracle/tolerance relaxation.
- `scripts/load-calc-weight-review-check.mjs` — Focused executable regression/falsifier for load calc weight review; no oracle/tolerance relaxation.
- `scripts/load-calc-workbench-check.mjs` — Focused executable regression/falsifier for load calc workbench; no oracle/tolerance relaxation.
- `scripts/load-calc-workbench-results-check.mjs` — Focused executable regression/falsifier for load calc workbench results; no oracle/tolerance relaxation.
- `scripts/loadcalc-binding-currentness-structural-check.mjs` — Focused executable regression/falsifier for loadcalc binding currentness structural; no oracle/tolerance relaxation.
- `scripts/non-fea-3d-investigation-check.mjs` — Focused executable regression/falsifier for non fea 3d investigation; no oracle/tolerance relaxation.
- `scripts/non-fea-calculation-effective-values-inspection-check.mjs` — Focused executable regression/falsifier for non fea calculation effective values inspection; no oracle/tolerance relaxation.
- `scripts/non-fea-common-enriched-configured-default-overlay-check.mjs` — Focused executable regression/falsifier for non fea common enriched configured default overlay; no oracle/tolerance relaxation.
- `scripts/non-fea-gravity-product-default-bootstrap-check.mjs` — Focused executable regression/falsifier for non fea gravity product default bootstrap; no oracle/tolerance relaxation.
- `scripts/non-fea-product-engineering-default-runtime-resolution-check.mjs` — Adapt actual provider-wrapper wiring guard with executable exact-receipt and existing precedence/single-resolver assertions.
- `src/calc-workspace/supportLoadEngine.js` — Expose existing guide/line-stop formula terms as unsigned screening only; no solver or force assignment.
- `src/core/model-loads/component-mass-resolver.js` — Separate mass-value evidence from placement qualification; retain placement-strict primitive creation.
- `src/core/model-loads/elbow-derived-mass.js` — Select consistent same-branch source-bore section for legacy pipe-equivalent fitting estimates; retain approximation disclosure.
- `src/core/model-loads/load-source-projection.js` — Carry source-port bore evidence and explicit approved missing-length-unit fallback with authority binding.
- `src/core/shared-piping-model/adapters/workspace-dataset-to-shared.js` — Preserve source-port bore compatibility evidence during source normalization.
- `src/core/shared-piping-model/source-port-bore-evidence.js` — Collect source-port bore evidence without treating nominal bore as an outer diameter.
- `src/workspace/engineering-loads/current-common-input-empirical-mass-projection.js` — Consume mass-value seam, approved unit fallback and missing-only insulation profile receipt.
- `src/workspace/engineering-loads/non-fea-empirical-run-authorization-runtime.js` — Compare required method identity sets independent of ordering, preserving exact members.
- `src/workspace/engineering-loads/production-governed-empirical-projection.js` — Allow absent optional line-list identity in gravity binding; validate present hashes.
- `src/workspace/engineering-model-controller.js` — Invalidate current distribution on Common Input configuration or retained-seal staleness.
- `src/workspace/engineering-model-store.js` — Retain nullable absent line-list binding; present identities remain SHA-256 checked.
- `src/workspace/enrichment/approximate-match-preview.js` — Display complete proposed approximate-match groups and explicit confirmation before atomic acceptance.
- `src/workspace/enrichment/non-fea-enrichment-store.js` — Separate approximate-match group confirmation from exact-proposal automatic acceptance.
- `src/workspace/enrichment/non-fea-enrichment-view.js` — Connect match preview, weight popup and exact-only acceptance labels.
- `src/workspace/load-calc-consumer-controller.js` — Connect preview/workbench routes, weight dialog, existing owner navigation and screening context.
- `src/workspace/load-calc-consumer-view.js` — Expose workbench, quantity scope, exact exceptions and unsigned screening using existing gravity renderer.
- `src/workspace/load-calc-current-system-view.js` — Preserve current-system authority rendering and rebind presentation-only screening controls.
- `src/workspace/load-calc-empirical-screening-binding.js` — Bounded load calc empirical screening binding projection/UI; retain source/effective/proposed separation and explicit unavailable values.
- `src/workspace/load-calc-empirical-screening.js` — Bounded load calc empirical screening projection/UI; retain source/effective/proposed separation and explicit unavailable values.
- `src/workspace/load-calc-exception-review.js` — Bounded load calc exception review projection/UI; retain source/effective/proposed separation and explicit unavailable values.
- `src/workspace/load-calc-fitting-weight-review.js` — Limit catalogue review families and offer bore/rating candidates when length ranking is unavailable.
- `src/workspace/load-calc-insulation-input.js` — Bounded load calc insulation input projection/UI; retain source/effective/proposed separation and explicit unavailable values.
- `src/workspace/load-calc-master-candidates.js` — Carry exact source binding and proposed class/section provenance into match review.
- `src/workspace/load-calc-preview-model.js` — Bounded load calc preview model projection/UI; retain source/effective/proposed separation and explicit unavailable values.
- `src/workspace/load-calc-preview-table.js` — Bounded load calc preview table projection/UI; retain source/effective/proposed separation and explicit unavailable values.
- `src/workspace/load-calc-preview-view.js` — Bounded load calc preview view projection/UI; retain source/effective/proposed separation and explicit unavailable values.
- `src/workspace/load-calc-quantity-scope.js` — Bounded load calc quantity scope projection/UI; retain source/effective/proposed separation and explicit unavailable values.
- `src/workspace/load-calc-weight-review-dialog.js` — Bounded load calc weight review dialog projection/UI; retain source/effective/proposed separation and explicit unavailable values.
- `src/workspace/load-calc-weight-review-model.js` — Bounded load calc weight review model projection/UI; retain source/effective/proposed separation and explicit unavailable values.
- `src/workspace/load-calc-weight-review-scope.js` — Bounded load calc weight review scope projection/UI; retain source/effective/proposed separation and explicit unavailable values.
- `src/workspace/load-calc-workbench/current-results.js` — Prepared read-only workbench current-results.js: input/result owner projection, currentness, presentation or injected controller seam; no new runner.
- `src/workspace/load-calc-workbench/current-review.js` — Prepared read-only workbench current-review.js: input/result owner projection, currentness, presentation or injected controller seam; no new runner.
- `src/workspace/load-calc-workbench/prepared-review.js` — Prepared read-only workbench prepared-review.js: input/result owner projection, currentness, presentation or injected controller seam; no new runner.
- `src/workspace/load-calc-workbench/results-view.js` — Prepared read-only workbench results-view.js: input/result owner projection, currentness, presentation or injected controller seam; no new runner.
- `src/workspace/load-calc-workbench/workbench-controller.js` — Prepared read-only workbench workbench-controller.js: input/result owner projection, currentness, presentation or injected controller seam; no new runner.
- `src/workspace/load-calc-workbench/workbench-model.js` — Prepared read-only workbench workbench-model.js: input/result owner projection, currentness, presentation or injected controller seam; no new runner.
- `src/workspace/load-calc-workbench/workbench-runtime.js` — Prepared read-only workbench workbench-runtime.js: input/result owner projection, currentness, presentation or injected controller seam; no new runner.
- `src/workspace/load-calc-workbench/workbench-shell.css` — Prepared read-only workbench workbench-shell.css: input/result owner projection, currentness, presentation or injected controller seam; no new runner.
- `src/workspace/load-calc-workbench/workbench-view.js` — Prepared read-only workbench workbench-view.js: input/result owner projection, currentness, presentation or injected controller seam; no new runner.
- `src/workspace/load-calc-workbench/workbench.css` — Prepared read-only workbench workbench.css: input/result owner projection, currentness, presentation or injected controller seam; no new runner.
- `src/workspace/master-data-events-handler.js` — Preserve actual Excel row identity including blank rows and nonzero sheet range origin.
- `src/workspace/master-data-ui.js` — Accumulated master proposal generation, catalogue candidate acceptance and source auto-binding changes; engineering review required, not qualified by this draft.
- `src/workspace/non-fea-common-input-runtime.js` — Use governed missing-only insulation wrapper in the single canonical resolver.
- `src/workspace/non-fea-input-check-view.js` — Expose weight review and distinguish missing mass dependencies from catalogue review.
- `src/workspace/project-data/non-fea-calculation-defaults-view.js` — Connect explicit field-change application through existing governed update owner.
- `src/workspace/project-data/non-fea-common-enriched-configured-default-overlay.js` — Normalize identical-scale kg/m³ spelling to the contract kg/m3 unit.
- `src/workspace/project-data/non-fea-product-engineering-default-profile.js` — Declare owner-requested missing-only 0 mm insulation default with method scope.
- `src/workspace/project-data/project-data-contract.js` — Accumulated optional-line-list/empty-section-map validation changes; authority behavior requires engineering review.
- `src/workspace/project-data/project-data-store.js` — Accumulated automatic authority-hash synchronization; review preservation of source custody across dataset/master replacement before merge.
- `src/workspace/routes/route-partition-model.js` — Keep zero-length point-only route coordinates explicit; do not invent a length or lever arm.
- `src/workspace/shared-model-controller.js` — Avoid rebuilding engineering authority on selection-only workspace notifications.

