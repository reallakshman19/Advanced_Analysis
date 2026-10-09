# TASK_EVIDENCE — automatic empirical screening binding

Responsibility: owner-direct:advanced-analysis:sjson-routine-run-auto-20261001
Protocol: reallaksh19/Common@149770a21ca073df49717a96e2106c967adddc2d:skills/engineering-pr-delivery-v3.2
Material: HEAD 6518a502d0c86524e4ad45801f4be35817622b5c plus dirty working tree.
Plan: relay/WORK/load-calc-fh-auto-binding-v32-plan.md; implementation-start recorded before code edits.
No commit, PR, merge, release, source qualification or new material/restraint approval.

## Changed-file custody for this leg

- src/workspace/load-calc-empirical-screening-binding.js: new pure read-only adapter;
  current dataset/seal/receipt/support/route custody checks, unique route-local physical
  PIPE match, exact sealed section and full line key, mapped operating-Celsius source
  cell, immutable copied evidence and row-local reasons. No closest-pipe substitution.
- src/workspace/load-calc-empirical-screening.js: automatic per-support table,
  initial unambiguous reference, source trace, input restore and local what-if labels.
  The earlier manual preview remains compatible without automatic context.
- src/workspace/load-calc-consumer-controller.js: pass current dataset, Common Input,
  receipt, support/route models and mapped line list to Results. Other dirty edits in
  this file predate this leg and are preserved.
- src/workspace/load-calc-consumer-view.js and load-calc-current-system-view.js:
  pass the new optional context to render/bind; retain rebind after markup replacement.
  Existing quantity, exception, workbench and workflow changes are preserved.
- src/workspace/master-data-events-handler.js: only three-row line-list worksheet
  row-address correction (used-range start offset; blank-row retention). No header,
  source-cell, source-byte/hash, engineering precedence or formula changes.
- scripts/load-calc-empirical-screening-binding-check.mjs: new focused adapter/UI test.
- scripts/load-calc-line-list-row-provenance-check.mjs: actual workbook and shifted-range
  address tests. No workbook edits.
- relay plan/evidence/continuity and browser image: local delivery evidence only.

The existing supportLoadEngine formulas, coefficients, temperature table, rounding,
gravity solver, vectors/sign conventions and result hashes are not changed in this leg.
The v3.2 skill kept this a scoped STEP result, not an unsupported responsibility PASS.

## Source diagnosis

Supplied workbook SHA256:
723518a16b1a744c9328539f1a25fe15ea246757930970603a89d3cea46e3f41.

LineList exact Excel rows: S8810101=313, S8810103=318, S8811951=319,
S8810111=325, S8810112=326. All five operating temperatures are 309 C; design
maximum is 325 C. Current UI maps t2 to AT WORKING CONDITIONS | Temp. ºC and
t1 to DESIGN CONDITIONS | Temp Max ºC. Adapter identifies header semantics,
not a hard-coded t2 ordinal; rejects ambiguous/non-Celsius/design-only mappings.
Full service-prefixed line identity is retained (S is not W).

Browser exposed an existing address defect: used range begins at row 4, but the
reader numbered from its returned array. It reported S8811951 as row 316. Fixed
offset metadata, tested against actual worksheet cells, and re-imported the unchanged
workbook through the UI. Old persisted row metadata is not silently migrated; a fresh
import is required to correct it. Source values and workbook hash are unchanged.

Operating temperature trace is CURRENT_MAPPED_LINE_LIST_NOT_GRAVITY_SEAL,
not a new sealed thermal/material authority. The existing carbon-steel temperature
ratio table remains an unqualified screening reuse, with that limitation visible.

## Executable validation

PASS:

- node scripts/load-calc-empirical-screening-binding-check.mjs — actual formula engine;
  exact current receipt and source hash, branch/physical edge, duplicate pipe/edge/site/
  route/line rejection, ambiguous endpoint/no nearby substitute, operating vs design
  header and remapping, source-cell agreement, explicit source conflicts, invalid
  sections, zero/negative/clamped temperatures, edit/restore/reference change, and
  immutability including no freezing of caller evidence/tags. Only DOM controls doubled.
- node scripts/load-calc-line-list-row-provenance-check.mjs — actual hashed workbook,
  all five exact worksheet rows/cells, shifted range, blank rows, zero/negative values,
  source worksheet immutability.
- node scripts/load-calc-empirical-screening-check.mjs — existing arithmetic/legacy parity.
  Initial draft FAIL (new optional button queried by old fake DOM) fixed; final PASS.
- node scripts/load-calc-quantity-scope-check.mjs
- node scripts/load-calc-selection-currentness-check.mjs
- node scripts/load-calc-common-input-currentness-check.mjs
- node scripts/load-calc-current-common-input-run-routing-check.mjs
- node scripts/authorized-empirical-source-axis-binding-check.mjs
- node scripts/authorized-empirical-gravity-convention-binding-check.mjs
- node scripts/support-load-static-accounting-check.mjs
- node scripts/support-load-partial-distribution-check.mjs
- node scripts/lfea-preflight-phase1-master-authority-check.mjs
- npm run check:imports
- node scripts/advanced-shell-contract-check.mjs
- npm run build — final source, 18.63 s Vite build; bundle-chunks PASS.
- git diff --check

FAIL: node scripts/master-data-containment-check.mjs — unchanged script's line 61
Unicode-mode regular expression has an unescaped closing brace; syntax error before
checks execute. Do not count it as executable PASS or modify it to mask this result.
Previously recorded calc-workspace runner/profile FAIL and shared-model source-guard
FAIL remain uncleared (not re-run in this leg).
NOT_RUN: full non-FEA aggregate, full-vector numerical qualification, complete runnable
new-workbench integration. Node relative-URL master seeding warnings remain; browser
masters were exercised separately. Existing bundle circular/externalization/size
warnings remain. No claim of clean project-wide validation.

## Real browser — final source and actual Sjson

Tab 12, http://localhost:5173/AA3/. Development reload cleared the in-memory source;
restored actual public/fixtures/Sjson.json (279 entities), re-imported the exact supplied
workbook, and reapplied only five previously Owner-approved weight-input groups:
21+6+24+6+48 fields. Existing 98 accepted records preserved; total 203, zero proposals.
No new material grade, thermal qualification or restraint assignment.

Normal Run: CURRENT CALCULATED_WITH_EXCEPTIONS, EMPTY/OPE/HYD, 37 rows per case.
Click transport timeout occurred, but next DOM verified completed run; no duplicate Run.
EMPTY evaluated 87206.858 N, allocated 86244.830 N, unallocated 962.029 N,
98.9% coverage, 81 exceptions and zero excluded inputs retained.

Automatic screening: **34/37 OPE references estimated; 3 unresolved**.
The browser trace now shows all correct Excel rows 319,326,325,318,313 and T309 C.

PS-12247, support-site:427515.392|-1141125|1184.15:

- Exact pipe: PIPE AUTO /ASIM-1885-6"-S8811951-91261M7-HC-01/B2 6
- OPE reference 7032.911 N (display precision)
- Automatically filled OD168.3 mm, wall14.2748 mm, operating309 C
- Fh guide estimate 2109.873 N; raw327.571 N, rounded350 N, minimum2109.873 N
- Line-stop estimate 7850 N
- Source trace LineList row319, operating header, workbook SHA256 and sealed section evidence

Unresolved rows: PS-12244 meets B2 pipes2/3; PS-12246 meets B2 pipes4/5;
=1006649732/51254 has no exact route-local straight pipe. No pipe guessed, no zero
substitute, no gravity blocker. These are hypothetical unsigned guide/stop screening
demands for reference rows, not source-classified restraint reactions (including zero
OPE rows). Line-stop estimate can remain nonzero at zero OPE under the unchanged formula.

Browser controls verified: edit T100 -> LOCAL WHAT-IF; clear T -> both estimates not
evaluated; Restore -> automatic T309 and original estimates; select ambiguous PS-12244
-> all inputs clear and match reason visible; reselect PS-12247 -> exact values restored.
All seven ordered evidence hashes AND three complete gravity-case table texts stayed
byte-equal across these local interactions. Results remained Current.

Final actual-run fnv1a64 hashes (not claimed equal to pre-fix run):

1. Moment retention c2a9ba2148c248fd
2. Common Input a08e892d79190df3
3. Seal 530374cc200e3886
4. Authorization 3a566ed4f6fea29c
5. Mass projection 8d1f856b82141873
6. Distribution 64dd7ea68b5307f2
7. Receipt a7adac4e510d96b7

Screenshot: relay/WORK/load-calc-fh-auto-binding-v32-browser.png, actual final output.
Tab retained open at that preview. Header still says Not Run despite current Results;
this existing presentation inconsistency is not fixed here. New workbench remains
read-only; automatic screening currently lives in guided Results, not its prototype.

## Exact working-file SHA256 basis

- binding adapter: 75E941BED2D06694706766F6739E5515298F0173102F824B70F50655CA95801A
- preview: ADDA8287B4C0460C9FCA61F82B40A794B6CC74BE6A6E9CDEC76BC9074FC3A5EF
- master reader: 3B2557C618EABD053819B59173A35D16D09BB5ECC7D3FDFF4CC35CD3A399F52D
- binding test: 2F5B307FD5AAB25F98BC1D17DD2E148313440FA71B6F41E20D5F9763C288D8B7
- row-address test: FC72F117DB0E006BE8E6CCF52967A78577327E396B6F6D1281231830CF2494E1

## TASK_RESULT

RESULT_SCOPE: STEP
COVERAGE: automatic exact screening inputs and estimates browser-verified on 34/37
references; source addresses corrected; gravity unchanged by local preview edits.
RESPONSIBILITY_COMPLETE: NO. Fv rest-axis projection, signed Fa/Fl and solved reaction
moments are not produced by this screening step. Full vectors and runnable workbench incomplete.
P/E: 1/3 =33%, unchanged outcome denominator; no credit for partial screening implementation.
NEXT: trace existing configured scenario / source restraint basis and result contracts
for Fv/Fa/Fl/moments before wiring those results to the new workbench. Keep hypothetical
screening separate; do not invent assignments, stiffness, friction or directions.
Provider NOT_CONFIGURED, recovery NONE, Owner decision NONE.
