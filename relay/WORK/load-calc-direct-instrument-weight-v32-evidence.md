# STEP evidence — direct UZV catalogue lookup

Recorded 2026-10-02. Same responsibility `owner-direct:advanced-analysis:sjson-routine-run-auto-20261001`, ENGINEERING_CRITICAL, draft PR #1915. Common v3.2 basis `149770a21ca073df49717a96e2106c967adddc2d`; published [plan](load-calc-direct-instrument-weight-v32-plan.md), official implementation-start projection. All edits in the isolated draft worktree; original `C:/CodeA/AA`, workflows, masters, solver/qualification/oracle/release authorities untouched.

## Outcome

One retained obligation genuinely resolved through existing manual review: `=1006649732/51250`, `88-UZV-11951 900# RF`, DN150, catalogue family `Instrument-ESDV/UZV`, **548 kg**. Mass coverage now **120/127**, 196 accepted records, zero proposals. The actual browser Run remains **BLOCKED** by seven manual mass obligations; configured methods **NOT_CONFIGURED**, no runtime profile bound. Fv/Fh/Fa/Fl/moments, equilibrium and sealed result export are **NOT_RUN / BLOCKED**, not completed/zero.

The previous leg's claim that all eight lacked usable catalogue rows was incomplete. This read-only workbook comparison found the existing direct UZV family row. That correction does not assert vendor-specific mass identity or authorize unrelated instrument substitutions.

## First wrong boundary and bounded repair

Both `public/fixtures/wtValveweights.xlsx` and `C:/CodeA/3DC_809/docs/Masters/wtValveweights.xlsx` are byte-identical: SHA256 `49b9e1c655c7124fbe471e988894ae200a978f640dc3119e36eba582fcfb7c78`. Bundled Spreadsheet artifact runtime read sheet `wtValveweights`, A1:L1596, 1,595 data rows. Row1484 G:K contains 548/548 kg, rating900, NPS6, `Instrument-ESDV/UZV`; DN and F/F cells blank. No workbook writes. Bundled raw JSON row index1482 contains the same values; SHA256 `72e266002256e2ac0b0c0c9c722dde2bb65e93deec2075d209c7ab78d219cda2` matches the current approved-master descriptor.

Two presentation/candidate boundaries hid that row:

1. The standalone length ranker excludes blank F/F rows. Its factor-based UZV proposal hides the direct instrument-family row because bore/rating fallback runs only when there are no ranked candidates.
2. Browser auto-mapping selects both DN and NPS. Existing normalization derives DN only if the DN column is entirely unmapped; this specific blank DN cell therefore remains blank. Initial NPS-only fixture PASS did not exercise actual mapping. Actual-browser falsifier exposed this before acceptance.

The candidate builder now independently exposes exact-rating/direct ESDV/UZV family rows. Only a blank DN uses the existing NPS-to-DN table; supplied DN (including invalid/zero) is preserved and mismatches cannot qualify. The existing conversion helper is exported, not reimplemented. No global normalizer behavior changed. Candidate/evidence record retains master hash, original row index, NPS derivation, explicit reviewer selection and `vendorIdentityAsserted:false`. Factor/interpolation alternatives remain suggestions, not applied evidence.

Read-only standalone enriched Sjson comparison found zero component-weight placeholders for all eight retained items. Its audit's five `resolved` labels refer to enrichment fields, not positive mass. Its manifest's limited target approvals do not create mass authority for other entities.

## Actual browser verification

Isolated localhost:5174/AA3/, retained connector tab14; original localhost:5173 untouched.

1. Development refresh clears in-memory source/review. Imported actual Sjson through the existing file input. Explicitly restored the prior browser-exported [revision12 profile](load-calc-run-readiness-v32-project-data.json) and [195-record sidecar](load-calc-run-readiness-v32-accepted-inputs.json). No hidden-state mutation/automatic approval.
2. Popup now shows `Instrument-ESDV/UZV · 548kg` first for 51250. Blank every other popup input before applying, including already accepted items, to avoid altering earlier evidence or accepting seven unrelated suggestions. Only this one input remained populated.
3. Existing Apply staged exactly one proposal; existing Accept exact proposals only accepted it. Checker coverage increased119→120, accepted195→196, pending0.
4. Clicked actual Run gravity calculation. It returned `A product screening snapshot requires a fully READY Common Input checker report.` Project Data/Masters READY, 6/8 governed gates; one actionable shared `MASS_COVERAGE_INCOMPLETE` cause, represented by three blocking area receipts.
5. Configured scenario view shows no runtime profile bound. V2/V3 scalar gravity and registered restricted beam/network methods are not authority for an arbitrary full-vector Sjson scenario. Clone/Authorize/Configured Calculate disabled. No profile or restraint/stiffness/sign/qualification invented.
6. Current checker expanded the seven remaining entities, all `COMPONENT_WEIGHT`: 51274 flow meter; 51284 angle control; 51462 lap joint; 51463 temperature instrument; 51476/51483 DN20 blind flanges; 51485 pressure gauge. No pipes, pipe-standard fittings or insulation remain in this mass-obligation list. No zero placeholder/unrelated wafer/weldneck body accepted.

Proof: [direct catalogue popup](load-calc-direct-instrument-weight-v32-popup.png), [actual remaining checker obligations](load-calc-direct-instrument-weight-v32-checker.png).

## Input download custody — not results

Clicked existing Export accepted overrides. Actual file `C:/Users/reall/Downloads/non-fea-enrichment-sidecar (5).json`, 651768 bytes, 2026-10-02 22:22:34 Dubai. Read-only comparison verified all195 prior records deep-equal, precisely one new record, source unchanged `fnv1a64:46ec305d089d59eb`; current sidecar `fnv1a64:5c1b947a121a5816`.

[Compact exact delta receipt](load-calc-direct-instrument-weight-v32-input-receipt.json) preserves the new record without duplicating the whole prior artifact. Focused test reconstructs the196-record sidecar through its existing constructor and reproduces the downloaded hash; checks every prior record unchanged. Receipt is input-custody evidence, not a runtime result/package or bootstrap import.

## Validation

PASS, executed:

- `load-calc-direct-instrument-weight-check.mjs`: actual full master/Sjson/both mapped DN+NPS; row548/provenance, seven other identities isolated; wrong/supplied invalid DN, wrong rating/family/NPS, invalid/zero mass, duplicate ambiguous catalogue rows; immutability and actual input delta/hash replay.
- `load-calc-manual-weight-review-scope-check.mjs`
- `load-calc-weight-review-check.mjs`
- `load-calc-workbench-migration-check.mjs`
- `load-calc-current-common-input-run-routing-check.mjs`
- `non-fea-enrichment-migration-check.mjs`
- `non-fea-project-data-authority-check.mjs`
- `load-calc-run-readiness-artifacts-check.mjs` (prior195-record artifact intentionally unchanged, historical eight absent still correct for that artifact)
- `load-calc-empirical-screening-check.mjs`
- `advanced-shell-contract-check.mjs`
- `npm run check:imports`
- `git diff --check`

Node-only migration/routing tests retain relative-URL asynchronous master-seed warnings, assertions exit0. Initial fixture mapping failure was corrected; later NPS-only fixture proved incomplete in browser and replaced with actual both-column mapping before final PASS.

**FAIL `npm run build`**: three attempts exited1 during Vite transformation. Node24 repeat logged `NewSpace::EnsureCurrentCapacity Allocation failed - JavaScript heap out of memory`; Node22 retry with bounded semi-space/old-space also exited1. OS read-only snapshot showed ~1.1GB free RAM of16GB. Shell contract substep passes; bundle construction/check did not complete. No user/unrelated process stopped, environment/source limits not disguised as build PASS. Earlier build PASS is historical only.

NOT_RUN: broader non-FEA suite and unchanged earlier legacy guards. Prior missingBM2/five-step-wrapper/other draft failures remain in [historical migration evidence](load-calc-ui-migration-v32-evidence.md), not promoted to PASS. Actual runtime successful calculation/equilibrium/result export remain BLOCKED/NOT_RUN.

## Every changed file in this leg

| File | Purpose |
| --- | --- |
| `src/workspace/load-calc-fitting-weight-review.js` | Bounded direct family catalogue lookup, existing-table blank-DN derivation, original row/hash evidence; reviewer acceptance retained |
| `src/workspace/master-data-normalizers.js` | Export existing NPS-to-DN helper only; global mapping/normalization unchanged |
| `scripts/load-calc-direct-instrument-weight-check.mjs` | Actual-mapping catalogue regression, negatives/immutability and exact browser input delta custody |
| `relay/WORK/load-calc-direct-instrument-weight-v32-plan.md` | Bounded implementation plan and browser-driven mapping falsifier |
| `relay/WORK/load-calc-direct-instrument-weight-v32-input-receipt.json` | Exact one-record browser export delta + source/base/new hashes; no result claim |
| `relay/WORK/load-calc-direct-instrument-weight-v32-popup.png` | Visible actual direct548 proposal |
| `relay/WORK/load-calc-direct-instrument-weight-v32-checker.png` | Actual Run blocker/current seven entity obligations |
| `relay/WORK/load-calc-direct-instrument-weight-v32-evidence.md` | This source/test/browser evidence and limits |
| `relay/WORK/load-calc-ui-migration-v32-pr-body.md` | Same draft PR updated, historical failures/outcomes preserved |
| `relay/GENERATED/tasks/load-calc-sjson.continuity.json` | Official STEP result/current frontier, no broader completion |

ResultScope STEP; ResponsibilityComplete NO; existing progress/evidence1/3 (33%/33%) unchanged. Next legitimate work: matching evidence for the seven remaining manual items and an applicable configured scenario basis; do not infer approximation/omission/new methodology authority. Successful production build also remains unverified until the memory-constrained build can finish. No repeated qualification questions, no merge/release.
