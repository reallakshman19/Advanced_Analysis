# TASK_EVIDENCE — new Load Calc integration, STEP only

Owner requested the four next priorities. Common v3.2 live basis `149770a21ca073df49717a96e2106c967adddc2d`; same responsibility `owner-direct:advanced-analysis:sjson-routine-run-auto-20261001`, draft PR1915 and isolated worktree. Original `C:/CodeA/AA` and localhost5173 untouched. No merge, release, workflow change, mechanics change or invented profile/support authority.

## Delivered and verified

1. New workbench Calculate/Results/Methods now expose **Set up calculation scenario**, restraints, load cases and existing method/authorization controls. Setup accepts exactly scenario/runtimeProfile/caseConfigurations and rebuilds the existing adapter against current workspace-owned model/topology/attachments/restraints/load primitives. Imported authority objects are rejected. Source bindings/profile hashes, case authority and qualification remain governed by the existing owners. Positive setup tested against the existing synthetic scenario fixture; actual browser rejected `{}` and retained NOT_CONFIGURED/current gravity. No real-source full-vector execution is claimed.
2. New Results summary exposes all nine unallocated case/route groups and exact component-selection links plus existing topology review. Actual Sjson source diagnosis independently rerun: 10-inch B2 and B5 have no support members; B3 has only `=1006649732/51465` with blank source type. Existing route-local capability/projection boundary therefore supplies no qualified vertical bearer. No assumed cross-branch transfer or conversion to REST. Zero-demand B5 entries remain visible and in custody.
3. Global **Benchmark: Not Run** is explicitly benchmark qualification, unchanged—not load-run status. Workbench/header now show actual current gravity execution separately, input readiness separately from preview caveats, and stale/unavailable evidence as rerun-required. No benchmark PASS synthesized.
4. **Download calculated gravity JSON** now reads and validates the current source, seal, request and exact execution/distribution receipt at click time. Export includes the unchanged scalar-gravity receipt and the exact sealed sidecar (584 total records: all203 accepted records unchanged plus381 governed derived/default records). Seven manual zero assumptions preserved. Fa/Fl/global-moment values are null/unavailable in this family; Fh screening is not exported as a solved reaction. No publication authority asserted. Actual file downloaded through the browser, copied unchanged from Downloads and revalidated; file SHA256 `d691b10cb9596272b9ba553f72cf55d42b85134e4c13ff08401d2a6b3f06941b` (2303898 bytes).

## Actual fresh browser workflow

Connector tab15 at `http://localhost:5174/AA3/`: import actual `public/fixtures/Sjson.json`, restore prior approved Project Data revision12 and actual203-record sidecar through existing file choosers; check8/8; Run gravity; Results; export; review unallocated paths; inspect/reject incomplete scenario setup; Methods remains disabled without a bound profile; return to current Results. Native download exists despite connector download-event timeout. Run click timeout also resolved by inspecting the completed UI, not by repeating execution. Screenshots saved from this session.

| Case | Allocated N | Unallocated N | Support rows | Exceptions | Excluded inputs |
| --- | ---: | ---: | ---: | ---: | ---: |
| EMPTY | 79790.710 | 704.604 | 37 | 81 | 0 |
| OPE | 80890.933 | 704.683 | 37 | 81 | 0 |
| HYD | 96211.950 | 705.778 | 37 | 81 | 0 |

All cases CALCULATED_WITH_EXCEPTIONS; existing CHAINAGE_TRIBUTARY_SPAN_V2. These are preserved runtime outputs, not a new independently qualified mechanics oracle. Overhang/chainage transfer moments are not solved global moments.

Source SHA256 `1e75a288545b771d2292cf730ca19d943e40fa547244478038da65eb8e4fc39a`; source model `fnv1a64:46ec305d089d59eb`; Common Input `fnv1a64:3cfda3c1bf69109c`; seal `fnv1a64:05eecb2a2a9200f8`; Run authorization `fnv1a64:b1cccbb36601cbe4`; mass projection `fnv1a64:e39dbeddc7e5798f`; distribution `fnv1a64:4c023c087c1dd0a1`; execution receipt `fnv1a64:127fd2148cf55c31`; sealed sidecar `fnv1a64:a2eae1e641fe1b3b`. Fresh run identities differ from historical receipts; force outputs unchanged.

## Validation ledger

PASS, executed current leg on Node24.19:

- `node scripts/load-calc-workbench-integration-check.mjs`: actual captured export equality, all203 accepted records unchanged/seven reviewed zeros,111 support rows, route unallocated closure, negative source/receipt/hash/value/staleness/seal/request/sidecar tests, unavailable vectors, no publication and truthful labels.
- `node scripts/empirical-load-calc-scenario-check.mjs`: existing synthetic method-owner tests plus positive UI setup adaptation, current-source binding rejection, imported-authority rejection, immutability and HTML escaping. Synthetic executor is NOT actual Sjson Fa/Fl/global-moment proof.
- `node scripts/load-calc-workbench-migration-check.mjs`
- `node scripts/load-calc-workbench-results-check.mjs`
- `node scripts/load-calc-exception-review-check.mjs` (includes actual source support diagnosis)
- `node scripts/load-calc-workbench-check.mjs`
- `node scripts/load-calc-current-common-input-run-routing-check.mjs`
- `node scripts/load-calc-result-presentation-check.mjs`
- `node scripts/import-check.mjs`
- `node scripts/advanced-shell-contract-check.mjs`
- `npm run build`:2098 modules,20.14s, bundle guard PASS; process-local Node heap settings only. Existing circular/large-chunk/browser-externalization warnings retained.
- `git diff --check`

Initial new-test FAILs were corrected before the final rerun: exception-message regex order; mistaken assumption that the sealed sidecar contained only203 accepted records (actual584 includes governed derived/default records). No engineering value/authority changed to make them pass. Node synthetic checks retain existing async relative-fetch warnings. Broad non-FEA suite/legacy wrapper NOT_RUN this leg; their previously recorded failures are not erased or relabeled PASS.

## Changed-file manifest

- `src/workspace/load-calc-workbench/scenario-setup.js`: read-only source evidence and reviewed input adapter, no alternate runner.
- `src/workspace/load-calc-workbench/result-evidence.js`: current-receipt status/export guards and unallocated-ledger grouping, no recomputed loads.
- `src/workspace/load-calc-workbench/current-results.js`: reusable fresh owner snapshot reader.
- `src/workspace/load-calc-workbench/results-view.js`: export control, unallocated review and scenario entry.
- `src/workspace/load-calc-workbench/workbench-view.js`: truthful rail/badges and scenario/loads/restraints entry points.
- `src/workspace/load-calc-consumer-controller.js`: delegates configure/export to existing owners; current authority reads; presentation status.
- `src/workspace/load-calc-consumer-view.js`: separate actual gravity status from transient message.
- `src/workspace/engineering-loads/empirical-load-calc-scenario-view.js`: existing Methods setup entry only.
- `src/workspace/workspace-layout.js`: benchmark label only, qualification unchanged.
- `scripts/empirical-load-calc-scenario-check.mjs`: synthetic setup wiring/negative checks.
- `scripts/load-calc-workbench-integration-check.mjs`: actual-export custody and status/negative regressions.
- `relay/WORK/load-calc-new-ui-completion-v32-plan.md`: recorder-first four-item implementation plan and limits.
- `relay/WORK/load-calc-new-ui-v32-evidence.md`: this current evidence/manifest.
- `relay/WORK/load-calc-new-ui-v32-gravity-export.json`: exact actual browser export, regression input, no release authority.
- `relay/WORK/load-calc-new-ui-v32-results.png` and `relay/WORK/load-calc-new-ui-v32-scenario.png`: actual browser proof.
- `relay/WORK/load-calc-ui-migration-v32-pr-body.md`: latest bounded result with historical failures preserved.
- `relay/GENERATED/tasks/load-calc-sjson.continuity.json`: official v3.2 derived continuity update, no authority grant.

## Open boundary / next

Full-vector scenario still NOT_CONFIGURED: no actual source-bound qualified locked runtime profile/case/restraint basis supplied. Weight-only OD/wall/density inputs do not authorize stiffness, elastic modulus, thermal expansion, axes or method qualification. Filling those by assumption would cross the protected engineering boundary. Full Fa/Fl/global-moment execution NOT_RUN, not zero and not completed; unsigned Fh screening remains separate.

ResultScope STEP; ResponsibilityComplete NO. No blanket complete-migration claim. Denominator3 and P/E1/3 unchanged pending the full declared outcomes. Keep current Results tab and preserve approved inputs. Next authorized leg is a legitimate reviewed method-compatible scenario package/configuration and any source-backed support correction—not invented qualified profiles or bearings. No repeated qualification questions or automatic merge/release.
