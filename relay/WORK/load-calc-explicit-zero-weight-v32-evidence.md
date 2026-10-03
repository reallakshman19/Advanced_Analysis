# Explicit zero-weight review and actual gravity execution

Owner amendment: assign the seven previously deferred equipment weights to 0 kg. This supersedes the earlier missing-mass wait; it does not declare zero a verified physical/catalogue mass or authorize new restraint/solver/qualification assumptions.

## Why and fix

Skip was review-session deferral only, not a mass input. The popup additionally rejected all values <= 0 even though the existing common checker accepts explicit finite nonnegative component masses. The popup now accepts a typed zero, rejects blanks/negative/nonfinite values, and stages it with ACCEPTED_OVERRIDE/manual-weight-review custody and visible zeroWeightAssumption evidence. Only current reviewed zero overrides are omitted from subsequent pending review; unreviewed master zeros remain pending.

## Actual browser execution — PASS for this bounded workflow

Connector operated isolated localhost:5174/AA3, source Sjson.json, imported existing Project Data revision12 and196 accepted records. Entered seven zeros, staged/accepted seven exact entity overrides, exported the actual203-record sidecar, and clicked Run gravity calculation. A connector mouse-event timeout occurred during Run; the next DOM observation confirmed the calculation had completed. It was not retried blindly.

Targets: =1006649732/51274, /51284, /51462, /51463, /51476, /51483, /51485. All seven new records are COMPONENT_WEIGHT=0 kg, ACCEPTED_OVERRIDE, manual-weight-review, zeroWeightAssumption=true. Deep comparison of actual downloads proves all196 prior records unchanged and only seven records added. Current203-record sidecar hash fnv1a64:8a5a4998e8eb1738; source fnv1a64:46ec305d089d59eb. Saved browser-exported file: load-calc-explicit-zero-weight-v32-sidecar.json. No source/master bytes or original checkout changed.

Current checker8/8 gates; proposals0; accepted203. Actual execution authority EXECUTED_CURRENT_SYSTEM, authorization/execution freshness CURRENT. Method CHAINAGE_TRIBUTARY_SPAN_V2. Overall result CALCULATED_WITH_EXCEPTIONS, not a complete vector calculation or release.

| Case | Evaluated gravity N | Allocated gravity N | Unallocated gravity N | Support rows | Exceptions |
| --- | ---: | ---: | ---: | ---: | ---: |
| EMPTY | 80495.314 | 79790.710 | 704.604 | 37 | 81 |
| OPE | 81595.616 | 80890.933 | 704.683 | 37 | 81 |
| HYD | 96917.728 | 96211.950 | 705.778 | 37 | 81 |

Excluded inputs0. Remaining unallocated demand belongs to source routes lacking a qualified route-local bearing path. Overhang transfer moments are separate signed member demands, not solved global support moments. EMPTY/OPE coverage99.1%; HYD99.3%. The missing configured scenario did NOT block gravity; that earlier implication is corrected. Configured beam/contact remains NOT_CONFIGURED, so Fa/Fl/global moments remain NOT_RUN; existing unsigned Fh screening is not a solved full-vector reaction.

Exact visible receipt bindings: Common Input fnv1a64:301bf760d98825aa; seal fnv1a64:59dad1152d8e36c5; authorization fnv1a64:b45e420e6e0077a9; mass projection fnv1a64:4c92f4af6167575d; distribution fnv1a64:3dc7ffffc47a6fcd; receipt fnv1a64:f28f675414f2d1e7; moment retention fnv1a64:ca59cd82300c0743. Separate source-moment demands0. No legacy publication/human approval asserted.

Proof: load-calc-explicit-zero-weight-v32-popup.png and load-calc-explicit-zero-weight-v32-results.png captured from actual connector UI. Browser tab15 retained for continuation.

## File manifest

- src/workspace/load-calc-fitting-weight-dialog.js: explicit zero vs blank parsing; zero always manual; disclosure.
- src/workspace/load-calc-fitting-weight-review.js: zero assumption evidence and current reviewed-zero pending filter.
- src/workspace/enrichment/non-fea-enrichment-view.js: truthful zero-assumption acceptance rationale.
- scripts/load-calc-pending-weight-review-check.mjs: blank/negative/nonfinite guards, current/stale zero custody, seven-zero pending resolution.
- relay/WORK/load-calc-explicit-zero-weight-v32-plan.md: recorder-first bounded owner amendment.
- This evidence, two screenshots, browser-exported sidecar: actual outcome/custody, not fabricated expected values.
- relay/WORK/load-calc-ui-migration-v32-pr-body.md and continuity snapshot: current outcome/next-step projection, previous evidence retained.

## Validation scope

PASS this leg: pending-weight-review, manual-weight-review-scope, weight-review, current-common-input-run-routing, workbench-results, result-presentation, workbench-migration; imports, advanced-shell-contract, production Vite build2096 modules and bundle guard; actual sidecar delta assertions; actual browser gravity execution with disclosed exceptions. Diff check PASS. Routing/migration fixtures emit existing relative-URL async master-seed warnings in Node; executable assertions exit0, warnings retained.

Broader non-FEA suite and legacy wrapper: NOT_RUN this leg; previously recorded failures retained. No full-vector qualification, numerical formulation, coordinate/sign/load transport, benchmark/oracle/tolerance, workflow, publication, merge/release authority changed. ResultScope STEP; ResponsibilityComplete NO; denominator3 unchanged.
