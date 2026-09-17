# EMP.1 (WRC) — Live Product Audit and Dedicated UI Revamp Plan

Audit basis (executed, not inferred):

```text
repository   = reallaksh19/Advanced_Analysis
branch       = claude/compassionate-lovelace-t1jin1
base main    = c58e45b
date         = 2026-09-16
app          = lafea.html -> src/lafea-app/main.js (LAFEA standalone shell)
route         = EMP.1 tab inside the LAFEA workbench
method        = npm install; npm run dev; Chromium via Playwright, real DOM
viewports     = 1600x1000, 1280x800, 900x800
demo          = "Run complete example" (emp1-workbench-qualification-sample)
```

This document is a presentation/product audit. It creates no engineering,
source, method, benchmark, code-compliance or release authority, and proposes
no change to WRC formulae, curve data, oracles, tolerances or route scope.

---

## 1. Executive finding

The EMP.1 tab **does run**. A cold start plus one click on *Run complete example*
reaches `Local check: CALCULATED · CURRENT` with no console errors, and the full
WRC 537 Table-5 eight-point result is computed and rendered.

The product nevertheless reads as unrunnable to a practising engineer, for three
independent reasons:

1. **A γ trap.** Only γ = 5 exactly is authorised for engineering use. The demo is
   built at Rm = 100 / T = 20 → γ = 5. Real vessels are γ ≈ 30–100 and are refused.
2. **A dead end on real geometry.** Changing pipe geometry correctly stales the
   result, then fails with a pressure-radii error whose only offered recovery is
   *Undo* — and the field it blames is not editable anywhere in the UI.
3. **A buried answer.** The eight-point stress table renders at ~2,342 px on a
   1,200 px viewport, behind a collapsed *Results & evidence* toggle, on the third
   of five tabs, under a label that does not read as "the result".

None of these is a calculation defect. All three are product/presentation defects,
and together they fully explain "CAUx benchmark seems achieved, but I am unable to run".

---

## 2. Verified engineering status — what is actually pending

### 2.1 The γ paradox, stated precisely

| Route | Registered | Numerically demonstrated | Engineering use authorised |
|---|---|---|---|
| `…ORIGINAL.GAMMA5.ZERO_DP` | yes | yes | **yes** |
| `…ORIGINAL.INTERPOLATED_GAMMA.ZERO_DP` | yes | yes — CAUx 8/8 within 2.04 % | **no** |

Executed locally on this head:

```text
scripts/emp1-wrc537-caux-interpolated-comparison-check.mjs   PASS
  worst 2.0 % at Cu; governing Du in both CAUx and EMP.1
scripts/emp1-caux-pp24-31-benchmark-check.mjs                PASS
  status                    = PASS_CAUX_REFERENCE_FREEZE_OUTSIDE_GAMMA5_PROFILE
                              _DIRECT_PDF_REOBSERVATION_PENDING
  releaseProfileDisposition = OUTSIDE_BOUNDED_GAMMA5_ZERO_DP_RELEASE_PROFILE_REFERENCE_ONLY
  productionAuthority       = false
  directPdfPageReobservation= NOT_RUN_EXECUTION_ENVIRONMENT
scripts/emp1-benchmark-comparison-custody-check.mjs          PASS
scripts/emp1-pvelite-benchmark-programme-check.mjs           PASS
npm run check:emp1-ui                                        PASS (4/4)
npm run check:emp1-gamma-interpolation                       PASS (5/5)
```

So the CAUx benchmark **is** achieved — and it validates a route that is
deliberately **not** authorised, because WRC 537 states no γ-interpolation rule.
The suspension is `NON_TABULATED_GAMMA_INTERPOLATION_RULE_NOT_SOURCE_QUALIFIED`.
This is a correct, deliberate fail-closed posture, not a bug. It is simply never
explained where the engineer meets it.

Relevant retained evidence that a future authorisation argument would draw on
(`check:emp1-gamma-interpolation`, this head):

```text
LOG_GAMMA     n=57  median |err| 5.5 %  p95 11.0 %  max 12.8 %  unconservative 18/57
LINEAR_GAMMA  n=57  median |err| 9.8 %  p95 26.2 %  max 28.1 %  unconservative  0/57
```

The registered coordinate is `LINEAR_GAMMA` — less accurate, but never
unconservative across the sampled domain. That is a defensible engineering
rationale and is currently recorded only in code comments and check output.

### 2.2 Work-package status against the #1760 roadmap

| WP | Issue | Claimed | Actual, verified |
|---|---|---|---|
| WRC-01 authority/oracle/custody | #1762 | closed | **Done.** PR #1785 merged |
| WRC-02 bounded source semantics | #1765 | in progress | **Blocked.** PR #1796 open/draft; every gate `NOT_RUN_CI_STARTUP_FAILURE` |
| WRC-03 exact-head 01–12 + anti-drift | #1768 | open | **Not started.** 0 comments |
| WRC-04 handcalc + CAUx/PV Elite | #1772 | open | **Not started** as a consolidation, though its CAUx inputs already pass |
| WRC-05 product/release closure | #1775 | open | **Not started.** 0 comments. Owns every UI finding below |
| WRC-06 future scope extension | #1777 | open | Research only, correctly not blocking |

### 2.3 The real critical-path blocker is infrastructure, not engineering

#1765 is not blocked on WRC work. It is blocked on **#54 — GitHub Actions jobs
fail before step creation**. Confirmed still live today:

```text
run 35138788615  EMP.1 gamma5 bounded route            failure
run 35138788605  EMP.1 runEmp1 orchestration            failure
run 35138788490  EMP.1 current-main baseline            failure
created 19:08:58 -> updated 19:09:01   (~3 s, steps=null, no logs)
```

Three seconds from creation to conclusion is a pre-step runner failure, not an
engineering FAIL. Every EMP.1 numerical gate therefore reads `NOT_RUN`, and
WRC-02 → WRC-03 → WRC-05 cannot advance on hosted evidence.

**#54 is the single highest-leverage open item in the entire EMP/WRC programme.**
#1768 already permits exact local-checkout evidence when hosted CI is unavailable,
so WRC-03 can begin in parallel rather than waiting.

---

## 3. UI audit — measured, at 100 % coverage of the tab

Every one of the 7 workflow steps was visited at 3 viewports and measured.

```text
step              scroll  inputs  details(open/total)  tables  buttons
1 Start           1.00vp     4         0/5              4        30
2 Geometry        1.00vp    17         0/10             2        33
3 Loads           1.00vp    18         0/5              6        31
4 Load transfer   1.00vp    34         0/5              5        30
5 Section check   1.00vp    15         0/6              5        32
6 Local check     1.00vp    14         0/9              5        32
7 Review & export 1.00vp     4         0/6              4        32
```

**A correction worth recording.** The historical ~9,400 px waterfall described in
`EMP_TAB_UI_RECOMMENDATIONS.md` has genuinely been fixed — scroll depth is now
1.00–1.08 viewports with no horizontal overflow at any tested width. The prior
remediation work (#1629, #1651, #1743) succeeded. The present problem is the
opposite failure mode: **everything is collapsed**. Across all 7 steps, **0 of
5–10 disclosures are open by default**. The information exists and is unreachable.

### 3.1 P0 — blocks real work

**U-01 · Pressure-radii dead end.** Apply a real OD (220 → 1844) and the run stops:

> "Assessment stopped — Pressure evaluation radii no longer fit inside the current
> pipe wall. Use Undo to restore the previous geometry, or import coordinated
> assessment data before calculating."

`resultRequests.pressure[*].requestedRadii` is written **only** by the sample
generator (`emp1-workbench-qualification-sample.js:77-78`) and appears in no
editable input group. The engineer is told to undo their own geometry. This is the
single hardest blocker to using the tab on real data.
*Fix:* expose the radii as a governed input group, or derive them from the wall on
geometry change, with a one-click "refit radii to current wall".

**U-02 · Run controls hidden inside a collapsed disclosure.** After the demo the
primary button becomes *Review assessment*. The controls that actually re-run —
*Run required assessment steps*, *Recalculate local check*, *Run load transfer* —
live inside a collapsed **More actions** block, alongside import/export and undo.
An engineer who edits an input cannot find how to recalculate.
*Fix:* promote a single contextual primary action that reflects current state
("Recalculate local check"), and keep only import/export/QA under *More actions*.

**U-03 · Result renders below two screens of governance chrome.** The eight-point
table's top is at **2,342 px** on a 1,200 px viewport, behind the collapsed
*Results & evidence* toggle, on tab 3 of 5 (*Local check evidence*). Step 6
"Local check" — the step that runs WRC — shows setup and route metadata but not
the answer.
*Fix:* the result belongs in the primary pane of step 6, above the fold, the moment
it is CURRENT.

**U-04 · Stress table carries no units.** Verified headers:

```text
["Location","σφ","σx","τ","Stress intensity","Au","Al","Bu","Bl","Cu","Cl","Du","Dl"]
```

Values print as `-44.51629933`. With N and mm inputs the basis is N/mm² (MPa), but
the table never says so — while the adjacent CAUx comparison table does label kPa.
An unlabelled stress table cannot be checked or signed by a reviewer.
*Fix:* unit in the column header, engineering precision (4 s.f.), full precision
retained under technical disclosure. **Presentation only — no value may change.**

### 3.2 P1 — obscures engineering meaning

**U-05 · Per-group "Apply" is undiscoverable and silently discards edits.** Typing a
new OD does nothing until *Apply Pipe geometry changes* is pressed; that button is
disabled until dirty and sits below the fold of its own pane. Navigating away loses
the edit with no warning. (This also cost this audit a false-positive staleness
finding — the first edit simply never committed.)

**U-06 · Landing mid-form.** Clicking step 2 *Geometry* lands inside the inner
pane's own scroll, mid-row, on a truncated `document.thicknessBasis.corrosio…`
label, with the geometry fields above the visible area.

**U-07 · Raw float precision in inputs.** Attachment OD renders as
`35.42857142857143`. No engineer types or checks that.

**U-08 · Run-together header text.**
`CalculatedAssessment calculated — review the result. It is not approved for final
use.Result · Current assessment resultUse · Not approved for final use` — four
concatenated states with no separators.

**U-09 · Status stated four times, never once authoritatively.** "Calculated" badge,
banner, workflow line, and `Local check: CALCULATED · CURRENT` all restate the same
thing in different vocabulary.

**U-10 · Readiness dashboard renders as an unaligned 7-column flow.** Labels and
values wrap independently, so "Release qualification / Not approved for stated use"
reads as two unrelated fragments.

### 3.3 P2 — navigation and polish

**U-11 · Five stacked navigation layers**: product tab bar → action bar → 7 workflow
steps → console mode tabs → inspector tabs (+ 5 evidence tabs). Nothing indicates
which layer owns the current task.

**U-12 · A whole navigation layer is invisible above 1050 px.** `Work / Basis /
Evidence` mode tabs are in the DOM and in the accessibility tree at 1600 px with
`aria-selected="true"`, but `display:none` — they are a `@media(max-width:1050px)`
feature. Screen-reader users on desktop are offered tabs that cannot be operated.

**U-13 · Content disappears rather than reflows at 900 px.** Visible tables drop
4 → 0 on *Start* and 5 → 0 on *Local check*.

**U-14 · Semi-raw tokens in the status strip**: `ANALYTICAL_FOUNDATION_V1`,
`NOT APPLICABLE`, `NOT QUALIFIED`.

**U-15 · Product tab bar advertises an unimplemented product** —
"LAFEA.6 Weld profile · FEA (Not implemented)".

**U-16 · γ refusal is never explained where it is met.** The registry holds an
excellent rationale and the CAUx evidence proves 2 % agreement, but an engineer
whose vessel is γ = 48 is never shown why the tool declines, or that a
comparison-qualified route exists.

---

## 4. Revamp plan

**R-1 · Make the result the subject of the result step.** Move the eight-point table
into the step-6 primary pane, above the fold, with units, engineering precision and
the governing point called out. Demote route metadata to the basis rail.

**R-2 · One contextual primary action.** A single state-driven button —
*Run complete example* → *Recalculate local check* → *Review assessment* — with
import/export/QA and per-engine tools under *More actions*.

**R-3 · Unblock real geometry.** Make pressure radii editable or auto-refit them,
and never offer *Undo* as the only recovery from a user's legitimate input.

**R-4 · Replace per-group Apply with a single commit affordance.** One dirty-state
bar for the step ("3 changes pending — Apply / Discard"), with a navigation guard.

**R-5 · Default the disclosures open for the active step.** Readiness and blockers
should be visible when they are blocking; collapse only what is genuinely secondary.

**R-6 · Collapse five nav layers into two.** Workflow steps own the task; one
evidence console owns the evidence. Delete the desktop-invisible mode tabs or make
them real at all widths.

**R-7 · Explain the γ boundary at the point of refusal.** When γ ≠ 5, state the
measured γ, that WRC 537 supplies no interpolation rule, that a comparison-qualified
interpolated route exists and matches CAUx within 2 %, and that it is not authorised
for engineering use — with the conservatism evidence one click away.

**R-8 · Engineering typography.** Units in every stress header, 4 s.f. by default,
full precision under technical disclosure, aligned label/value grids.

### Sequencing

```text
Wave 1 (P0, unblocks real use)     U-01 U-02 U-03 U-04
Wave 2 (P1, restores meaning)      U-05 U-06 U-07 U-08 U-09 U-10
Wave 3 (P2, structural)            U-11 U-12 U-13 U-14 U-15 U-16
```

Waves 1–2 are presentation-only and need no new engineering authority. Wave 3's
U-16 requires WRC-02 source-semantic wording; U-12/U-13 are layout contracts owned
by WRC-05 (#1775) benchmarks BM-UI-06 and BM-UI-07.

---

## 5. Protected invariants

No item above authorises changing WRC formulae, curve data, oracles, tolerances,
expected values, γ/β/Δp/SCF scope, route authorisation, code compliance or release
state. U-04 is a label-and-format change only; the retained numerical values and
their hashes must be byte-identical before and after.
