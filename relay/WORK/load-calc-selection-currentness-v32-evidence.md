# TASK_EVIDENCE — Exception review selection and input currentness

RESPONSIBILITY: owner-direct:advanced-analysis:sjson-routine-run-auto-20261001
PROTOCOL_REF: reallaksh19/Common@149770a21ca073df49717a96e2106c967adddc2d:skills/engineering-pr-delivery-v3.2
Date: 2026-10-02. RESULT_SCOPE: STEP. RESPONSIBILITY_COMPLETE: NO.
Material HEAD: 6518a502d0c86524e4ad45801f4be35817622b5c.
Evidence is exact uncommitted working-file content, not evidence contained in HEAD.
Provider sync NOT_CONFIGURED; no GitHub issue/PR/commit/merge/release written.
Live v3.2 re-grounded before this leg; same three declared outcomes, no denominator reset.

## First wrong boundaries and changes

Before fix, real Sjson selection routing emitted nine source/authority change events;
first numerical invalidation was TOPOLOGY_AUTHORITY_CHANGED. Dataset selection changes
UI revision only. SharedModelController now suppresses duplicate source publication
by immutable dataset/model identity and engineeringVersion, NOT semantic hash equality.
Replacements, explicit source patches/rebuilds, initial empty publication, clear and
controller restart remain observable and retain engineering invalidation.

Actual negative browser test then found Preview Apply 1 mm marked the seal stale
while results stayed Current. A new focused subscriber falsifier failed CURRENT !=
STALE before the fix. EngineeringModelController now carries stale seal authority to
CURRENT numerical results/receipt, preserving its reason and notifying presentation.
It never re-marks the seal from its subscriber. Repeated stale notifications do not
re-invalidate an already-stale result. Unchanged current evaluate/seal/receipt snapshots
remain non-invalidating. No formula, sign, transport, hash, tolerance, source authority,
input precedence, support invention or workflow change.

Production files changed this leg: shared-model-controller.js (source-publication
memo); engineering-model-controller.js (stale-seal notification integration).
New focused tests: load-calc-selection-currentness-check.mjs (real source/controller
routing, result/seal observation doubles); load-calc-common-input-currentness-check.mjs
(central subscriber with result/receipt observation doubles). These doubles prove
notification behavior, not engineering numerical correctness. Previous leg exception
review renderer/test and consumer-view integration remain as recorded in prior evidence.
Plan/evidence/units/snapshot and browser PNG are continuity/verification artifacts.
All unrelated dirty work and historical relay records preserved.

## Executed checks

PASS: both new focused tests after changes (both have before-change FAIL evidence).
PASS: load-calc-current-common-input-run-routing-check.mjs.
PASS: current-common-input-empirical-run-runtime-check.mjs.
PASS: support-load-static-accounting-check.mjs: 18000 N source, 15000 N resolved,
3000 N unallocated, 6000000 Nmm boundary transfer, exact zero force/moment residual.
PASS: load-calc-exception-review-check.mjs.
PASS: support-load-partial-distribution-check.mjs and load-calc-insulation-input-check.mjs.
PASS: npm run check:imports; advanced-shell-contract-check.mjs; npm run build
(20.08 s Vite build, bundle-chunk check PASS); git diff --check.
Build retained externalization/circular-chunk/size warnings.
FAIL: w10.1-shared-model-source-guard.mjs on unchanged sha256Hex 66-line style limit
at src/core/shared-piping-model/sha256.js:12; git diff for that file is empty. Not fixed
by altering governed hashing. Full project non-FEA aggregate NOT_RUN this leg.
Node checks log bundled-master relative-URL seeding warning; this is not a master-
seeding PASS. Browser master input review/restoration below was independently executed.

## Actual browser E2E via connector (tab 10, localhost:5173/AA3/)

Imported actual public/fixtures/Sjson.json, 279 entities. Restored the same five
previously Owner-approved weight-only groups: DN250/21 fields, DN200/6, DN150
S8810111/24, S8810112/6, S8811951/48. No new material/catalogue authority. 203 accepted
records, zero proposals. Normal Gravity Run (not hidden state injection) executed
EMPTY/OPE/HYD, all CURRENT and CALCULATED_WITH_EXCEPTIONS, current-system receipt.
Run clicks returned a connector timeout but were NOT blindly repeated: subsequent
actual DOM showed completed current execution. Record completed state, not timeout PASS.

Exception flange =1006649732/51458 selection changed Properties, preserved all seven
displayed hashes and the complete three case text contents without rerun. Initial
AX read immediately after click lagged; settled DOM was the final observed basis.
Support PS-12244 selection independently preserved seven hashes and case values.

Post-fix negative test: Preview insulation =1006649732/51207, initial 0 mm, explicitly
Apply 1 mm. Accepted count 204; seal stale and Results ACTION REQUIRED. Opened Results:
all three cases Historical / STALE, current Common Input system-run receipt absent.
Reset using Use source / default: exact input 0 mm, accepted count back 203. Normal
Gravity Run restored three Current cases and current receipt. Six displayed numerical
metrics per case matched pre-edit baseline. Full case text comparison across reruns
was not equal (presentation state); no claim of full-text identity across reruns.
Final support selection after restored run: exact seven hashes and full case texts
unchanged; selected PS-12244. Tab marked deliverable; no test override left applied.

Final metrics (N; transfer/first moment Nmm):

| Case | Evaluated | Allocated | Unallocated | Coverage | Boundary transfer | Unallocated first moment |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| EMPTY | 87206.858 | 86244.830 | 962.029 | 98.9% | 5374954.816 | 393350.173 |
| OPE | 88307.160 | 87345.053 | 962.107 | 98.9% | 5306054.012 | 393371.061 |
| HYD | 103629.272 | 102666.069 | 963.203 | 99.1% | 4346584.609 | 393661.932 |

Each case 81 exceptions, 0 excluded inputs. Source missing-support exceptions remain
visible, not zeroed or suppressed. Final seven hashes (moment retention, Common Input,
seal, authorization, mass projection, distribution, receipt in displayed order):
8dbca7e1a2092daa, ca1e96d5e98929a8, b442c36502d1c0df, bea9db0c7052e7ab,
bd8db6641dbd8b07, 674f94a7315df1b8, fb861083047dc737 (all fnv1a64 prefix).
Reset/reseal changes evidence identity legitimately; only selection must preserve it.

Browser proof: relay/WORK/load-calc-selection-currentness-v32-browser.png, shows
selected PS-12244 and CURRENT authorization/execution/receipt. Root shell still says
Not Run while Load Calc says CURRENT — not claimed fixed; distinct shell integration
remains a workbench presentation follow-up.

## Exact SHA256 working material

- src/workspace/shared-model-controller.js: D1D77F9160F53228E4E7EC2B3AD7744D2972EC5922F6212DA2E29ADC4C63EB41
- src/workspace/engineering-model-controller.js: 29D4AE31B1E4DF768DF0BC0E8F663F99D3FDE0F8FEE5EFC068A4877852B5BA13
- scripts/load-calc-selection-currentness-check.mjs: 5EDA29B0F7093B3E554D4BF65E54D6B95CB7407F2FFD426F082D730197AE23EC
- scripts/load-calc-common-input-currentness-check.mjs: 3F3126161EB43097C08C835E919C3D9B0D5D929F15FE34947DF09766CB1C137B
- src/workspace/load-calc-exception-review.js: A2B17DA7F73EF2C6760C3906C83495CC133A543D6677A8DDEED1EA5E44967931
- src/workspace/load-calc-consumer-view.js: C60A468CF3438155B62D7A729F65AB3B4CCEE110C50120EB5F3CB4D1468FAD69
- scripts/load-calc-exception-review-check.mjs: EE88CDFEC20D7CD76825588366D50F8911A7E79B7516843B5A4ECE5A751423B7
- browser PNG: 46B4E2796825C5E054471E3760DA0462816E12DB6182BA7336EE085A0323AD8B

## TASK_RESULT scope

EXCEPTION_REVIEW completed/evidenced (grouped exact exception review, selection,
currentness and actual runtime integration). FULL_VECTOR_LOADS and RUNNABLE_WORKBENCH
remain incomplete. P=E=1/3, not 100%. Fh/Fa/Fl and full reaction moments not established;
boundary-transfer demands are not full reaction moments. Next: grounded vector-load
source/method applicability diagnosis and workbench wiring, no invented supports or
automatic engineering authority expansion. Responsibility complete NO.
