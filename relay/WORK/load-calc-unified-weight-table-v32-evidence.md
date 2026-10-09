# STEP evidence — one editable weight review

Owner said yes to consolidating the diagnostic accordion and catalogue review into the second screenshot's editable table. Policy: live Common engineering-pr-delivery-v3.2 at 149770a21ca073df49717a96e2106c967adddc2d; fully re-grounded before this leg, including responsibility continuity. ENGINEERING_CRITICAL input acceptance boundary; no new numerical, source/master, solver, result publication or release authority.

## Changes in this leg

- `src/workspace/load-calc-consumer-controller.js`: primary Weights & contents entry uses the existing catalogue-review owner, no active read-only popup route.
- `src/workspace/enrichment/non-fea-enrichment-view.js`: exported shared catalogue entry, binds source/master/accepted/proposed/stale state; explicit Apply uses the validated enrichment transaction.
- `src/workspace/enrichment/non-fea-enrichment-store.js`: atomic explicit component-weight acceptance through existing proposal/acceptance/sidecar validation. Rejects stale, invalid, duplicate, wrong-field, unsupported authority, unreviewed zero and nonfinite/negative entries before mutation; preserves unrelated proposals and records.
- `src/workspace/load-calc-fitting-weight-dialog.js`: one editable table, ID/description search, nested configurable settings, draft retention, row and filtered bulk Skip→0kg, editable no-bore/no-master rows, concise help. Suggested/entered/zero draft labels are distinct. Blank remains pending. Cancel writes nothing. Apply validates the entire shown batch before closing, with failure remaining visible.
- `scripts/load-calc-pending-weight-review-check.mjs`: invalid shown entry now proves no partial Apply; zero acceptance tested separately.
- `scripts/load-calc-unified-weight-table-check.mjs`: new source/master immutability, positive catalogue custody, explicit zero, atomic invalid/stale/unrelated-proposal, missing-input, filtering, draft labels and route-consolidation checks.
- This plan, evidence, PNG and derived continuity record document this scoped step. Other dirty files are earlier legs and preserved.

## Executed validation

PASS: load-calc-unified-weight-table-check, load-calc-pending-weight-review-check, load-calc-weight-review-policy-check, load-calc-manual-weight-review-scope-check, load-calc-preview-check, load-calc-workbench-check, load-calc-workbench-migration-check, load-calc-workbench-integration-check, load-calc-loads-to-draft-check, load-calc-direct-instrument-weight-check, load-calc-approximate-match-preview-check, load-calc-insulation-input-check, load-calc-support-mapping-check, non-fea-enrichment-migration-check.

PASS: import-check, advanced-shell-contract-check, npm run build (final source including draft-label fix), git diff --check. Existing externalized Node module/circular/large-chunk warnings remain; bundle check PASS, 2103 modules/82 chunks.

Broad run-non-fea-checks: NOT_RUN this leg. Prior FAIL due missing `benchmarks/LFEA/BM2/Input_BM2.xml` remains unresolved; no whole-suite PASS claim. Numerical Run, full-vector scenario/Fa/Fl/global moments: NOT_RUN / NOT_CONFIGURED; this is not load completion.

## Actual browser connector proof

Local in-app browser tab20, localhost5174/AA3, imported actual Sjson.json through file chooser; fresh test model, separate from prior 203-record fixture. Initial UI: 105 pending proposals and67 accepted records.

1. Main Weights & contents opened Component weight review editable catalogue table with28 unresolved manual equipment. No accordion/UNSUPPORTED_COMPONENT_TYPE substitute.
2. Typed valve51236 draft400kg; settings disabled flanges →6 items with400 preserved, then reset defaults →28. No weight Apply from settings.
3. Filter51234, bulk Skip→0; Cancel/reopen restored59kg suggestion and28 pending, proving no autosave. Final-source zero draft correctly labeled Zero assumption · not applied.
4. Filter51284 angle control, Skip→0 and explicit Apply →68 accepted; reopen27 unresolved/1 retained.
5. Filter51234 flange, suggested59kg and explicit Apply →69 accepted; reopen26 unresolved/2 retained. All105 unrelated proposals remained pending throughout.
6. Review master proposals displayed51284 COMPONENT_WEIGHT0kg ACCEPTED_OVERRIDE, manual-weight-review source-bound evidence;51234 COMPONENT_WEIGHT59kg EXACT_APPROVED_MASTER, wtValveweights.json hash72e266002256e2ac0b0c0c9c722dde2bb65e93deec2075d209c7ab78d219cda2. Preview still reported other incomplete mass coverage, not fake numerical readiness.
7. Alternate Review catalogue fitting weights entry opened the same26-row editable dialog. Returned to main Weights & contents and left it open as deliverable.

Proof: `load-calc-unified-weight-table-v32.png` (actual final browser screenshot). No live result package calculated, no protected data modified, no PR commit/push or merge/release. Existing pipe-equivalent fitting path, gasket0 default, instrument>100mm policy, approved skips and source precedence preserved.

STEP complete for unified editable review. Broader responsibility remains incomplete; keep full-vector inputs/profile authority and missing BM2 fixture as separate owned next work.
