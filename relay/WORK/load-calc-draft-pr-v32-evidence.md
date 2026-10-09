# TASK_EVIDENCE — load-calc workbench draft delivery

Responsibility: owner-direct:advanced-analysis:sjson-routine-run-auto-20261001
Protocol: reallaksh19/Common@149770a21ca073df49717a96e2106c967adddc2d:skills/engineering-pr-delivery-v3.2
Classification: ENGINEERING_CRITICAL. ResultScope: STEP. ResponsibilityComplete: NO.
Progress/Evidence: 1/3 outcome units, 33/33%; no credit for draft publication.

## Scope and delivery

Owner requested continued work and a draft PR. Selected implementation commit 07149e054e8dda925196f3df8a58d723333ec28d was isolated from the dirty checkout and cherry-picked as 418b28752681a30cb078e9ddf8fcf22c1c46c247 onto clean origin/main 11eca8e40e560fc2e5f0866489f0b419e1b5afb1 on codex/load-calc-workbench-review. The seven pre-existing historical relay-documentation commits and unrelated 3D/viewport/event-topic changes are excluded. Original checkout/ancestry and unrelated edits are preserved.

The accumulated implementation includes manual-weight family scope, source/effective/proposed weight and section preview, source-bore fitting estimates, missing-only insulation thickness 0 mm input, approximate master match confirmation, selection/currentness invalidation, exception/quantity disclosure, unsigned empirical Fh/line-stop estimates, the four-stage prepared workbench and reuse of current gravity receipt/results. No new solver, signed vector inference, workflow, merge or release action in this delivery leg.

This leg additionally repairs one obsolete Product-default runtime source-wiring test: it now requires the actual insulation wrapper to delegate to the same governed provider, with an executable full-receipt comparison. Existing precedence, immutability, single-resolver and support-authority assertions remain. No production change or tolerance relaxation was made for that failure.

File-by-file rationale: [scope manifest](load-calc-draft-pr-v32-file-scope.md). Plan: [delivery plan](load-calc-draft-pr-v32-plan.md). These new delivery documents explain scope/validation; the generated continuity snapshot retains the same responsibility and unfinished units.

## Prior actual-browser evidence — partial result, not new clean-commit E2E

[Recorded workbench browser evidence](load-calc-workbench-results-v32-evidence.md) and its two committed PNGs retain exact source/workbook custody and receipts. On the prior actual Sjson session: CURRENT/CALCULATED_WITH_EXCEPTIONS, 37 support rows per EMPTY/OPE/HYD case, 81 exceptions per case; 34/37 OPE screening references estimated. EMPTY allocated/unallocated 86244.830/962.029 N; OPE 87345.053/962.107 N; HYD 102666.069/963.203 N. Local screening edits preserved all seven receipt identities and three complete gravity tables.

These magnitudes are not a solved Fv/Fh/Fa/Fl/moment set. Actual beam/contact scenario is NOT_CONFIGURED. Full-vector Sjson solution, direct Run inside the new workbench and exported download verification remain incomplete/NOT_RUN. Synthetic result rendering tests are not numerical qualification. Fresh clean-commit browser E2E is NOT_RUN in this packaging leg.

## Executable validation

PASS: all 37 checks below, executed in isolated checkout at 07149e054 and repeated at clean-base code commit 418b28752 (the added wrapper guard and prototype check ran separately in the first checkout).
- scripts/authorized-empirical-ancillary-distributed-mass-check.mjs
- scripts/authorized-empirical-effective-support-guard-check.mjs
- scripts/authorized-empirical-ledger-readiness-check.mjs
- scripts/current-common-input-empirical-mass-projection-check.mjs
- scripts/current-common-input-empirical-support-load-execution-check.mjs
- scripts/current-common-input-handcalc-mass-support-parity-check.mjs
- scripts/load-calc-approximate-match-preview-check.mjs
- scripts/load-calc-common-input-currentness-check.mjs
- scripts/load-calc-empirical-screening-binding-check.mjs
- scripts/load-calc-empirical-screening-check.mjs
- scripts/load-calc-exception-review-check.mjs
- scripts/load-calc-fitting-section-selection-check.mjs
- scripts/load-calc-insulation-input-check.mjs
- scripts/load-calc-line-list-row-provenance-check.mjs
- scripts/load-calc-manual-weight-review-scope-check.mjs
- scripts/load-calc-preview-check.mjs
- scripts/load-calc-quantity-scope-check.mjs
- scripts/load-calc-run-ready-snapshot-check.mjs
- scripts/load-calc-selection-currentness-check.mjs
- scripts/load-calc-source-bore-selection-check.mjs
- scripts/load-calc-weight-review-check.mjs
- scripts/load-calc-workbench-check.mjs
- scripts/load-calc-workbench-results-check.mjs
- scripts/loadcalc-binding-currentness-structural-check.mjs
- scripts/non-fea-3d-investigation-check.mjs
- scripts/non-fea-calculation-effective-values-inspection-check.mjs
- scripts/non-fea-common-enriched-configured-default-overlay-check.mjs
- scripts/non-fea-gravity-product-default-bootstrap-check.mjs
- scripts/load-calc-current-common-input-run-routing-check.mjs
- scripts/empirical-load-calc-scenario-check.mjs
- scripts/empirical-result-overlay-check.mjs
- scripts/authorized-empirical-source-axis-binding-check.mjs
- scripts/authorized-empirical-gravity-convention-binding-check.mjs
- scripts/w10.4-model-load-contract-check.mjs
- scripts/w10.4-model-load-property-check.mjs
- scripts/non-fea-product-engineering-default-runtime-resolution-check.mjs
- prototypes/load-calc-workbench/check.mjs

PASS: npm run check:imports; node scripts/advanced-shell-contract-check.mjs; npm run build (17.95 s, bundle check PASS, 83 chunks) in the isolated 07149e054 checkout. The diff between 07149e054 and 418b28752 is empty for src, scripts, prototypes, public, benchmarks, package.json/package-lock.json and vite configuration; the same executable tree/dependencies were used. Build retains externalization/circular/large-chunk warnings. Node-relative master URL warnings are not successful browser master-loading evidence.

FAIL: node scripts/run-non-fea-checks.mjs. After fixing the obsolete source-wiring guard, 66 preceding checks completed and check 67 (empirical-restraint-network-check.mjs) failed ENOENT on benchmarks/LFEA/BM2/Input_BM2.xml. That fixture is also absent from origin/main. Later checks in the fail-fast suite are NOT_RUN, not PASS. Reproduced in isolated checkout.

FAIL, retained from prior evidence: master-data-containment-check.mjs cannot parse its Unicode regex at line 61; calc-workspace-check.mjs omits the required visible profile at line 86; w10.1-shared-model-source-guard.mjs rejects the unchanged 66-line sha256Hex. This leg does not claim these are cleared.

The initial staged diff check reported a blank EOF in the new scope manifest; corrected in the documentation follow-up. Final full PR diff check PASS before publication. No all-suite engineering PASS claim.

## Engineering review required before merge

The accumulated draft is not presentation-only. master-data-ui.js includes automatic catalogue-weight candidate acceptance and source-reference rebinding. ProjectDataStore.syncAuthorityHashes rewrites dataset-backed evidence while retaining field values; project-data-contract.js also changes optional-source validation. Engineering review must establish that catalogue weights remain properly reviewed and replacement sources cannot inherit old approvals by hash rewriting. This delivery does not qualify or authorize those behaviors. A partial gravity result and focused test passes are insufficient production authority.

No workflow or agents/chains changes are included in the draft diff. Uncommitted historical artifacts are preserved in the original checkout.

## TASK_RESULT

ResultScope: STEP
ResponsibilityComplete: NO
Coverage: accumulated scoped implementation and isolated validation prepared for draft review; broad-suite failures, source/weight authority review and actual full-vector/direct-Run gaps remain open.
Next: review automatic source-binding/catalogue acceptance boundaries; expose exact source/qualified restraint-basis preview and configure existing scenario without inferred restraints/stiffness/friction/signs. Do not merge or claim full loads until actual executable evidence supports it.

## Draft publication receipt

Created and attached [draft PR #1915](https://github.com/reallaksh19/Advanced_Analysis/pull/1915). Remote readback: OPEN, isDraft=true, base main at 11eca8e40e560fc2e5f0866489f0b419e1b5afb1, head codex/load-calc-workbench-review at 3f5a0766032f1a20ad973b2b7199c3c4c4bb16e8, 111 changed files and two commits. This receipt is a subsequent documentation-only commit; executable code remains 418b28752681a30cb078e9ddf8fcf22c1c46c247.

CI readback at creation: four checks IN_PROGRESS, two SKIPPED. No CI PASS claim; no waiting/monitoring obligation was requested. No merge or release. The active validation/PR checkout is C:/Users/reall/.codex/worktrees/load-calc-draft-validation/AA; original C:/CodeA/AA checkout retains unrelated edits and local historical ancestry. Continue this PR in its active checkout.
